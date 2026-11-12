/**
 * ToGen Solar CRM — Premium Tax Invoice PDF Generator
 * Assets in /src/assets/images/: logo.jpg | sign.png | upi_qr.png
 */

export const COMPANY_INFO = {
  name: 'TO-GEN SOLAR AGRO',
  address: '3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil,',
  city: 'Madurai – 625301',
  state: 'Tamil Nadu',
  gstin: '33BJWPA4500M1Z6',
  phone: '+91 63803 29294',
  email: 'info@togensolar.com',
  bank: {
    name: 'CANARA BANK',
    branch: 'Alagarkoil, Madurai',
    accountHolder: 'TO-GEN SOLAR AGRO',
    accountNo: '120029515077',
    ifsc: 'CNRB0016228',
    upiId: '325547505515077@cnrb',
  },
};

import logoAsset from '../assets/images/logo.png';
import signAsset from '../assets/images/sign.png';
import canaraQrAsset from '../assets/images/canara_qr.png';
import { getPrimaryBankAccount } from './bankAccountStorage';
import { formatNotesToPlainText } from './formatters';

export interface InvoiceItem {
  description: string;
  hsn?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  gstRate: number;
  total: number; // taxable base in paise
}

export interface InvoiceBankDetails {
  name: string;
  branch?: string;
  accountHolder: string;
  accountNo: string;
  ifsc: string;
  upiId?: string;
  accountType?: string;
}

export interface InvoiceData {
  invoiceType?: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string;
  placeOfSupply?: string;
  validityDays?: number;
  billTo: {
    name: string;
    address?: string;
    city?: string;
    pincode?: string;
    gstin?: string;
    phone?: string;
  };
  items: InvoiceItem[];
  notes?: string;
  termsAndConditions?: string[];
  bankDetails?: InvoiceBankDetails;
  disclaimer?: string;
}

function fmt(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const rupees = Math.floor(num / 100);
  const paise = num % 100;
  if (rupees === 0) return 'Zero Rupees Only';
  return convert(rupees) + ' Rupees' + (paise > 0 ? ' and ' + convert(paise) + ' Paise' : '') + ' Only';
}

async function toBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
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

