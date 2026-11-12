/**
 * ToGen Solar CRM — Premium Payment Receipt PDF Generator
 * Includes: Product line items, product counts, quantity count, tax, invoice total,
 * amount paid, remaining balance, invoice date, paid date, transaction details & signature.
 */

export const COMPANY_INFO = {
  name: 'TO-GEN SOLAR AGRO',
  address: '3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil,',
  city: 'Madurai – 625301',
  state: 'Tamil Nadu',
  gstin: '33BJWPA4500M1Z6',
  phone: '+91 63803 29294',
  email: 'info@togensolar.com',
};

import logoAsset from '../assets/images/logo.png';
import signAsset from '../assets/images/sign.png';

export interface ReceiptItem {
  slNo?: number;
  description: string;
  hsn?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number; // paise
  taxRate?: number;   // percent
  total?: number;     // paise
}

export interface ReceiptData {
  receiptNo: string;
  paymentDate: string;   // Paid date
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  amount: number;        // paise (amount paid in this receipt)
  paymentMethod: string;
  transactionId?: string;
  invoiceRef?: string;
  invoiceDate?: string;  // Invoice issue date
  notes?: string;

  // Financial summary from invoice
  taxableAmount?: number;   // paise
  taxAmount?: number;       // paise
  invoiceTotal?: number;    // paise
  totalPaidToDate?: number; // paise
  balanceDue?: number;      // paise

  // Products breakdown
  items?: ReceiptItem[];
  totalProductCount?: number;
  totalQuantity?: number;
}

function fmt(paise?: number | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) return '₹0.00';
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

