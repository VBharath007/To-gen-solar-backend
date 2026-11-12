import {auth} from '../src/firebase';
const [uid,businessId,role='staff']=process.argv.slice(2);
if(!uid||!businessId||!/^[A-Za-z0-9_-]{1,80}$/.test(businessId)||!['admin','staff','viewer'].includes(role))throw new Error('Usage: npm run grant -- USER_UID BUSINESS_ID admin|staff|viewer');
const user=await auth.getUser(uid);
await auth.setCustomUserClaims(uid,{...user.customClaims,businessId,role});
console.log('Business access assigned. Sign out and sign in on the phone to refresh claims.');