export async function generateTaxInvoiceHtml(data: InvoiceData): Promise<string> {
  const [logo, sign, canaraQr] = await Promise.all([
    toBase64(logoAsset || '/src/assets/images/logo.png'),
    toBase64(signAsset || '/src/assets/images/sign.png'),
    toBase64(canaraQrAsset || '/src/assets/images/canara_qr.png'),
  ]);

  const rawType = (data.invoiceType || 'Invoice').trim();
  const isProforma = rawType.toLowerCase().includes('proforma') || rawType.toLowerCase().includes('performa');
  const isAdvanceReceipt = rawType.toLowerCase().includes('advance') || rawType.toLowerCase().includes('receipt');
  const headerTitle = isProforma 
    ? 'PROFORMA INVOICE' 
    : (isAdvanceReceipt ? 'ADVANCE RECEIPT' : 'TAX INVOICE');
  const dateLabel = isProforma 
    ? 'Proforma Date:' 
    : (isAdvanceReceipt ? 'Receipt Date:' : 'Invoice Date:');
  const defaultFilename = isProforma 
    ? `Proforma_Invoice_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    : (isAdvanceReceipt 
        ? `Advance_Receipt_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : `Tax_Invoice_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  const rawPlace = (data.placeOfSupply || 'Tamil Nadu').replace(/^33\s*[-–]?\s*/i, '').trim();
  const placeOfSupply = rawPlace || 'Tamil Nadu';

  let subTotal = 0, totalGST = 0;
  const rows = data.items.map((item, i) => {
    const gst   = Math.round(item.total * item.gstRate / 100);
    const grand = item.total + gst;
    subTotal += item.total; totalGST += gst;
    return { ...item, slNo: i + 1, gst, grand };
  });
  const grandTotal = subTotal + totalGST;
  const amtWords   = numberToWords(grandTotal);
  const terms      = data.termsAndConditions ?? (
    data.notes && data.notes.trim()
      ? formatNotesToPlainText(data.notes).split('\n').map(s => s.trim()).filter(Boolean)
      : [
          'Goods once sold cannot be taken back or exchanged.',
          'All disputes are subject to Madurai jurisdiction only.',
          'Warranty as per company norms.',
          'Late payment will attract 18% p.a. interest.',
        ]
  );
  const validityDays = data.validityDays ?? 7;
  const disclaimerText = data.disclaimer ?? `This quotation/invoice is valid for <strong>${validityDays} days from the date of issue</strong>. Prices are subject to change based on prevailing market rates, material costs, taxes, transportation charges, and government regulations. Any revision in price will be confirmed before order processing.`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; font-size: 12px; color: #0f172a; background: #ffffff; width: 800px; padding: 34px 38px; box-sizing: border-box; position: relative;">

    <div style="position: relative; z-index: 1;">
      <!-- HEADER SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 58%; vertical-align: top;">
            ${logo ? `<img src="${logo}" style="height: 68px; max-width: 250px; object-fit: contain; margin-bottom: 8px; display: block;" alt="ToGen Solar Logo" />` : `<div style="font-size: 26px; font-weight: 900; color: #0b75b9; letter-spacing: -0.5px; margin-bottom: 10px;">${COMPANY_INFO.name}</div>`}
            <div style="font-size: 11.5px; color: #334155; line-height: 1.5; max-width: 320px; font-weight: 500;">
              ${COMPANY_INFO.address}<br/>
              ${COMPANY_INFO.city}, ${COMPANY_INFO.state}<br/>
              <span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 700; color: #0f172a; font-size: 11px;">GSTIN: ${COMPANY_INFO.gstin}</span>
            </div>
          </td>
          <td style="width: 42%; vertical-align: top; text-align: right;">
            <div style="font-size: 26px; font-weight: 900; color: #ea580c; letter-spacing: -0.5px; text-transform: uppercase; margin-bottom: 4px;">${headerTitle}</div>
            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 10px;"># ${data.invoiceNo}</div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 0; text-align: right; width: 55%;">${dateLabel}</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${data.invoiceDate}</td>
              </tr>
              ${data.dueDate ? `<tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 0; text-align: right;">Due Date:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${data.dueDate}</td>
              </tr>` : ''}
              <tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 0; text-align: right;">Place of Supply:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${placeOfSupply}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- BILL TO SECTION -->
      <div style="margin-bottom: 18px; padding: 0 2px;">
        <div style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Billed To</div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${data.billTo.name}</div>
        <div style="font-size: 12px; color: #334155; line-height: 1.5; font-weight: 500;">
          ${data.billTo.address ? `${data.billTo.address}<br/>` : ''}
          ${[data.billTo.city, data.billTo.pincode].filter(Boolean).join(' - ')}
        </div>
        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px;">
          ${data.billTo.phone ? `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 3px 8px; border-radius: 4px; font-weight: 700;">📞 Phone: ${data.billTo.phone}</div>` : ''}
          ${data.billTo.gstin ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-weight: 700;">GSTIN: ${data.billTo.gstin}</div>` : ''}
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table style="table-layout: fixed; width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11.5px; border: 1.5px solid #94a3b8; box-sizing: border-box;">
        <thead>
          <tr style="background: #1e3a8a; color: #ffffff; font-size: 11.5px;">
            <th style="padding: 10px 6px; text-align: center; border: 1px solid #1e40af; width: 5%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">#</th>
            <th style="padding: 10px 10px; text-align: left; border: 1px solid #1e40af; width: 35%; font-weight: 700; letter-spacing: 0.3px;">Item Description</th>
            <th style="padding: 10px 8px; text-align: center; border: 1px solid #1e40af; width: 11%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">HSN/SAC</th>
            <th style="padding: 10px 6px; text-align: center; border: 1px solid #1e40af; width: 6%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">Qty</th>
            <th style="padding: 10px 6px; text-align: center; border: 1px solid #1e40af; width: 6%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">Unit</th>
            <th style="padding: 10px 8px; text-align: right; border: 1px solid #1e40af; width: 13%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">Rate</th>
            <th style="padding: 10px 8px; text-align: center; border: 1px solid #1e40af; width: 8%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">GST %</th>
            <th style="padding: 10px 10px; text-align: right; border: 1px solid #1e40af; width: 16%; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
              <td style="padding: 9px 6px; text-align: center; color: #1e293b; border: 1px solid #cbd5e1; white-space: nowrap; font-weight: 600; vertical-align: middle;">${r.slNo}</td>
              <td style="padding: 9px 10px; border: 1px solid #cbd5e1; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; line-height: 1.45;">
                <div style="font-weight: 700; color: #0f172a; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.45;">${r.description}</div>
              </td>
              <td style="padding: 9px 8px; text-align: center; color: #334155; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap; font-weight: 600; vertical-align: middle;">${r.hsn || '-'}</td>
              <td style="padding: 9px 6px; text-align: center; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; white-space: nowrap; vertical-align: middle;">${r.quantity}</td>
              <td style="padding: 9px 6px; text-align: center; font-weight: 600; color: #334155; border: 1px solid #cbd5e1; white-space: nowrap; vertical-align: middle;">${r.unit || '-'}</td>
              <td style="padding: 9px 8px; text-align: right; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1; white-space: nowrap; vertical-align: middle;">${fmt(r.unitPrice)}</td>
              <td style="padding: 9px 8px; text-align: center; color: #0284c7; font-weight: 700; border: 1px solid #cbd5e1; white-space: nowrap; vertical-align: middle;">${r.gstRate ?? 0}%</td>
              <td style="padding: 9px 10px; text-align: right; font-weight: 800; color: #0f172a; border: 1px solid #cbd5e1; white-space: nowrap; vertical-align: middle;">${fmt(r.grand)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- TOTALS SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="width: 52%; vertical-align: top; padding-right: 16px;">
            <div style="background: #f8fafc; border-radius: 6px; padding: 14px 16px; border: 1.5px solid #cbd5e1; box-sizing: border-box;">
              <div style="font-size: 10.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Amount in Words</div>
              <div style="font-weight: 700; color: #0f172a; font-size: 12px; line-height: 1.5;">${amtWords}</div>
            </div>
          </td>
          <td style="width: 48%; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1.5px solid #94a3b8; border-radius: 6px; overflow: hidden; white-space: nowrap; background: #ffffff;">
              <tr style="border-bottom: 1px solid #e2e8f0; white-space: nowrap;">
                <td style="padding: 8px 12px; color: #334155; font-weight: 600; border-right: 1px solid #e2e8f0; white-space: nowrap;">Sub Total</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">${fmt(subTotal)}</td>
              </tr>
              <tr style="border-bottom: 1.5px solid #94a3b8; white-space: nowrap; background: #fafbfc;">
                <td style="padding: 8px 12px; color: #334155; font-weight: 600; border-right: 1px solid #e2e8f0; white-space: nowrap;">Total Tax Amount</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">${fmt(totalGST)}</td>
              </tr>
              <tr style="white-space: nowrap; background: #eff6ff;">
                <td style="padding: 10px 12px; color: #1e3a8a; font-weight: 900; font-size: 13.5px; letter-spacing: 0.5px; border-right: 1.5px solid #94a3b8; white-space: nowrap;">GRAND TOTAL</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 900; font-size: 16px; color: #c2410c; white-space: nowrap;">${fmt(grandTotal)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- FOOTER: BANK & TERMS -->
      ${(() => {
        const primaryAcc = getPrimaryBankAccount();
        const bank = data.bankDetails || {
          name: primaryAcc.bankName || COMPANY_INFO.bank.name,
          branch: primaryAcc.branchName || COMPANY_INFO.bank.branch,
          accountHolder: primaryAcc.accountName || COMPANY_INFO.bank.accountHolder,
          accountNo: primaryAcc.accountNumber || COMPANY_INFO.bank.accountNo,
          ifsc: primaryAcc.ifscCode || COMPANY_INFO.bank.ifsc,
          upiId: primaryAcc.upiId || COMPANY_INFO.bank.upiId,
          accountType: primaryAcc.accountType || 'Current'
        };

        const isCanara = Boolean(
          (bank.name && bank.name.toUpperCase().includes('CANARA')) ||
          (bank.ifsc && bank.ifsc.toUpperCase().startsWith('CNRB')) ||
          (bank.accountNo && bank.accountNo.includes('120029515077'))
        );

        const bankCardHtml = `
          <div style="background: #0f172a; color: #ffffff; border-radius: 8px; padding: 14px 16px; position: relative; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); height: fit-content; align-self: flex-start; box-sizing: border-box;">
            <div style="position: absolute; top: -20px; right: -20px; width: 90px; height: 90px; background: rgba(255,255,255,0.05); border-radius: 50%; z-index: 0;"></div>
            
            <div style="position: relative; z-index: 1;">
              <div style="font-size: 11.5px; font-weight: 800; color: #fb923c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Payment Details
              </div>
              
              <div style="display: flex; gap: 12px; align-items: center;">
                ${(isCanara && canaraQr) ? `<div style="background: #ffffff; padding: 4px; border-radius: 6px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><img src="${canaraQr}" style="width: 76px; height: 76px; object-fit: contain; display: block;" alt="Canara Bank UPI QR" /></div>` : ''}
                
                <div style="flex: 1;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; color: #e2e8f0;">
                    <tr><td style="padding: 2px 0; width: 34%; font-weight: 500; color: #cbd5e1; white-space: nowrap;">Account Name:</td><td style="padding: 2px 0; font-weight: 700; color: #ffffff;">${bank.accountHolder}</td></tr>
                    <tr><td style="padding: 2px 0; font-weight: 500; color: #cbd5e1; white-space: nowrap;">Account No:</td><td style="padding: 2px 0; font-weight: 800; color: #60a5fa; font-size: 13px; font-family: 'Consolas', 'Courier New', monospace;">${bank.accountNo}</td></tr>
                    <tr><td style="padding: 2px 0; font-weight: 500; color: #cbd5e1; white-space: nowrap;">Bank:</td><td style="padding: 2px 0; font-weight: 700; color: #ffffff;">${bank.name}${bank.accountType ? ` (${bank.accountType})` : ''}</td></tr>
                    <tr><td style="padding: 2px 0; font-weight: 500; color: #cbd5e1; white-space: nowrap;">IFSC:</td><td style="padding: 2px 0; font-weight: 800; color: #ffffff; font-family: 'Consolas', 'Courier New', monospace;">${bank.ifsc}</td></tr>
                    ${bank.branch ? `<tr><td style="padding: 2px 0; font-weight: 500; color: #cbd5e1; white-space: nowrap;">Branch:</td><td style="padding: 2px 0; font-weight: 600; color: #e2e8f0;">${bank.branch}</td></tr>` : ''}
                    ${bank.upiId ? `<tr><td style="padding: 2px 0; font-weight: 500; color: #cbd5e1; white-space: nowrap;">UPI ID:</td><td style="padding: 2px 0; font-weight: 800; color: #38bdf8; font-family: 'Consolas', 'Courier New', monospace;">${bank.upiId}</td></tr>` : ''}
                  </table>
                </div>
              </div>
            </div>
          </div>
        `;

        const signatureBlockHtml = `
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 2px;">For ${COMPANY_INFO.name}</div>
            ${sign ? `<img src="${sign}" style="max-height: 42px; max-width: 140px; object-fit: contain; margin: 2px 0 2px auto; display: block;" alt="Authorized Signature" />` : `<div style="height: 38px; border-bottom: 1.5px solid #94a3b8; width: 130px; margin: 6px 0 6px auto;"></div>`}
            <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">P. Alagu Pandi</div>
            <div style="font-size: 10px; color: #475569; font-weight: 600;">Authorised Signatory</div>
          </div>
        `;

        const totalTermsLength = terms.reduce((acc, t) => acc + t.length, 0);
        const isLongTerms = terms.length > 3 || totalTermsLength > 160;

        if (isLongTerms) {
          return `
            <!-- LONG TERMS: WIDE CARD (100% OF PRINTABLE WIDTH) ABOVE BANK DETAILS & SIGNATURE -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; width: 100%; box-sizing: border-box;">
              <div style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Terms & Conditions</div>
              ${terms.length > 5 ? `
                <div style="display: flex; gap: 24px;">
                  <ul style="flex: 1; margin: 0; padding-left: 14px; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">
                    ${terms.slice(0, Math.ceil(terms.length / 2)).map(t => `<li style="margin-bottom: 2.5px;">${t}</li>`).join('')}
                  </ul>
                  <ul style="flex: 1; margin: 0; padding-left: 14px; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">
                    ${terms.slice(Math.ceil(terms.length / 2)).map(t => `<li style="margin-bottom: 2.5px;">${t}</li>`).join('')}
                  </ul>
                </div>
              ` : `
                <ul style="margin: 0; padding-left: 14px; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">
                  ${terms.map(t => `<li style="margin-bottom: 2.5px;">${t}</li>`).join('')}
                </ul>
              `}
            </div>

            <!-- BANK DETAILS & SIGNATURE ROW -->
            <div style="display: flex; gap: 16px; justify-content: space-between; align-items: flex-end;">
              <div style="flex: 1.1; max-width: 440px;">
                ${bankCardHtml}
              </div>
              <div style="flex: 0.9; padding-bottom: 4px;">
                ${signatureBlockHtml}
              </div>
            </div>
          `;
        } else {
          return `
            <!-- SHORT TERMS: SIDE-BY-SIDE WITH BANK DETAILS -->
            <div style="display: flex; gap: 16px; align-items: flex-start;">
              <div style="flex: 1.05;">
                ${bankCardHtml}
              </div>
              <div style="flex: 0.95; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px;">
                  <div style="font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 6px;">Terms & Conditions</div>
                  <ul style="margin: 0; padding-left: 14px; font-size: 10.5px; color: #334155; line-height: 1.5; font-weight: 500;">
                    ${terms.map(t => `<li style="margin-bottom: 2px;">${t}</li>`).join('')}
                  </ul>
                </div>
                <div style="margin-top: 10px;">
                  ${signatureBlockHtml}
                </div>
              </div>
            </div>
          `;
        }
      })()}

      <!-- DISCLAIMER SECTION -->
      <div style="margin-top: 16px; background: #fffbeb; border: 1.5px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 8px 12px; font-size: 10px; color: #78350f; line-height: 1.5; font-weight: 500;">
        <strong style="color: #92400e; font-weight: 800;">Disclaimer:</strong> ${disclaimerText}
      </div>
      
    </div>
  </div>`;

  return html;
}

export async function generateTaxInvoicePDF(data: InvoiceData, filename?: string): Promise<void> {
  const rawType = (data.invoiceType || 'Invoice').trim();
  const isProforma = rawType.toLowerCase().includes('proforma') || rawType.toLowerCase().includes('performa');
  const isAdvanceReceipt = rawType.toLowerCase().includes('advance') || rawType.toLowerCase().includes('receipt');
  const defaultFilename = isProforma 
    ? `Proforma_Invoice_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    : (isAdvanceReceipt 
        ? `Advance_Receipt_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : `Tax_Invoice_${data.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

  const html = await generateTaxInvoiceHtml(data);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;margin:0;padding:0;background:#ffffff;z-index:-99999;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  try {
    const { jsPDF }   = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, 60));
    
    // Scale 3.0 gives 2400px width (high-res 300 DPI) for crystal-clear, razor-sharp text
    const canvas = await html2canvas(wrap, { 
      scale: 3.0, 
      useCORS: true, 
      allowTaint: true, 
      backgroundColor: '#ffffff', 
      width: 800,
      windowWidth: 800,
      scrollX: 0, 
      scrollY: 0,
      x: 0,
      y: 0,
      logging: false 
    });
    
    // Lossless PNG eliminates all JPEG compression blur, ringing and fuzzy text artifacts
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const renderedH = (canvas.height * pdfW) / canvas.width;

    if (renderedH > pdfH) {
      // Proportional fit ensures 0 cropping of disclaimer, terms or signature
      const scale = (pdfH - 6) / renderedH;
      const fitW = pdfW * scale;
      const fitH = renderedH * scale;
      const offsetX = (pdfW - fitW) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, 3, fitW, fitH, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, renderedH, undefined, 'FAST');
    }
    
    pdf.save(filename ?? defaultFilename);
  } finally {
    document.body.removeChild(wrap);
  }
}