export async function generateReceiptHtml(data: ReceiptData): Promise<string> {
  const [logo, sign] = await Promise.all([
    toBase64(logoAsset || '/src/assets/images/logo.png'),
    toBase64(signAsset || '/src/assets/images/sign.png'),
  ]);

  const amtWords = numberToWords(data.amount);
  const items = data.items || [];
  const hasItems = items.length > 0;
  const productCount = data.totalProductCount ?? items.length;
  const totalQty = data.totalQuantity ?? items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  // Financial calculations
  const invoiceTotal = data.invoiceTotal ?? data.amount;
  const taxableAmount = data.taxableAmount ?? (invoiceTotal - (data.taxAmount || 0));
  const taxAmount = data.taxAmount ?? 0;
  const balanceDue = data.balanceDue !== undefined ? data.balanceDue : Math.max(0, invoiceTotal - (data.totalPaidToDate ?? data.amount));
  const isSettled = balanceDue <= 0;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; font-size: 12px; color: #0f172a; background: #ffffff; width: 800px; padding: 34px 38px; box-sizing: border-box; position: relative;">

    <div style="position: relative; z-index: 1;">
      <!-- HEADER SECTION -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
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
            <div style="font-size: 28px; font-weight: 900; color: #15803d; letter-spacing: -0.5px; text-transform: uppercase; margin-bottom: 4px;">PAYMENT RECEIPT</div>
            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Receipt # ${data.receiptNo}</div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-left: auto;">
              <tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 8px 2px 0; text-align: right;">Paid Date:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${data.paymentDate}</td>
              </tr>
              ${data.invoiceRef ? `<tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 8px 2px 0; text-align: right;">Invoice Ref:</td>
                <td style="font-weight: 700; color: #0284c7; padding: 2px 0; text-align: right;">${data.invoiceRef}</td>
              </tr>` : ''}
              ${data.invoiceDate ? `<tr>
                <td style="color: #475569; font-weight: 600; padding: 2px 8px 2px 0; text-align: right;">Invoice Date:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 2px 0; text-align: right;">${data.invoiceDate}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      <!-- CUSTOMER & PAYMENT METHOD INFO -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <div style="background: #ffffff; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 14px 16px; min-height: 82px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Received From</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${data.customerName}</div>
              ${data.customerAddress ? `<div style="font-size: 12px; color: #334155; line-height: 1.4; font-weight: 500;">${data.customerAddress}${data.customerCity ? `, ${data.customerCity}` : ''}</div>` : ''}
              ${data.customerPhone ? `<div style="margin-top: 5px; font-size: 11.5px; color: #166534; font-weight: 700;">📞 ${data.customerPhone}</div>` : ''}
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 10px;">
            <div style="background: #ffffff; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 14px 16px; min-height: 82px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <div style="font-size: 11px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Payment Method & Transaction</div>
              <table style="width: 100%; font-size: 11.5px;">
                <tr>
                  <td style="color: #475569; font-weight: 600; padding: 3px 0;">Method:</td>
                  <td style="font-weight: 700; color: #0f172a; padding: 3px 0; text-align: right;">${data.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="color: #475569; font-weight: 600; padding: 3px 0;">Transaction ID / Ref:</td>
                  <td style="font-weight: 700; color: #0f172a; padding: 3px 0; text-align: right; font-family: 'Consolas', 'Courier New', monospace;">${data.transactionId || '-'}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>

      <!-- HERO PAYMENT BANNER -->
      <div style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #ffffff; border-radius: 8px; padding: 16px 22px; margin-bottom: 22px; box-shadow: 0 4px 10px rgba(22,163,74,0.18);">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #dcfce7; margin-bottom: 4px;">AMOUNT RECEIVED IN THIS PAYMENT</div>
              <div style="font-size: 12px; color: #ffffff; font-weight: 600; line-height: 1.4;">${amtWords}</div>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 45%;">
              <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">${fmt(data.amount)}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- PRODUCTS / ITEMS BREAKDOWN (FROM INVOICE) -->
      ${hasItems ? `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Product / Service Details (Invoice Items)</div>
          <div style="font-size: 11px; font-weight: 700; color: #334155; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 9px; border-radius: 4px;">
            Total Items: ${productCount} | Total Qty: ${totalQty}
          </div>
        </div>

        <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1.5px solid #94a3b8; box-sizing: border-box;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="padding: 9px 6px; text-align: center; border: 1px solid #1e40af; width: 5%; font-weight: 700; white-space: nowrap;">#</th>
              <th style="padding: 9px 8px; text-align: left; border: 1px solid #1e40af; width: 38%; font-weight: 700;">Item Description</th>
              <th style="padding: 9px 6px; text-align: center; border: 1px solid #1e40af; width: 11%; font-weight: 700; white-space: nowrap;">HSN/SAC</th>
              <th style="padding: 9px 6px; text-align: center; border: 1px solid #1e40af; width: 8%; font-weight: 700; white-space: nowrap;">Qty</th>
              <th style="padding: 9px 6px; text-align: center; border: 1px solid #1e40af; width: 8%; font-weight: 700; white-space: nowrap;">Unit</th>
              <th style="padding: 9px 8px; text-align: right; border: 1px solid #1e40af; width: 15%; font-weight: 700; white-space: nowrap;">Rate</th>
              <th style="padding: 9px 8px; text-align: right; border: 1px solid #1e40af; width: 15%; font-weight: 700; white-space: nowrap;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
              <tr style="border-bottom: 1px solid #cbd5e1; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
                <td style="padding: 8px 6px; text-align: center; color: #1e293b; border: 1px solid #cbd5e1; font-weight: 600; vertical-align: middle; white-space: nowrap;">${it.slNo || idx + 1}</td>
                <td style="padding: 8px 8px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.45;">${it.description}</td>
                <td style="padding: 8px 6px; text-align: center; color: #334155; font-size: 11px; border: 1px solid #cbd5e1; font-weight: 600; vertical-align: middle; white-space: nowrap;">${it.hsn || '-'}</td>
                <td style="padding: 8px 6px; text-align: center; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">${it.quantity}</td>
                <td style="padding: 8px 6px; text-align: center; font-weight: 600; color: #334155; border: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">${it.unit || '-'}</td>
                <td style="padding: 8px 8px; text-align: right; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">${fmt(it.unitPrice)}</td>
                <td style="padding: 8px 8px; text-align: right; font-weight: 800; color: #0f172a; border: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">${fmt(it.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- FINANCIAL SUMMARY & REMAINING BALANCE -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 18px;">
            ${hasItems ? `
              <div style="background: #f8fafc; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 12px 14px; margin-bottom: 12px;">
                <div style="font-size: 10.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Product Summary</div>
                <div style="display: flex; gap: 20px; font-size: 12px;">
                  <div>
                    <span style="color: #475569; font-weight: 500;">Total Products:</span>
                    <strong style="color: #0f172a; margin-left: 4px; font-weight: 700;">${productCount} items</strong>
                  </div>
                  <div>
                    <span style="color: #475569; font-weight: 500;">Total Quantity:</span>
                    <strong style="color: #0f172a; margin-left: 4px; font-weight: 700;">${totalQty} units</strong>
                  </div>
                </div>
              </div>
            ` : ''}

            ${data.notes ? `
              <div style="background: #f8fafc; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 12px 14px;">
                <div style="font-size: 10.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Notes & Remarks</div>
                <div style="font-size: 11.5px; color: #334155; line-height: 1.5; font-weight: 500;">${data.notes}</div>
              </div>
            ` : `<div style="font-size: 11.5px; color: #475569; font-style: italic; padding: 8px 0; font-weight: 500;">Payment received with thanks. Official computer-generated receipt.</div>`}
          </td>

          <td style="width: 50%; vertical-align: top;">
            <div style="background: #ffffff; border: 1.5px solid #94a3b8; border-radius: 8px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                ${data.invoiceTotal ? `
                <tr>
                  <td style="padding: 4px 0; color: #475569; font-weight: 600;">Taxable Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a;">${fmt(taxableAmount)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #475569; font-weight: 600;">GST / Tax Amount:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a;">${fmt(taxAmount)}</td>
                </tr>
                <tr style="border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                  <td style="padding: 7px 0; font-weight: 800; color: #0f172a; font-size: 12.5px;">Invoice Total:</td>
                  <td style="padding: 7px 0; text-align: right; font-weight: 800; color: #0f172a; font-size: 12.5px;">${fmt(invoiceTotal)}</td>
                </tr>
                ` : ''}

                <tr>
                  <td style="padding: 6px 0; color: #15803d; font-weight: 800; font-size: 12.5px;">Paid in this Receipt:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 900; color: #15803d; font-size: 13.5px;">${fmt(data.amount)}</td>
                </tr>

                ${data.totalPaidToDate !== undefined ? `
                <tr>
                  <td style="padding: 4px 0; color: #475569; font-weight: 600;">Total Paid to Date:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a;">${fmt(data.totalPaidToDate)}</td>
                </tr>
                ` : ''}

                <tr style="border-top: 1.5px solid #94a3b8;">
                  <td style="padding: 8px 0; font-weight: 800; color: ${isSettled ? '#15803d' : '#dc2626'}; font-size: 13.5px;">
                    Remaining Balance Due:
                  </td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 900; color: ${isSettled ? '#15803d' : '#dc2626'}; font-size: 15px;">
                    ${isSettled ? '₹0.00 (Fully Settled)' : fmt(balanceDue)}
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>

      <!-- SIGNATURE & FOOTER -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
        <tr>
          <td style="width: 60%; vertical-align: bottom; font-size: 11px; color: #475569;">
            <div style="font-weight: 600; color: #334155;">Thank you for choosing ${COMPANY_INFO.name}.</div>
            <div style="margin-top: 2px; font-size: 10.5px; color: #64748b;">This is a system generated payment receipt.</div>
          </td>
          <td style="width: 40%; vertical-align: bottom; text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 4px;">For ${COMPANY_INFO.name}</div>
            ${sign ? `<img src="${sign}" style="max-height: 48px; max-width: 140px; object-fit: contain; margin: 2px 0 2px auto; display: block;" alt="Signature" />` : `<div style="height: 42px; border-bottom: 1.5px solid #94a3b8; width: 140px; margin: 4px 0 4px auto;"></div>`}
            <div style="font-size: 10.5px; color: #475569; font-weight: 600;">Authorised Signatory</div>
          </td>
        </tr>
      </table>
      
    </div>
  </div>`;

  return html;
}

export async function generateReceiptPDF(data: ReceiptData, filename?: string): Promise<void> {
  const html = await generateReceiptHtml(data);

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
    
    // Lossless PNG eliminates all JPEG compression blur and fuzzy text artifacts
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const renderedH = (canvas.height * pdfW) / canvas.width;

    if (renderedH > pdfH) {
      // Proportional fit ensures 0 cropping of footer, balance or signature
      const scale = (pdfH - 6) / renderedH;
      const fitW = pdfW * scale;
      const fitH = renderedH * scale;
      const offsetX = (pdfW - fitW) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, 3, fitW, fitH, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, renderedH, undefined, 'FAST');
    }
    
    pdf.save(filename ?? `Payment_Receipt_${data.receiptNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
