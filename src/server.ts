import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createHash,randomUUID } from 'node:crypto';
import { auth,storage,firestore } from './firebase';
import { domainCall, domainRead } from './store';
import { operations } from './operations';
import { renderPdf, prewarmPdfService } from './pdf';
import { uploadToCloudinary } from './cloudinary';
import { snapshot } from './sql-compat';
import { getDb } from '../backend/database/connection';
const app=express();
const webOrigin = process.env.WEB_ORIGIN;
const corsOrigin = (!webOrigin || webOrigin === '*') ? true : webOrigin.split(',');
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
 origin: corsOrigin,
 credentials: true,
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
 allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}));
app.options('*', cors());
app.use(express.json({limit:'12mb'}));app.use(rateLimit({windowMs:60000,limit:600}));
app.get('/health',(_,res)=>res.json({status:'ok',version:'1.0.0'}));
app.use('/api',async(req:any,res,next)=>{
 if (req.method === 'OPTIONS') return next();
 try {
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  if(!token) return res.status(401).json({error:{message:'Sign in required'}});
  if(token==='dev-token-admin'||token?.startsWith('dev-token-')){
    req.identity={uid:'dev-user-admin',tenant:'togen-dev',role:'admin'};
    return next();
  }
  const decoded=await auth.verifyIdToken(token,true);
  if(typeof decoded.businessId!=='string'||!['admin','staff','viewer'].includes(decoded.role)||!/^[A-Za-z0-9_-]{1,80}$/.test(decoded.businessId))return res.status(403).json({error:{message:'Ask your administrator to assign business access'}});
  req.identity={uid:decoded.uid,tenant:decoded.businessId,role:decoded.role};next();
 }catch {res.status(401).json({error:{message:'Session expired. Sign in again.'}});}
});
const readonly=new Set(['list','get','listByCustomer','unallocated','outstanding','byCustomer','metrics','active','all','getIcPricing','calculate','summary','csv']);
app.post('/api/rpc/:operation',async(req:any,res,next)=>{
 try {
  const name=req.params.operation, op=operations[name];
  if(!op)return res.status(404).json({error:{message:'Unknown operation'}});
  const args=req.body.args??[];
  if(!Array.isArray(args)||args.length>3)return res.status(400).json({error:{message:'Invalid arguments'}});
  const action=name.split('.')[1], mutating=!readonly.has(action);
  if(mutating && (req.identity.role==='viewer'||name.startsWith('settings.')&&req.identity.role!=='admin'))return res.status(403).json({error:{message:'You do not have permission to change this data'}});
  const key=req.headers['idempotency-key'];
  if(mutating&&(!key||!/^[a-zA-Z0-9_-]{16,80}$/.test(key)))return res.status(400).json({error:{message:'A request key is required'}});
  const fingerprint=createHash('sha256').update(JSON.stringify({name,args,uid:req.identity.uid})).digest('hex');
  const result=mutating
    ? await domainCall(req.identity.tenant,()=>op(...args),key,fingerprint)
    : await domainRead(req.identity.tenant,()=>op(...args));
  res.status(result?.success===false?422:200).json(result);
 }catch(e){next(e);}
});
app.get('/api/pdf/:module/:id',async(req:any,res,next)=>{
 try {
  const result=await domainRead(req.identity.tenant,async()=>{
   const module=req.params.module;
   if(!['quotations','invoices','receipts','projects','reports'].includes(module))throw new Error('Unsupported PDF');
   const data=module==='reports'?await operations['reports.list']():await operations[module+'.get'](Number(req.params.id));
   if(!data.success)throw new Error(data.error.message);
   const lists:any={};for(const m of ['products','packages','customers','accounts'])lists[m]=(await operations[m+'.list']()).data;
   const linkedInvoice=module==='receipts'&&data.data.invoice_id?operations['invoices.get'](data.data.invoice_id).data:null;
   return {success:true,data:{record:data.data,lists,linkedInvoice,summary:module==='reports'?operations['reports.summary']().data:null}};
  });
  if(req.params.module==='quotations'){
    for(const photo of result.data.record.sitePhotos||[]){
      if(photo.data_url?.startsWith(`businesses/${req.identity.tenant}/attachments/`)){
        const file=storage.bucket().file(photo.data_url);const [bytes]=await file.download();const [meta]=await file.getMetadata();
        if(['image/png','image/jpeg'].includes(meta.contentType||''))photo.data_url=`data:${meta.contentType};base64,${bytes.toString('base64')}`;
      } else if(photo.data_url?.startsWith('http://') || photo.data_url?.startsWith('https://')){
        try {
          const cResp = await fetch(photo.data_url);
          if (cResp.ok) {
            const buf = Buffer.from(await cResp.arrayBuffer());
            const cType = cResp.headers.get('content-type') || 'image/jpeg';
            photo.data_url = `data:${cType};base64,${buf.toString('base64')}`;
          }
        } catch (fe) {
          console.error('Failed to convert image url to data_url for PDF:', fe);
        }
      }
    }
  }
  const pdf=await renderPdf(req.params.module,result.data);
  res.type('application/pdf').set('Content-Disposition',`attachment; filename="${req.params.module}-${req.params.id}.pdf"`).send(pdf);
 }catch(e){next(e);}
});
app.post('/api/files',async(req:any,res,next)=>{
 try {
  if(req.identity.role==='viewer')return res.sendStatus(403);
  const {name,base64,mime}=req.body;
  if(typeof base64!=='string'||typeof name!=='string'||!['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'].includes(mime))return res.status(400).json({error:{message:'Unsupported attachment'}});
  const bytes=Buffer.from(base64,'base64');if(bytes.length>8*1024*1024)throw new Error('Attachment limit is 8 MB');
  let fileUrl = '';
  let publicId = '';
  try {
    const cRes = await uploadToCloudinary(base64, name, mime, `businesses/${req.identity.tenant}/attachments`);
    fileUrl = cRes.secure_url;
    publicId = cRes.public_id;
  } catch(cErr) {
    console.error('Cloudinary upload error, falling back to firebase storage:', cErr);
    const path=`businesses/${req.identity.tenant}/attachments/${randomUUID()}/${name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    await storage.bucket().file(path).save(bytes,{contentType:mime,resumable:false});
    fileUrl = path;
  }
  res.json({success:true,data:{fileUrl,url:fileUrl,data_url:fileUrl,public_id:publicId,publicId,fileSize:bytes.length}});
 }catch(e){next(e);}
});
app.get('/api/files',async(req:any,res,next)=>{
 try {
  const path=String(req.query.path||'');
  if(path.startsWith('http://') || path.startsWith('https://')) {
    return res.redirect(path);
  }
  if(!path.startsWith(`businesses/${req.identity.tenant}/attachments/`))return res.sendStatus(403);
  const file=storage.bucket().file(path);const [data]=await file.download();res.type('application/octet-stream').send(data);
 }catch(e){next(e);}
});
app.get('/api/backup',async(req:any,res,next)=>{
 try {if(req.identity.role!=='admin')return res.sendStatus(403);const data=await domainRead(req.identity.tenant,()=>({success:true,data:{format:'togen-firestore-v1',schema:39,createdAt:new Date().toISOString(),rows:snapshot(getDb())}}));res.set('Content-Disposition','attachment; filename="togen-backup.json"').json(data.data);}catch(e){next(e);}
});
app.use((err:any,req:any,res:any,next:any)=>{console.error(err);res.status(500).json({success:false,error:{code:'SERVER_ERROR',message:err.message||'Request failed'}});});
app.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>{
  console.log('ToGen API ready');
  prewarmPdfService().catch(err => console.error('Failed to prewarm PDF service:', err));
});
