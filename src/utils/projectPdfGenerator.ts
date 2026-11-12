import logoAsset from '../assets/images/logo.png';
import signAsset from '../assets/images/sign.png';
import { formatDate } from './formatters';

const COMPANY_INFO = {
  name: 'TO-GEN SOLAR AGRO',
  address: '3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil,',
  city: 'Madurai – 625301',
  state: 'Tamil Nadu',
  gstin: '33BJWPA4500M1Z6',
  phone: '+91 63803 29294',
  email: 'info@togensolar.com',
};

async function toBase64(url: string): Promise<string> {
  if (!url) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

export async function generateProjectHtml(project: any, quotation?: any): Promise<string> {
  const [logo, sign] = await Promise.all([
    toBase64(logoAsset || '/src/assets/images/logo.png'),
    toBase64(signAsset || '/src/assets/images/sign.png'),
  ]);

  const html = `<div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a202c; background: #ffffff; width: 800px; padding: 36px; box-sizing: border-box; position: relative;">
    
    <div style="position: relative; z-index: 1;">
      <!-- HEADER SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 58%; vertical-align: top;">
            ${logo ? `<img src="${logo}" style="height: 70px; max-width: 250px; object-fit: contain; margin-bottom: 10px; display: block;" alt="ToGen Solar Logo" />` : `<div style="font-size: 26px; font-weight: 900; color: #0b75b9; letter-spacing: -0.5px; margin-bottom: 12px;">${COMPANY_INFO.name}</div>`}
            <div style="font-size: 11px; color: #4a5568; line-height: 1.5; max-width: 320px;">
              ${COMPANY_INFO.address}<br/>
              ${COMPANY_INFO.city}, ${COMPANY_INFO.state}<br/>
            </div>
          </td>
          <td style="width: 42%; vertical-align: top; text-align: right;">
            <div style="font-size: 28px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; text-transform: uppercase; margin-bottom: 4px;">PROJECT RECORD</div>
            <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 12px;">Ref # ${project.reference}</div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-left: auto;">
              <tr>
                <td style="color: #64748b; padding: 2px 8px 2px 0; text-align: right;">Date Created:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${formatDate(project.created_at)}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 2px 8px 2px 0; text-align: right;">Quotation Ref:</td>
                <td style="font-weight: 700; color: #0284c7; padding: 2px 0; text-align: right;">${project.quotation_ref || '-'}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CUSTOMER INFO -->
      <div style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 14px; margin-bottom: 20px;">
        <div style="font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Customer & Site Details</div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${project.customerName || 'Unknown Customer'}</div>
        <div style="font-size: 11px; color: #64748b; line-height: 1.4;">${project.siteName || 'Unknown Site'}</div>
      </div>

      <!-- PROJECT DETAILS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px;">
              <div style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 8px;">Project Overview</div>
              <table style="width: 100%; font-size: 11px; color: #475569;">
                <tr><td style="padding: 4px 0;">Stage / Progress:</td><td style="text-align: right; font-weight: 700; color: #16a34a;">${project.stage || 'Not started'}</td></tr>
                <tr><td style="padding: 4px 0;">Target Date:</td><td style="text-align: right; font-weight: 600;">${project.target_date ? formatDate(project.target_date) : '-'}</td></tr>
                <tr><td style="padding: 4px 0;">Payment Status:</td><td style="text-align: right; font-weight: 600;">${project.payment_status || 'Pending'}</td></tr>
              </table>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 10px;">
            <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px;">
               <div style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 8px;">System Record</div>
               <div style="font-size: 11px; color: #475569; line-height: 1.5;">
                 This document is an officially generated project record from ToGen Solar CRM. It reflects the data available at the time of generation.
               </div>
            </div>
          </td>
        </tr>
      </table>

      ${quotation && quotation.items && quotation.items.length > 0 ? `
      <!-- PRODUCTS AND PRICING -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 8px;">Products & Pricing</div>
        <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 10px; box-sizing: border-box;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569; text-align: left;">
              <th style="padding: 6px; border: 1px solid #e2e8f0; width: 45%; font-weight: 700;">Item</th>
              <th style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; width: 12%; font-weight: 700; white-space: nowrap;">Qty</th>
              <th style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; width: 20%; font-weight: 700; white-space: nowrap;">Unit Price</th>
              <th style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; width: 23%; font-weight: 700; white-space: nowrap;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${quotation.items.map((item: any) => `
            <tr>
              <td style="padding: 6px; border: 1px solid #e2e8f0; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.45;">${item.name}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; vertical-align: middle;">${item.quantity}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; white-space: nowrap; vertical-align: middle;">₹${item.unit_price.toFixed(2)}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600; white-space: nowrap; vertical-align: middle;">₹${item.total.toFixed(2)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 8px; font-size: 11px; font-weight: 800; color: #0f172a;">
          Grand Total: ₹${quotation.grand_total.toFixed(2)}
        </div>
      </div>
      ` : ''}

      <!-- FOOTER -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
        <tr>
          <td style="width: 60%; vertical-align: bottom; font-size: 10px; color: #94a3b8;">
            <div>Thank you for choosing ${COMPANY_INFO.name}.</div>
            <div style="margin-top: 2px;">System generated project record.</div>
          </td>
          <td style="width: 40%; vertical-align: bottom; text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px;">For ${COMPANY_INFO.name}</div>
            ${sign ? `<img src="${sign}" style="max-height: 50px; max-width: 140px; object-fit: contain; margin: 2px 0 2px auto; display: block;" alt="Signature" />` : `<div style="height: 45px; border-bottom: 1px solid #cbd5e1; width: 140px; margin: 4px 0 4px auto;"></div>`}
            <div style="font-size: 9px; color: #94a3b8; font-weight: 600;">Authorised Signatory</div>
          </td>
        </tr>
      </table>
      
    </div>
  </div>`;

  return html;
}

export async function generateProjectPDF(project: any, quotation?: any, filename?: string): Promise<void> {
  const html = await generateProjectHtml(project, quotation);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;background:#fff;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  try {
    const { jsPDF }   = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    await new Promise(r => setTimeout(r, 120));
    
    const canvas = await html2canvas(wrap, { scale: 3.0, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, (canvas.height * pdfW) / canvas.width, undefined, 'FAST');
    pdf.save(filename ?? `Project_Record_${project.reference}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
