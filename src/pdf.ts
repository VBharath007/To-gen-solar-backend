import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let sharedBrowser: Browser | null = null;
let workerContext: BrowserContext | null = null;
let workerPage: Page | null = null;
let printContext: BrowserContext | null = null;
let printPage: Page | null = null;
let initPromise: Promise<void> | null = null;

// Lightweight mutex to serialize PDF requests safely across warm worker & print pages
let lockQueue = Promise.resolve();

async function resetBrowser() {
  try { await workerPage?.close(); } catch {}
  try { await workerContext?.close(); } catch {}
  try { await printPage?.close(); } catch {}
  try { await printContext?.close(); } catch {}
  try { await sharedBrowser?.close(); } catch {}
  workerPage = null;
  workerContext = null;
  printPage = null;
  printContext = null;
  sharedBrowser = null;
  initPromise = null;
}

async function ensureWarmInstance(): Promise<{ worker: Page; print: Page }> {
  if (
    sharedBrowser &&
    sharedBrowser.isConnected() &&
    workerPage &&
    !workerPage.isClosed() &&
    printPage &&
    !printPage.isClosed()
  ) {
    return { worker: workerPage, print: printPage };
  }

  if (initPromise) {
    await initPromise;
    if (workerPage && printPage) {
      return { worker: workerPage, print: printPage };
    }
  }

  initPromise = (async () => {
    await resetBrowser();

    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    sharedBrowser.on('disconnected', () => {
      resetBrowser().catch(() => {});
    });

    // 1. Warm generator worker page (executes pdf-browser.js)
    workerContext = await sharedBrowser.newContext({
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });
    workerPage = await workerContext.newPage();
    workerPage.setDefaultTimeout(30000);
    await workerPage.route('**/*', (route) =>
      route.request().url().startsWith('data:') ? route.continue() : route.abort()
    );
    await workerPage.addInitScript(
      'var __name = (t, v) => t; window.__name = (t, v) => t; globalThis.__name = (t, v) => t;'
    );
    await workerPage.setContent(
      '<html><head><script>var __name = (t, v) => t; window.__name = (t, v) => t; globalThis.__name = (t, v) => t;</script></head><body></body></html>'
    );
    let pdfBrowserPath = existsSync(resolve(currentDir, '../dist/pdf-browser.js'))
      ? resolve(currentDir, '../dist/pdf-browser.js')
      : (existsSync(resolve('server/dist/pdf-browser.js'))
          ? resolve('server/dist/pdf-browser.js')
          : resolve('dist/pdf-browser.js'));

    if (!existsSync(pdfBrowserPath)) {
      console.log('[PDF] dist/pdf-browser.js not found, auto-building with esbuild...');
      const targetOut = resolve(currentDir, '../dist/pdf-browser.js');
      const { build } = await import('esbuild');
      await build({
        entryPoints: [resolve(currentDir, 'pdf-entry.ts')],
        outfile: targetOut,
        bundle: true,
        platform: 'browser',
        format: 'iife',
        globalName: 'SolarPdf',
        loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl' },
        tsconfig: resolve(currentDir, '../tsconfig.json'),
      });
      pdfBrowserPath = targetOut;
      console.log('[PDF] dist/pdf-browser.js built successfully at:', pdfBrowserPath);
    }

    await workerPage.addScriptTag({ path: pdfBrowserPath });

    // 2. Warm print page (pure HTML/CSS to PDF with JavaScript disabled for speed & security)
    printContext = await sharedBrowser.newContext({
      javaScriptEnabled: false,
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });
    printPage = await printContext.newPage();
    printPage.setDefaultTimeout(30000);
    await printPage.route('**/*', (route) =>
      route.request().url().startsWith('data:') ? route.continue() : route.abort()
    );

    // Warm up Blink layout and font rendering pipeline
    try {
      await printPage.setContent('<html><body></body></html>', { waitUntil: 'load' });
      await printPage.pdf({ format: 'A4' });
    } catch {}
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }

  return { worker: workerPage!, print: printPage! };
}

export async function prewarmPdfService(): Promise<void> {
  try {
    await ensureWarmInstance();
  } catch (err) {
    console.error('Failed to prewarm PDF service:', err);
  }
}

export async function renderPdf(module: string, payload: any): Promise<Buffer> {
  // Acquire sequential lock so concurrent requests cleanly queue without state conflict
  let releaseLock: () => void = () => {};
  const currentLock = new Promise<void>((res) => {
    releaseLock = res;
  });
  const prevLock = lockQueue;
  lockQueue = lockQueue.then(() => currentLock);

  await prevLock;

  try {
    const { worker, print } = await ensureWarmInstance();

    // 1. Generate HTML in warm worker
    const html = await worker.evaluate(async ({ module, payload }) => {
      const w = window as any,
        p = w.SolarPdf,
        r = payload.record,
        lists = payload.lists;

      // Escape untrusted text before inserting it into the legacy HTML templates
      const clean = (v: any): any => {
        if (Array.isArray(v)) return v.map(clean);
        if (v && typeof v === 'object')
          return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
        if (
          typeof v !== 'string' ||
          /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v)
        )
          return v;
        if (v.trim().startsWith('{') || v.trim().startsWith('[')) {
          try {
            return JSON.stringify(clean(JSON.parse(v)));
          } catch {}
        }
        return v
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      };

      const record = clean(r);
      w.__accounts = clean(lists?.accounts || []);
      w.desktop = Object.fromEntries(
        Object.entries(lists || {}).map(([k, values]: any) => [
          k,
          {
            list: async () => ({ success: true, data: clean(values) }),
            get: async (id: any) => ({
              success: true,
              data: clean(values.find((x: any) => x.id === id)),
            }),
          },
        ])
      );

      if (module === 'quotations') {
        return (await p.generateQuotationPdfPagesHtml(record)).pagesHtml.join('');
      }
      if (module === 'projects') {
        return p.generateProjectHtml ? await p.generateProjectHtml(record) : p.generateProjectPDF(record);
      }
      if (module === 'reports') {
        return p.generateProjectsAnalyticsReportHtml
          ? await p.generateProjectsAnalyticsReportHtml(record, payload.summary)
          : p.generateProjectsAnalyticsReportPDF(record, payload.summary);
      }

      const formatDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-IN') : '');
      if (module === 'invoices') {
        const bank =
          w.__accounts.find((x: any) => x.id === r.bank_account_id) ||
          w.__accounts.find((x: any) => x.isPrimary) ||
          w.__accounts[0];
        if (!bank)
          throw new Error('Add and select your bank account before downloading invoices');
        const invoiceData = {
          invoiceType: record.invoice_type,
          invoiceNo: record.reference,
          invoiceDate: formatDate(record.issue_date),
          dueDate: formatDate(record.due_date),
          placeOfSupply: record.place_of_supply,
          billTo: {
            name: record.customer_name,
            address: record.customer_address,
            city: record.customer_city,
            pincode: record.customer_pincode,
            gstin: record.customer_gstin,
            phone: record.customer_phone,
          },
          items: (record.lines || []).map((l: any) => ({
            description: l.description,
            hsn: l.hsn_sac,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unit_price,
            gstRate: l.tax_rate,
            total: l.taxable_value,
          })),
          notes: record.notes,
          bankDetails: {
            name: bank.bankName,
            branch: bank.branchName,
            accountHolder: bank.accountName,
            accountNo: bank.accountNumber,
            ifsc: bank.ifscCode,
            upiId: bank.upiId,
          },
        };
        return p.generateTaxInvoiceHtml
          ? await p.generateTaxInvoiceHtml(invoiceData)
          : p.generateTaxInvoicePDF(invoiceData);
      }

      const inv = clean(payload.linkedInvoice);
      const items = (inv?.lines || []).map((l: any, i: number) => ({
        slNo: i + 1,
        description: l.description,
        hsn: l.hsn_sac,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price,
        taxRate: l.tax_rate,
        total: l.line_total || l.taxable_value,
      }));

      const receiptData = {
        receiptNo: record.reference,
        paymentDate: formatDate(record.payment_date),
        customerName: record.customer_name,
        customerPhone: inv?.customer_phone,
        customerAddress: inv?.customer_address,
        customerCity: inv?.customer_city,
        amount: record.amount,
        paymentMethod: record.payment_method,
        transactionId: record.transaction_id,
        invoiceRef: inv?.reference,
        invoiceDate: formatDate(inv?.issue_date),
        notes: record.notes,
        taxableAmount: inv?.amount,
        taxAmount: inv?.tax_amount,
        invoiceTotal: inv?.total_amount,
        totalPaidToDate: inv?.amount_paid,
        balanceDue: inv ? Math.max(0, inv.total_amount - inv.amount_paid) : undefined,
        items,
        totalProductCount: items.length,
        totalQuantity: items.reduce((sum: number, x: any) => sum + x.quantity, 0),
      };

      return p.generateReceiptHtml
        ? await p.generateReceiptHtml(receiptData)
        : p.generateReceiptPDF(receiptData);
    }, { module, payload });

    // 2. High-quality vector rendering in warm print page
    const printDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    img {
      image-rendering: -webkit-optimize-contrast;
      image-rendering: high-quality;
    }
    .quotation-pdf-page {
      width: 794px;
      height: 1123px;
      break-after: page;
      page-break-after: always;
      overflow: hidden;
      transform: none !important;
      backface-visibility: visible !important;
    }
    .quotation-pdf-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    await print.setContent(printDoc, { waitUntil: 'load' });

    const pdfBuffer = await print.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    // Clear content to free up memory for next print
    await print.setContent('<html><body></body></html>', { waitUntil: 'domcontentloaded' });

    return pdfBuffer;
  } catch (err) {
    // If an error occurred with browser/pages, reset so next call recovers automatically
    await resetBrowser();
    throw err;
  } finally {
    releaseLock();
  }
}
