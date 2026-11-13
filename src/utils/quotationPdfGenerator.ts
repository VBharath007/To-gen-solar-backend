/**
 * ToGen Solar CRM — Customer Quotation Proposal PDF Generator
 * 
 * Layout & Aesthetics:
 * - Page 1: Cover Proposal (Title, Proposed By To-Gen Solar Agro, Proposed To Dynamic Customer & Site)
 * - Page 2: Project Details Table (Clean dynamic specification table)
 * - Page 3: Technical Details Table (BOM) + System Block Diagram
 * - Page 4: Commercials Table + Commercial Terms & Conditions
 * - Page 5: Important Notes + Disclaimer
 * - Page 6: Compulsory "CUSTOMER REQUIRED DOCUMENTS" Dedicated Page (Official Sample/Dummy Table & Guidelines)
 * - [Dedicated Page]: Project Site & Customer Uploaded Photographs (Separate Page, 0 Cropping, Centered; Omitted if 0 images)
 * - Page 7: Project Implementation Schedule (Expanded, High-Resolution, Crystal Clear)
 * - Page 8: PM Surya Ghar Work Process & Compulsory P. Alagu Pandi Signature Block
 */

import headerBannerAsset from '../assets/images/quotation/header_banner.png';
import systemBlockDiagramAsset from '../assets/images/quotation/system_block_diagram_hr.png';
import implScheduleAsset from '../assets/images/quotation/implementation_schedule_hr.png';
import workProcessAsset from '../assets/images/quotation/work_process_hr.png';
import signAsset from '../assets/images/sign.png';
import logoAsset from '../assets/images/logo.png';
import canaraQrAsset from '../assets/images/canara_qr.png';
import sampleAadhaarAsset from '../assets/images/quotation/sample_aadhaar.png';
import samplePanAsset from '../assets/images/quotation/sample_pan.png';
import sampleEbBillAsset from '../assets/images/quotation/sample_eb_bill.png';
import samplePropertyTaxAsset from '../assets/images/quotation/sample_property_tax.jpg';
import sampleBankPassbookAsset from '../assets/images/quotation/sample_bank_passbook.png';
import samplePhotoAsset from '../assets/images/quotation/sample_photo.png';
import tangedcoLogoAsset from '../assets/images/quotation/tangedco_logo.png';
import mnreLogoAsset from '../assets/images/quotation/mnre_logo.png';
import bankingPartnersHdAsset from '../assets/images/quotation/banking_partners_hd.jpg';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Quotation } from '@shared/types/quotation.types';
import { getBankAccountById, getPrimaryBankAccount } from './bankAccountStorage';

export interface QuotationPdfData {
  quotationType?: string;
  quotationNo: string;
  quotationDate?: string;
  customerName: string;
  siteAddress: string;
  solutionProvider?: string;
  mountingStructure?: string;
  panelType?: string;
  spaceRequired?: string;
  proposedSystem?: string;
  pvModuleCapacity?: string;
  inverterCapacity?: string;
  commercialDescription?: string;
  totalPrice?: string;
  subtotal?: number;
  total_tax?: number;
  total_discount?: number;
  grand_total?: number;
  panelMake?: string;
  panelSpecs?: string;
  panelQty?: string;
  inverterMake?: string;
  inverterSpecs?: string;
  inverterQty?: string;
  structureSpecs?: string;
  structureQty?: string;
  images?: Array<string | { url: string; caption?: string }>;
  payment_terms?: string;
  systemType?: string;
  validity_days?: number;
  state_subsidy?: number;
  central_subsidy?: number;
  bank_account_id?: string;
  items?: any[];
  businessCategory?: string;
  batteryType?: string;
  batteryCapacity?: number;
  batteryQuantity?: number;
  capacity_kw?: any;
  system_capacity_kw?: any;
  systemCapacity?: number | string;
  technicalDetails?: any;
  tax_inclusive?: boolean;
  manual_tax_rate?: number;
  discount_percent?: number;
}

async function toBase64(url: string): Promise<string> {
  if (!url) return '';
  if (typeof url === 'string' && url.startsWith('data:')) return url;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return url;
  }
  // 1. Try direct fetch to obtain exact lossless raw binary asset bytes without canvas resampling
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // Fall back to image canvas approach if fetch is restricted
  }

  // 2. High-quality Image + Canvas fallback
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d', { alpha: true });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } else {
          resolve(url);
        }
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

function formatQuoteDate(d?: string | Date): string {
  if (!d) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Dynamically renders a DEDICATED SEPARATE A4 PAGE for customer uploaded project images.
 * - If no images are uploaded, returns an empty string (no empty page generated).
 * - Images are displayed with `object-fit: contain !important;` and `width: auto; height: auto;` so they are NEVER cropped.
 * - Perfectly centered horizontally and vertically with balanced padding and elegant brand frames.
 */
function renderCustomerImagesPage(
  images: Array<string | { url: string; caption?: string }> | undefined,
  renderTopBar: () => string,
  renderHeader: () => string,
  renderWatermark: () => string,
  renderFooter: () => string,
  pageBaseStyle: string
): string {
  if (!images || images.length === 0) {
    return '';
  }

  const validImages = images
    .map((item, idx) => {
      const url = typeof item === 'string' ? item : item?.url;
      let label = typeof item === 'object' && item?.caption ? item.caption : '';
      if (!label) {
        if (idx === 0) label = 'Rooftop / Solar Site Area';
        else if (idx === 1) label = 'EB Meter Board';
        else if (idx === 2) label = 'Inverter Installation Area';
        else label = `Site Photograph ${idx + 1}`;
      }
      return { url: url ? url.trim() : '', label };
    })
    .filter(img => img.url.length > 0);

  if (validImages.length === 0) {
    return '';
  }

  let imagesGridHtml = '';

  if (validImages.length === 1) {
    // 1 Image: Large showcase card with ample room, zero cropping, centered
    imagesGridHtml = `
      <div style="width: 100%; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
        <div style="width: 100%; height: 720px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 16px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
          <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
            <img src="${validImages[0].url}" style="max-width: 100% !important; max-height: 640px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${validImages[0].label}" />
          </div>
          <div style="margin-top: 12px; font-size: 12.5px; font-weight: 800; color: #0f2b48; text-transform: uppercase; letter-spacing: 0.6px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 6px 20px; border-radius: 20px;">
            ${validImages[0].label}
          </div>
        </div>
      </div>
    `;
  } else if (validImages.length === 2) {
    // 2 Images: 2 columns side by side, tall cards, zero cropping, centered
    imagesGridHtml = `
      <div style="width: 100%; flex: 1; display: flex; flex-direction: row; gap: 16px; justify-content: center; align-items: center; box-sizing: border-box;">
        ${validImages.map((img) => `
          <div style="flex: 1; height: 720px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 14px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
            <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
              <img src="${img.url}" style="max-width: 100% !important; max-height: 640px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${img.label}" />
            </div>
            <div style="margin-top: 10px; font-size: 11.5px; font-weight: 800; color: #0f2b48; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 5px 14px; border-radius: 16px;">
              ${img.label}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (validImages.length === 3) {
    // 3 Images: 1 top horizontal showcase card + 2 bottom side-by-side cards (Standard 3 slots)
    // Perfectly fits 1123px page height with zero cropping and centered alignment
    imagesGridHtml = `
      <div style="width: 100%; flex: 1; display: flex; flex-direction: column; gap: 14px; justify-content: center; align-items: center; box-sizing: border-box;">
        <!-- Top Image: Rooftop / Site Area -->
        <div style="width: 100%; height: 355px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 12px 16px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
          <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
            <img src="${validImages[0].url}" style="max-width: 100% !important; max-height: 290px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${validImages[0].label}" />
          </div>
          <div style="margin-top: 8px; font-size: 11.5px; font-weight: 800; color: #0f2b48; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 4px 16px; border-radius: 14px;">
            ${validImages[0].label}
          </div>
        </div>

        <!-- Bottom Row: 2 Images Side-by-Side (EB Meter Board & Inverter Area) -->
        <div style="width: 100%; height: 355px; display: flex; flex-direction: row; gap: 14px; justify-content: center; align-items: center; box-sizing: border-box;">
          <div style="flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 12px 14px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
            <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
              <img src="${validImages[1].url}" style="max-width: 100% !important; max-height: 290px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${validImages[1].label}" />
            </div>
            <div style="margin-top: 8px; font-size: 11px; font-weight: 800; color: #0f2b48; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 4px 14px; border-radius: 14px;">
              ${validImages[1].label}
            </div>
          </div>

          <div style="flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 12px 14px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
            <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
              <img src="${validImages[2].url}" style="max-width: 100% !important; max-height: 290px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${validImages[2].label}" />
            </div>
            <div style="margin-top: 8px; font-size: 11px; font-weight: 800; color: #0f2b48; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 4px 14px; border-radius: 14px;">
              ${validImages[2].label}
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // 4 or more images: 2x2 grid
    imagesGridHtml = `
      <div style="width: 100%; flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-content: center; box-sizing: border-box;">
        ${validImages.slice(0, 4).map((img) => `
          <div style="height: 355px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #ffffff; border: 1.5px solid #d9e6ed; border-radius: 10px; padding: 12px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(15, 43, 72, 0.05);">
            <div style="flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;">
              <img src="${img.url}" style="max-width: 100% !important; max-height: 290px !important; width: auto !important; height: auto !important; object-fit: contain !important; display: block; margin: auto; border-radius: 6px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="${img.label}" />
            </div>
            <div style="margin-top: 8px; font-size: 11px; font-weight: 800; color: #0f2b48; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; background: #edf6f9; border: 1px solid #d9e6ed; padding: 4px 14px; border-radius: 14px;">
              ${img.label}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; width: 100%;">
        <div>
          <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
            <span style="color: #475569; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">SITE PHOTOGRAPHS</span>
          </div>

          <div style="background: #edf6f9; border-radius: 6px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="width: 5px; height: 30px; background: #008289; border-radius: 3px; flex-shrink: 0;"></div>
            <h2 style="margin: 0; color: #0f2b48; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">PROJECT SITE / INSTALLATION PHOTOGRAPHS</h2>
          </div>

          <div style="color: #64748b; font-size: 10.5px; line-height: 1.5; margin: 0 0 12px 2px;">
            Photographs uploaded during technical feasibility assessment for rooftop mounting, meter connectivity, and inverter placement.
          </div>
        </div>

        ${imagesGridHtml}
      </div>

      ${renderFooter()}
    </div>
  `;
}

// Helpers for Page 4 Commercials Table Dynamic Product Descriptions
export function formatSystemTypeForCommercials(systemType?: string, businessCategory?: string): string {
  const cat = (businessCategory || '').replace(/&amp;/gi, '&').toUpperCase().trim();
  const isWaterPump = cat === 'SOLAR_WATERPUMP' || cat.includes('WATER PUMP') || cat.includes('WATERPUMP');
  const isStreetLight = cat === 'SOLAR_STREETLIGHT' || cat.includes('STREET LIGHT') || cat.includes('STREETLIGHT');
  const isCctv = cat === 'SOLAR_CCTV' || cat.includes('CCTV');
  const isIC = cat === 'SOLAR_IC' || cat.includes('I & C') || cat.includes('I&C') || cat.includes('INSTALLATION') || cat.includes('COMMISSIONING');

  if (isWaterPump) {
    return 'Water Pump System';
  }
  if (isStreetLight) {
    return 'Street Light System';
  }
  if (isCctv) {
    return 'CCTV System';
  }
  if (isIC) {
    return 'I&C Service';
  }

  if (!systemType || typeof systemType !== 'string' || !systemType.trim()) {
    return 'On-Grid System';
  }
  const clean = systemType.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('water pump') || lower.includes('waterpump')) {
    return 'Water Pump System';
  }
  if (lower.includes('street light') || lower.includes('streetlight')) {
    return 'Street Light System';
  }
  if (lower.includes('cctv')) {
    return 'CCTV System';
  }
  if (lower.includes('i&c') || lower.includes('installation') || lower.includes('commissioning')) {
    return 'I&C Service';
  }
  if (lower === 'on-grid' || lower === 'on grid' || lower === 'ongrid') {
    return 'On-Grid System';
  }
  if (lower === 'off-grid' || lower === 'off grid' || lower === 'offgrid') {
    return 'Off-Grid System';
  }
  if (lower === 'hybrid') {
    return 'Hybrid System';
  }
  if (/system$/i.test(clean)) {
    return clean;
  }
  return `${clean} System`;
}

export function getProductDetailsForCommercials(item: any, productLookup?: any) {
  let brand = '';
  let model = '';
  let specs = '';

  const p = productLookup || (item && item._product) || null;

  if (p) {
    if (p.brand) brand = String(p.brand).trim();
    if (p.model) model = String(p.model).trim();
    if (p.specs) specs = String(p.specs).trim();
  }

  if (!brand && item?.brand) brand = String(item.brand).trim();
  if (!model && item?.model) model = String(item.model).trim();
  if (!specs && item?.specs) specs = String(item.specs).trim();

  // If brand or model not yet isolated, check item.name
  if (!model && item?.name) {
    const rawName = String(item.name).trim();
    if (brand && rawName.toLowerCase().startsWith(brand.toLowerCase())) {
      model = rawName.substring(brand.length).trim();
    } else {
      model = rawName;
    }
  }

  // If specs not yet isolated, check item.description
  if (!specs && item?.description) {
    specs = String(item.description).trim();
  }

  // Clean label prefixes if present in model or specs
  brand = brand.replace(/^(brand|make):\s*/i, '').trim();
  model = model.replace(/^(brand|make|model|product name|name):\s*/i, '').trim();
  specs = specs.replace(/^(specifications|specs|specification|desc|description):\s*/i, '').trim();

  // If item.name contains "Brand: ... Model: ..."
  if (item?.name && /brand:|model:/i.test(item.name)) {
    const brandMatch = item.name.match(/brand:\s*([^,\n]+?)(?=\s+model:|$)/i);
    const modelMatch = item.name.match(/model:\s*(.+)$/i);
    if (brandMatch && !brand) brand = brandMatch[1].trim();
    if (modelMatch) model = modelMatch[1].trim();
  }

  // Flatten any bullets or newlines into a continuous natural string without stripping hyphens in words like Half-Cut
  specs = specs
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/(^|,\s*)[•*]\s*/g, '$1')
    .replace(/\s*,\s*,\s*/g, ', ')
    .trim();

  // Combine brand and model cleanly without repeating brand
  let brandAndModel = '';
  if (brand && model) {
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      brandAndModel = model;
    } else {
      brandAndModel = `${brand} ${model}`;
    }
  } else if (brand) {
    brandAndModel = brand;
  } else if (model) {
    brandAndModel = model;
  } else {
    brandAndModel = 'Solar Equipment';
  }

  // Strip trailing/leading punctuation
  brandAndModel = brandAndModel.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
  let cleanSpecs = specs.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();

  return { brand, model, specs: cleanSpecs, brandAndModel };
}

export function generateCommercialProductDescription(
  item: any,
  systemType?: string,
  productLookup?: any,
  businessCategory?: string
): string {
  const sysTypeStr = formatSystemTypeForCommercials(systemType, businessCategory);
  const details = getProductDetailsForCommercials(item, productLookup);

  const fullSysLabel = sysTypeStr.toLowerCase().startsWith('solar') ? sysTypeStr : `Solar ${sysTypeStr}`;
  const baseText = `Design, Engineering, Supply and Commissioning of ${fullSysLabel} – ${details.brandAndModel}`;
  if (details.specs) {
    const cleanSpecsWithoutTrailingDot = details.specs.replace(/\.+$/, '');
    return `${baseText}, ${cleanSpecsWithoutTrailingDot}.`;
  }
  return `${baseText}.`;
}

interface StaticAssets {
  headerBanner: string;
  systemBlockDiagram: string;
  implSchedule: string;
  workProcess: string;
  signImg: string;
  logoImg: string;
  canaraQrImg: string;
  sampleAadhaar: string;
  samplePan: string;
  sampleEbBill: string;
  samplePropertyTax: string;
  sampleBankPassbook: string;
  samplePhoto: string;
  tangedcoLogo: string;
  mnreLogo: string;
  bankingPartnersHd: string;
}

let cachedStaticAssets: StaticAssets | null = null;
let cachedStaticAssetsPromise: Promise<StaticAssets> | null = null;

function loadStaticAssets(): Promise<StaticAssets> {
  if (cachedStaticAssets) {
    return Promise.resolve(cachedStaticAssets);
  }
  if (!cachedStaticAssetsPromise) {
    cachedStaticAssetsPromise = Promise.all([
      toBase64(headerBannerAsset),
      toBase64(systemBlockDiagramAsset),
      toBase64(implScheduleAsset),
      toBase64(workProcessAsset),
      toBase64(signAsset),
      toBase64(logoAsset),
      toBase64(canaraQrAsset),
      toBase64(sampleAadhaarAsset),
      toBase64(samplePanAsset),
      toBase64(sampleEbBillAsset),
      toBase64(samplePropertyTaxAsset),
      toBase64(sampleBankPassbookAsset),
      toBase64(samplePhotoAsset),
      toBase64(tangedcoLogoAsset),
      toBase64(mnreLogoAsset),
      toBase64(bankingPartnersHdAsset),
    ]).then(([
      headerBanner,
      systemBlockDiagram,
      implSchedule,
      workProcess,
      signImg,
      logoImg,
      canaraQrImg,
      sampleAadhaar,
      samplePan,
      sampleEbBill,
      samplePropertyTax,
      sampleBankPassbook,
      samplePhoto,
      tangedcoLogo,
      mnreLogo,
      bankingPartnersHd,
    ]) => {
      cachedStaticAssets = {
        headerBanner,
        systemBlockDiagram,
        implSchedule,
        workProcess,
        signImg,
        logoImg,
        canaraQrImg,
        sampleAadhaar,
        samplePan,
        sampleEbBill,
        samplePropertyTax,
        sampleBankPassbook,
        samplePhoto,
        tangedcoLogo,
        mnreLogo,
        bankingPartnersHd,
      };
      return cachedStaticAssets;
    });
  }
  return cachedStaticAssetsPromise;
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    loadStaticAssets().catch(() => {});
  }, 100);
}

export async function generateQuotationPdfPagesHtml(
  input: Quotation | QuotationPdfData
): Promise<{ pagesHtml: string[]; qData: QuotationPdfData }> {
  // Pre-load all high-res assets to base64 (cached in memory for 0ms subsequent loads)
  const {
    headerBanner,
    systemBlockDiagram,
    implSchedule,
    workProcess,
    signImg,
    logoImg,
    canaraQrImg,
    sampleAadhaar,
    samplePan,
    sampleEbBill,
    samplePropertyTax,
    sampleBankPassbook,
    samplePhoto,
    tangedcoLogo,
    mnreLogo,
    bankingPartnersHd,
  } = await loadStaticAssets();

  // Extract quotation-specific images
  const quotationImages: Array<string | { url: string; caption?: string }> = [];
  if ('reference' in input) {
    const q = input as Quotation;
    if (Array.isArray(q.sitePhotos)) {
      for (const p of q.sitePhotos) {
        const url = typeof p === 'string' ? p : ((p as any).data_url || (p as any).dataUrl || (p as any).url);
        const caption = typeof p === 'object' ? ((p as any).description || (p as any).caption || (p as any).name) : undefined;
        if (url && typeof url === 'string' && url.trim().length > 0) {
          quotationImages.push({ url: url.trim(), caption: caption || undefined });
        }
      }
    }
    if (Array.isArray((q as any).images)) {
      for (const img of (q as any).images) {
        if (typeof img === 'string' && img.trim().length > 0) {
          quotationImages.push({ url: img.trim() });
        } else if (img && typeof img === 'object' && (img as any).url) {
          quotationImages.push({ url: (img as any).url.trim(), caption: (img as any).caption });
        }
      }
    }
    // Also check localStorage if sitePhotos wasn't saved in SQLite
    if (quotationImages.length === 0 && q.id) {
      try {
        const saved = localStorage.getItem(`togen_quotation_site_photos_${q.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              const url = typeof p === 'string' ? p : (p.dataUrl || p.data_url || p.url);
              const caption = typeof p === 'object' ? (p.caption || p.name) : undefined;
              if (url && typeof url === 'string' && url.trim().length > 0) {
                quotationImages.push({ url: url.trim(), caption: caption || undefined });
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    // Also check draft if still 0
    if (quotationImages.length === 0) {
      try {
        const draft = localStorage.getItem('togen_quotation_site_photos_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              const url = typeof p === 'string' ? p : (p.dataUrl || p.data_url || p.url);
              const caption = typeof p === 'object' ? (p.caption || p.name) : undefined;
              if (url && typeof url === 'string' && url.trim().length > 0) {
                quotationImages.push({ url: url.trim(), caption: caption || undefined });
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } else {
    if (Array.isArray((input as QuotationPdfData).images)) {
      for (const img of (input as QuotationPdfData).images!) {
        if (typeof img === 'string' && img.trim().length > 0) {
          quotationImages.push({ url: img.trim() });
        } else if (img && typeof img === 'object' && (img as any).url) {
          quotationImages.push({ url: (img as any).url.trim(), caption: (img as any).caption });
        }
      }
    }
  }

  // Pre-fetch product and package database lookups concurrently
  const productLookupMap = new Map<number, any>();
  const packageLookupMap = new Map<number, any>();
  const quoteItems: any[] = ('reference' in input ? (input as any).items : (input as any).items) || [];

  if (typeof window !== 'undefined' && (window as any)?.desktop) {
    try {
      const [prodRes, pkgRes] = await Promise.all([
        (window as any).desktop.products?.list ? (window as any).desktop.products.list(true).catch(() => null) : null,
        (window as any).desktop.packages?.list ? (window as any).desktop.packages.list(true).catch(() => null) : null,
      ]);

      if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
        for (const p of prodRes.data) productLookupMap.set(p.id, p);
      }
      if (pkgRes && pkgRes.success && Array.isArray(pkgRes.data)) {
        for (const pkg of pkgRes.data) packageLookupMap.set(pkg.id, pkg);
      }

      // Pre-fetch package details concurrently for all package items
      if ((window as any).desktop.packages?.get && Array.isArray(quoteItems)) {
        const pkgIdsToFetch = Array.from(
          new Set(
            quoteItems
              .filter((it) => (it?.item_type === 'Package' || !it?.item_type) && it?.item_id)
              .map((it) => it.item_id)
          )
        );

        await Promise.all(
          pkgIdsToFetch.map(async (id) => {
            try {
              const detailRes = await (window as any).desktop.packages.get(id);
              if (detailRes && detailRes.success && detailRes.data) {
                packageLookupMap.set(id, detailRes.data);
              }
            } catch {
              // ignore
            }
          })
        );
      }
    } catch {
      // ignore
    }
  }

  const resolveItemMake = (it: any): string => {
    if (!it) return 'Reputed Quality';

    // 1. Direct brand/make on the item
    const directBrand = it.brand || it.make;
    if (directBrand && String(directBrand).trim() && String(directBrand).trim() !== '—') {
      return String(directBrand).trim();
    }

    // 2. Package lookup
    if (it.item_type === 'Package' || (it.item_id && packageLookupMap.has(it.item_id))) {
      const pkg = packageLookupMap.get(it.item_id);
      if (pkg) {
        const pkgDirect = pkg.brand || pkg.make;
        if (pkgDirect && String(pkgDirect).trim() && String(pkgDirect).trim() !== '—') {
          return String(pkgDirect).trim();
        }

        if (Array.isArray(pkg.items) && pkg.items.length > 0) {
          const brands = pkg.items
            .map((pi: any) => {
              const prod = pi.product || (pi.product_id ? productLookupMap.get(pi.product_id) : undefined);
              return prod?.brand || prod?.make;
            })
            .filter((b: any) => b && typeof b === 'string' && b.trim() && b.trim() !== '—');

          const uniqueBrands = Array.from(new Set(brands));
          if (uniqueBrands.length > 0) {
            return uniqueBrands.join(' / ');
          }
        }
      }

      // Check item / package name and description for known reputed brands
      const textToSearch = `${it.name || ''} ${it.description || ''} ${pkg?.name || ''} ${pkg?.description || ''}`;
      const foundKnownBrands: string[] = [];
      const knownSolarBrands = ['Waaree', 'Vikram', 'Adani', 'Growatt', 'Polycab', 'Havells', 'Luminous', 'Microtek', 'Schneider', 'ABB', 'Delta', 'Sungrow', 'GoodWe', 'Tata', 'Goldi', 'Inox'];
      for (const kb of knownSolarBrands) {
        if (new RegExp(`\\b${kb}\\b`, 'i').test(textToSearch)) {
          foundKnownBrands.push(kb);
        }
      }
      if (foundKnownBrands.length > 0) {
        return Array.from(new Set(foundKnownBrands)).join(' / ');
      }

      return 'Reputed Quality';
    }

    // 3. Product database lookup
    if (it.item_id && productLookupMap.has(it.item_id)) {
      const p = productLookupMap.get(it.item_id);
      const prodBrand = p?.brand || p?.make;
      if (prodBrand && String(prodBrand).trim() && String(prodBrand).trim() !== '—') {
        return String(prodBrand).trim();
      }
    }

    return 'Reputed Quality';
  };

  // Resolve dynamic vs default fields
  let qData: QuotationPdfData;

  if ('reference' in input) {
    const q = input as Quotation;
    let custName = q.customerName || (q as any).manual_customer_name || '';
    let siteAddr = q.siteAddress || (q as any).manual_customer_address || '';

    if ((!custName || !siteAddr) && q.customer_id && window?.desktop?.customers?.get) {
      try {
        const cRes = await window.desktop.customers.get(q.customer_id);
        if (cRes.success && cRes.data) {
          if (!custName) custName = cRes.data.name;
          if (!siteAddr) siteAddr = [cRes.data.address, cRes.data.city].filter(Boolean).join(', ');
        }
      } catch {
        // ignore fallback
      }
    }

    const tech = q.technicalDetails;
    const cat = (q.business_category || '').toUpperCase();
    const isStreetLight = cat === 'SOLAR_STREETLIGHT' || cat.includes('STREET LIGHT') || cat.includes('STREETLIGHT');
    const isWaterPump = cat === 'SOLAR_WATERPUMP' || cat.includes('WATER PUMP') || cat.includes('WATERPUMP');
    const isCctv = cat === 'SOLAR_CCTV' || cat.includes('CCTV');
    const isIC = cat === 'SOLAR_IC' || cat.includes('I & C') || cat.includes('I&C') || cat.includes('INSTALLATION') || cat.includes('COMMISSIONING');

    let capacityVal =
      (tech as any)?.capacity_kw ||
      tech?.system_capacity_kw ||
      tech?.dc_capacity_kwp ||
      (q as any).capacity_kw ||
      (q as any).system_capacity_kw ||
      (q as any).systemCapacity ||
      (input as any).capacity_kw ||
      (input as any).system_capacity_kw ||
      (input as any).systemCapacity;
    let proposedSystemStr = capacityVal ? `${capacityVal}KW` : '';

    let structureStr = [tech?.structure_type, tech?.structure_material ? `(${tech.structure_material})` : '']
      .filter(Boolean)
      .join(' ') || tech?.mounting_structure || '';

    let panelTypeStr = tech?.panel_specs || '';

    // Space Required: Only shown if category supports it (Rooftop / Standard) AND user explicitly entered a positive number
    const hasSpaceRequiredField = !isStreetLight && !isWaterPump && !isCctv && !isIC;
    const userArea = tech?.area_required_sqft || tech?.roof_area_sqft || tech?.shadow_free_sqft;
    let spaceReqStr: string | undefined = undefined;
    if (hasSpaceRequiredField && userArea && Number(userArea) > 0) {
      spaceReqStr = `SHADOW FREE - ${userArea} Sq.ft`;
    }

    let pvModuleCapacityStr = (tech?.panel_count && tech?.panel_wattage_w)
      ? `${tech.panel_wattage_w}W x ${tech.panel_count} Nos`
      : (tech?.panel_specs || '');

    let inverterCapStr = tech?.inverter_capacity_kw 
      ? `${tech.inverter_capacity_kw}KW x 1` 
      : (tech?.inverter_specs || '');

    if (isStreetLight) {
      proposedSystemStr = `${tech?.luminaire_wattage_w ? `${tech.luminaire_wattage_w}W ` : ''}Solar Street Light (${tech?.light_type || 'All-in-One'})`;
      structureStr = `${tech?.pole_material || 'GI'} Pole - ${tech?.pole_height_ft || '15'} Feet`;
      panelTypeStr = `${tech?.sl_panel_type || 'Mono'} Solar Panel`;
      pvModuleCapacityStr = tech?.luminaire_wattage_w ? `${tech.luminaire_wattage_w}W` : '';
      inverterCapStr = tech?.light_type || 'All-in-One Controller';
    } else if (isWaterPump) {
      capacityVal = tech?.pump_rating_kw || capacityVal;
      proposedSystemStr = `${tech?.pump_rating_kw ? `${tech.pump_rating_kw}KW ` : ''}Solar Water Pump (${tech?.pump_hp ? `${tech.pump_hp}HP` : ''})`;
      inverterCapStr = tech?.vfd_model ? `VFD Drive: ${tech.vfd_model}${tech?.connectivity ? ` (${tech.connectivity})` : ''}` : 'Solar Drive';
      structureStr = `${tech?.structure_material || 'GI'} Structure${tech?.structure_height ? ` (${tech.structure_height})` : ''}`;
    } else if (isCctv) {
      proposedSystemStr = `Solar CCTV Camera System (${tech?.camera_model || 'HD Camera'})`;
      panelTypeStr = `${tech?.camera_model || 'HD Camera'}${tech?.camera_mp ? ` (${String(tech.camera_mp).toUpperCase().includes('MP') ? tech.camera_mp : `${tech.camera_mp} MP`})` : ''}`;
      inverterCapStr = tech?.connectivity || 'Wi-Fi / 4G SIM';
      pvModuleCapacityStr = tech?.memory_card_capacity ? (String(tech.memory_card_capacity).toUpperCase().includes('GB') ? tech.memory_card_capacity : `${tech.memory_card_capacity} GB`) : '128 GB';
    } else if (isIC) {
      proposedSystemStr = capacityVal ? `${capacityVal}KW Solar Installation & Commissioning` : 'Solar Installation & Commissioning';
      structureStr = 'Client Supplied MMS';
      panelTypeStr = 'Client Supplied Solar Modules';
      pvModuleCapacityStr = capacityVal ? `${capacityVal} kW Scope` : 'As Specified';
      inverterCapStr = 'Client Supplied Solar Inverter';
    }

    const formattedTotal = q.grand_total ? `${(q.grand_total / 100).toLocaleString('en-IN')}/-` : '';

    const sysTypeStr = (q.system_type || 'ON-GRID').toUpperCase().replace('-', ' - ');
    const commercialDesc = isStreetLight
      ? `Design, Supply and Installation of ${proposedSystemStr} with ${structureStr}, ${panelTypeStr}, and Accessories.`
      : (isWaterPump
        ? `Design, Supply and Installation of ${proposedSystemStr} including Solar Modules, ${inverterCapStr}, ${structureStr} and Civil Works.`
        : (isCctv
          ? `Design, Supply and Installation of ${proposedSystemStr} with ${inverterCapStr}, Storage: ${pvModuleCapacityStr}, and Solar Power Unit.`
          : (isIC
            ? `Design, Engineering, Installation and Commissioning (I&C) of ${capacityVal ? `${capacityVal} kW ` : ''}Solar System – Complete mechanical mounting, electrical cabling & terminations, inverter installation, earthing and pre-commissioning testing to grid synchronization.`
            : `Design, Engineering, Supply and Commissioning Solar ${sysTypeStr} System including ${proposedSystemStr ? proposedSystemStr + ' ' : ''}${panelTypeStr || 'Solar PV Panels'}, ${inverterCapStr || 'Solar Inverter'}, Module Mounting Structures ${tech?.structure_material || 'GI'}, Civil Works, other accessories and Transportation including Grid Interface Net Meter TANGEDCO Charges.`)));

    const findItemByKeywords = (keywords: string[]) => {
      return q.items?.find((it: any) => {
        const pLookup = (it.item_id && productLookupMap) ? productLookupMap.get(it.item_id) : undefined;
        const text = `${it.name || ''} ${it.description || ''} ${pLookup?.category || ''} ${pLookup?.brand || ''} ${pLookup?.model || ''}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });
    };

    const panelItem = findItemByKeywords(['panel', 'module', 'solar pv']) || q.items?.[0];
    const inverterItem = findItemByKeywords(['inverter', 'growatt', 'grid tie']) || (q.items && q.items.length > 1 ? q.items[1] : undefined);
    const structureItem = findItemByKeywords(['structure', 'mounting', 'gi ']) || (q.items && q.items.length > 2 ? q.items[2] : undefined);

    const resolvedPanelSpecs = tech?.panel_specs || (panelItem ? (panelItem.description || panelItem.name) : 'mono');
    const resolvedPanelQty = tech?.panel_count !== undefined && tech?.panel_count !== null && String(tech.panel_count).trim() !== ''
      ? String(tech.panel_count)
      : (panelItem?.quantity ? String(panelItem.quantity) : '01');
    const panelItemBrand = panelItem ? resolveItemMake(panelItem) : undefined;
    const resolvedPanelMake = (panelItemBrand && panelItemBrand !== 'Reputed Quality') ? panelItemBrand : 'Waaree / Vikram / Adani / Reputed Quality';

    const inverterItemBrand = inverterItem ? resolveItemMake(inverterItem) : undefined;
    const resolvedInverterMake = (inverterItemBrand && inverterItemBrand !== 'Reputed Quality') ? inverterItemBrand : 'GROWATT / POLYCAB / Reputed Quality';
    const resolvedInverterSpecs = tech?.inverter_specs || (inverterItem ? (inverterItem.description || inverterItem.name) : (capacityVal ? `${capacityVal}KW` : 'string'));
    const invQtyVal = tech?.inverter_quantity ?? tech?.inverter_count;
    const resolvedInverterQty = invQtyVal !== undefined && invQtyVal !== null && String(invQtyVal).trim() !== ''
      ? String(invQtyVal)
      : (inverterItem?.quantity ? String(inverterItem.quantity) : '1');

    const resolvedStructureSpecs = tech?.structure_specs
      || (tech?.structure_type || tech?.structure_material ? `${tech?.structure_material || 'GI'}, ${tech?.structure_type || 'Normal Height'}` : '')
      || (structureItem ? (structureItem.description || structureItem.name) : 'GI, Normal Height');
    const structQtyVal = tech?.structure_quantity ?? tech?.structure_count;
    const resolvedStructureQty = structQtyVal !== undefined && structQtyVal !== null && String(structQtyVal).trim() !== ''
      ? String(structQtyVal)
      : (structureItem?.quantity ? String(structureItem.quantity) : '1');

    qData = {
      quotationType: q.quotation_type || (input as any).quotation_type || (input as any).quotationType || 'Quotation',
      quotationNo: q.reference || 'TGSA-SRT116',
      quotationDate: formatQuoteDate(q.issue_date || q.created_at),
      customerName: (custName || 'VALUED CUSTOMER').trim().toUpperCase(),
      siteAddress: (siteAddr || 'TAMIL NADU').trim().toUpperCase(),
      solutionProvider: 'TO-GEN SOLAR AGRO',
      mountingStructure: structureStr || 'Galvanized Iron (GI), Normal Height',
      panelType: panelTypeStr || (panelItem ? panelItem.name : 'Solar PV Panels'),
      spaceRequired: spaceReqStr,
      proposedSystem: proposedSystemStr || (capacityVal ? `${capacityVal}KW` : ''),
      pvModuleCapacity: pvModuleCapacityStr || (panelItem ? `${panelItem.quantity} Nos` : ''),
      inverterCapacity: inverterCapStr || (inverterItem ? inverterItem.name : ''),
      commercialDescription: commercialDesc,
      totalPrice: formattedTotal,
      panelMake: resolvedPanelMake,
      panelSpecs: resolvedPanelSpecs,
      panelQty: resolvedPanelQty,
      inverterMake: resolvedInverterMake,
      inverterSpecs: resolvedInverterSpecs,
      inverterQty: resolvedInverterQty,
      structureSpecs: resolvedStructureSpecs,
      structureQty: resolvedStructureQty,
      images: quotationImages,
      payment_terms: q.payment_terms || undefined,
      systemType: q.system_type || undefined,
      validity_days: q.validity_days || undefined,
      state_subsidy: q.state_subsidy || undefined,
      central_subsidy: q.central_subsidy || undefined,
      bank_account_id: q.bank_account_id || undefined,
      items: q.items || undefined,
      subtotal: q.subtotal !== undefined ? q.subtotal : (input as any).subtotal,
      total_tax: q.total_tax !== undefined ? q.total_tax : (input as any).total_tax,
      total_discount: q.total_discount !== undefined ? q.total_discount : (input as any).total_discount,
      grand_total: q.grand_total !== undefined ? q.grand_total : (input as any).grand_total,
      businessCategory: q.business_category || undefined,
      batteryType: tech?.battery_type || undefined,
      batteryCapacity: tech?.battery_capacity ?? tech?.battery_ah ?? undefined,
      batteryQuantity: tech?.battery_quantity ?? tech?.battery_count ?? undefined,
      systemCapacity: capacityVal || (tech as any)?.capacity_kw || tech?.system_capacity_kw || tech?.dc_capacity_kwp || (q as any).capacity_kw || (q as any).system_capacity_kw || undefined,
      capacity_kw: (q as any).capacity_kw || (tech as any)?.capacity_kw || capacityVal,
      system_capacity_kw: (q as any).system_capacity_kw || tech?.system_capacity_kw || capacityVal,
      technicalDetails: tech,
      tax_inclusive: q.tax_inclusive !== undefined ? !!q.tax_inclusive : (input as any).tax_inclusive,
      manual_tax_rate: (q as any).manual_tax_rate !== undefined ? (q as any).manual_tax_rate : (input as any).manual_tax_rate,
      discount_percent: (q as any).discount_percent !== undefined ? (q as any).discount_percent : (input as any).discount_percent,
    };
  } else {
    const tech = (input as any).technicalDetails;
    const items = input.items || (input as any).items || [];
    const findItemByKeywords = (keywords: string[]) => {
      return items.find((it: any) => {
        const text = `${it.name || ''} ${it.description || ''}`.toLowerCase();
        return keywords.some((kw: string) => text.includes(kw));
      });
    };
    const panelItem = findItemByKeywords(['panel', 'module', 'solar pv']) || items[0];
    const inverterItem = findItemByKeywords(['inverter', 'growatt', 'grid tie']) || (items.length > 1 ? items[1] : undefined);
    const structureItem = findItemByKeywords(['structure', 'mounting', 'gi ']) || (items.length > 2 ? items[2] : undefined);

    const resolvedPanelSpecs = input.panelSpecs || tech?.panel_specs || (panelItem ? (panelItem.description || panelItem.name) : 'mono');
    const resolvedPanelQty = input.panelQty || (tech?.panel_count !== undefined && tech?.panel_count !== null && String(tech.panel_count).trim() !== '' ? String(tech.panel_count) : (panelItem?.quantity ? String(panelItem.quantity) : '01'));
    const panelItemBrand = panelItem ? resolveItemMake(panelItem) : undefined;
    const resolvedPanelMake = input.panelMake || ((panelItemBrand && panelItemBrand !== 'Reputed Quality') ? panelItemBrand : 'Waaree / Vikram / Adani / Reputed Quality');

    const inverterItemBrand = inverterItem ? resolveItemMake(inverterItem) : undefined;
    const resolvedInverterMake = input.inverterMake || ((inverterItemBrand && inverterItemBrand !== 'Reputed Quality') ? inverterItemBrand : 'GROWATT / POLYCAB / Reputed Quality');
    const resolvedInverterSpecs = input.inverterSpecs || tech?.inverter_specs || (inverterItem ? (inverterItem.description || inverterItem.name) : 'string');
    const invQtyVal = tech?.inverter_quantity ?? tech?.inverter_count;
    const resolvedInverterQty = input.inverterQty || (invQtyVal !== undefined && invQtyVal !== null && String(invQtyVal).trim() !== '' ? String(invQtyVal) : (inverterItem?.quantity ? String(inverterItem.quantity) : '1'));

    const resolvedStructureSpecs = input.structureSpecs || tech?.structure_specs || (tech?.structure_type || tech?.structure_material ? `${tech?.structure_material || 'GI'}, ${tech?.structure_type || 'Normal Height'}` : '') || (structureItem ? (structureItem.description || structureItem.name) : 'GI, Normal Height');
    const structQtyVal = tech?.structure_quantity ?? tech?.structure_count;
    const resolvedStructureQty = input.structureQty || (structQtyVal !== undefined && structQtyVal !== null && String(structQtyVal).trim() !== '' ? String(structQtyVal) : (structureItem?.quantity ? String(structureItem.quantity) : '1'));

    qData = {
      solutionProvider: 'TO-GEN SOLAR AGRO',
      mountingStructure: input.mountingStructure || 'Galvanized Iron (GI), Normal Height',
      panelType: input.panelType || 'Solar PV Panels',
      spaceRequired: (input.spaceRequired && input.spaceRequired !== 'Shadow Free Space' && !input.spaceRequired.includes('240 Sq.ft')) ? input.spaceRequired : undefined,
      proposedSystem: input.proposedSystem || 'Solar System',
      pvModuleCapacity: input.pvModuleCapacity || '',
      inverterCapacity: input.inverterCapacity || '',
      commercialDescription: input.commercialDescription || 'Design, Engineering, Supply and Commissioning Solar ON GRID System',
      totalPrice: input.totalPrice || '',
      ...input,
      panelMake: resolvedPanelMake,
      panelSpecs: resolvedPanelSpecs,
      panelQty: resolvedPanelQty,
      inverterMake: resolvedInverterMake,
      inverterSpecs: resolvedInverterSpecs,
      inverterQty: resolvedInverterQty,
      structureSpecs: resolvedStructureSpecs,
      structureQty: resolvedStructureQty,
      quotationType: (input as any).quotation_type || (input as any).quotationType || input.quotationType || 'Quotation',
      customerName: (input.customerName || 'VALUED CUSTOMER').trim().toUpperCase(),
      siteAddress: (input.siteAddress || 'TAMIL NADU').trim().toUpperCase(),
      quotationDate: formatQuoteDate(input.quotationDate),
      images: quotationImages,
      payment_terms: input.payment_terms || (input as any).payment_terms || undefined,
      systemType: (input as any).system_type || input.systemType || undefined,
      validity_days: (input as any).validity_days || input.validity_days || undefined,
      state_subsidy: (input as any).state_subsidy || input.state_subsidy || undefined,
      central_subsidy: (input as any).central_subsidy || input.central_subsidy || undefined,
      bank_account_id: (input as any).bank_account_id || input.bank_account_id || undefined,
      items: input.items || (input as any).items || undefined,
      subtotal: (input as any).subtotal,
      total_tax: (input as any).total_tax,
      total_discount: (input as any).total_discount,
      grand_total: (input as any).grand_total,
      businessCategory: (input as any).business_category || (input as any).businessCategory || undefined,
      batteryType: input.batteryType || (input as any).technicalDetails?.battery_type || undefined,
      batteryCapacity: input.batteryCapacity ?? (input as any).technicalDetails?.battery_capacity ?? (input as any).technicalDetails?.battery_ah ?? undefined,
      batteryQuantity: input.batteryQuantity ?? (input as any).technicalDetails?.battery_quantity ?? (input as any).technicalDetails?.battery_count ?? undefined,
      systemCapacity: input.systemCapacity ??
        (input as any).capacity_kw ??
        (input as any).system_capacity_kw ??
        (input as any).technicalDetails?.capacity_kw ??
        (input as any).technicalDetails?.system_capacity_kw ??
        (input as any).technicalDetails?.dc_capacity_kwp ??
        (input.proposedSystem ? input.proposedSystem.replace(/[^0-9.]/g, '') : undefined),
      technicalDetails: tech,
      tax_inclusive: (input as any).tax_inclusive !== undefined ? !!(input as any).tax_inclusive : undefined,
      manual_tax_rate: (input as any).manual_tax_rate !== undefined ? (input as any).manual_tax_rate : undefined,
      discount_percent: (input as any).discount_percent !== undefined ? (input as any).discount_percent : undefined,
    };
  }

  const targetBank = qData.bank_account_id ? getBankAccountById(qData.bank_account_id) || getPrimaryBankAccount() : getPrimaryBankAccount();

  // Category detection for presentation
  const rawCat = (qData.businessCategory || '').toUpperCase();
  const cat = rawCat
    .replace(/&AMP;/gi, '&')
    .replace(/&LT;/gi, '<')
    .replace(/&GT;/gi, '>')
    .replace(/&QUOT;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();

  const isStreetLight = cat === 'SOLAR_STREETLIGHT' || cat.includes('STREET LIGHT') || cat.includes('STREETLIGHT');
  const isWaterPump = cat === 'SOLAR_WATERPUMP' || cat.includes('WATER PUMP') || cat.includes('WATERPUMP');
  const isCctv = cat === 'SOLAR_CCTV' || cat.includes('CCTV');
  const isIC = cat === 'SOLAR_IC' || cat.includes('I & C') || cat.includes('I&C') || cat.includes('INSTALLATION') || cat.includes('COMMISSIONING');
  const isFencing = cat === 'SOLAR_FENCING' || cat.includes('FENCING');
  const isWaterHeater = cat === 'SOLAR_AMC' || cat.includes('WATER HEATER') || cat.includes('AMC');
  const isRooftop = (cat === 'SOLAR_ROOFTOP' || cat.includes('ROOFTOP') || cat.includes('ROOF TOP') || (!cat && !isStreetLight && !isWaterPump && !isCctv && !isIC && !isFencing && !isWaterHeater)) && !isIC && !isStreetLight && !isWaterPump && !isCctv;
  const capacityVal = qData.systemCapacity || (qData.proposedSystem ? qData.proposedSystem.replace(/[^0-9.]/g, '') : '');

  const getFormattedCapacity = () => {
    let raw = (
      qData.systemCapacity ??
      (qData as any).capacity_kw ??
      (qData as any).system_capacity_kw ??
      (qData.technicalDetails as any)?.capacity_kw ??
      (qData.technicalDetails as any)?.system_capacity_kw ??
      capacityVal ??
      ''
    ).toString().trim();
    if (!raw) return '—';
    if (/\s*kw\b/i.test(raw)) {
      return raw.replace(/\s*kw\b/i, ' kW');
    }
    return `${raw} kW`;
  };

  // Dynamic titles and labels derived from selected quotation type & category
  const rawQuoteType = (qData.quotationType || 'Quotation').trim();
  const quoteTypeLower = rawQuoteType.toLowerCase();
  const isProforma = quoteTypeLower.includes('proforma') || quoteTypeLower.includes('performa');
  const isSubsidy = quoteTypeLower.includes('subsidy');
  const isCommercial = quoteTypeLower.includes('commercial');

  // Strictly only show the 3 subsidy/process images (Customer Required Documents, Project Schedule & Banking, PM Surya Ghar Work Process)
  // for Solar Rooftop, Commercial, and Government Subsidy.
  // Never show them for Proforma Invoice or other categories with regular Quotation.
  const shouldShowSubsidyAndProcessPages = !isProforma && (isRooftop || isCommercial || isSubsidy);
  const isConciseQuotation = !shouldShowSubsidyAndProcessPages;

  let docRefLabel = 'Quotation Ref';
  let docDateRowLabel = 'Quotation No / Date';

  if (quoteTypeLower.includes('proforma') || quoteTypeLower.includes('performa')) {
    docRefLabel = 'Invoice Ref';
    docDateRowLabel = 'Invoice No / Date';
  } else if (quoteTypeLower.includes('subsidy')) {
    docRefLabel = 'Quotation Ref';
    docDateRowLabel = 'Quotation No / Date';
  } else if (quoteTypeLower.includes('commercial')) {
    docRefLabel = 'Quotation Ref';
    docDateRowLabel = 'Quotation No / Date';
  } else if (quoteTypeLower === 'quotation') {
    docRefLabel = 'Quotation Ref';
    docDateRowLabel = 'Quotation No / Date';
  } else {
    docRefLabel = `${rawQuoteType} Ref`;
    docDateRowLabel = `${rawQuoteType} No / Date`;
  }

  // Helper for Cover Page Line 3: Selected Business Category ONLY
  const formatCoverCategory = (rawCat?: string): string => {
    if (!rawCat) return 'SOLAR ROOFTOP';
    const c = rawCat.replace(/&amp;/gi, '&').trim().toUpperCase();
    if (c === 'SOLAR_CCTV' || c.includes('CCTV')) return 'SOLAR CCTV CAMERA';
    if (c === 'SOLAR_WATERPUMP' || c.includes('WATER PUMP') || c.includes('WATERPUMP')) return 'SOLAR WATER PUMP';
    if (c === 'SOLAR_STREETLIGHT' || c.includes('STREET LIGHT') || c.includes('STREETLIGHT')) return 'SOLAR STREET LIGHT';
    if (c === 'SOLAR_ROOFTOP' || c.includes('ROOFTOP')) return 'SOLAR ROOFTOP';
    if (c === 'SOLAR_IC' || c.includes('I & C') || c.includes('I&C')) return 'SOLAR I & C SERVICE';
    if (c === 'SOLAR_FENCING' || c.includes('FENCING')) return 'SOLAR FENCING';
    if (c === 'SOLAR_AMC' || c.includes('WATER HEATER')) return 'SOLAR WATER HEATER / AMC';
    return c.replace(/_/g, ' ');
  };

  // Helper for Cover Page Line 4: Selected Quotation Type ONLY
  const formatCoverQuotationType = (rawType?: string): string => {
    if (!rawType) return 'QUOTATION';
    const t = rawType.trim().toUpperCase();
    if (t.includes('SUBSIDY')) return 'GOVERNMENT SUBSIDY';
    if (t.includes('COMMERCIAL')) return 'COMMERCIAL';
    if (t.includes('PROFORMA') || t.includes('PERFORMA')) return 'PROFORMA INVOICE';
    if (t === 'QUOTATION') return 'QUOTATION';
    return t.replace(/_/g, ' ');
  };

  // Top corner bar placeholder (the new header banner graphic includes the top styled border)
  const renderTopBar = () => ``;

  // Common Header HTML - displays the official ToGen Solar Agro header banner across every page, with 5px gap on left & right
  const renderHeader = () => `
    <div style="width: calc(100% + 66px); margin: 0 -33px 20px -33px; flex-shrink: 0; text-align: center; display: flex; justify-content: center; align-items: center; box-sizing: border-box;">
      <img src="${headerBanner}" style="width: 100%; height: auto; max-height: 145px; object-fit: contain; display: block; margin: 0 auto; image-rendering: high-quality; image-rendering: -webkit-optimize-contrast;" alt="ToGen Solar Agro Header" />
    </div>
  `;

  // Common Footer HTML
  const renderFooter = (autoMarginTop = true) => `
    <div style="${autoMarginTop ? 'margin-top: auto;' : 'margin-top: 0;'} flex-shrink: 0; border-top: 1.5px solid #008289; padding-top: 8px; text-align: center; width: 100%; box-sizing: border-box;">
      <div style="font-size: 11px; font-weight: 700; color: #0f2b48; letter-spacing: 0.3px; margin-bottom: 2px;">
        Residential & Commercial Solar Installations &nbsp;|&nbsp; Solar Street Lights &nbsp;|&nbsp; Solar Water Pumps
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #0f2b48; letter-spacing: 0.3px; margin-bottom: 3px;">
        Solar CCTV Cameras &nbsp;|&nbsp; Solar Water Heater &nbsp;|&nbsp; Solar PMC Services
      </div>
      <div style="font-size: 11px; font-weight: 800; color: #008289; letter-spacing: 0.4px;">
        Head Office: 3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil, Madurai – 625301 &nbsp;|&nbsp; +91 63803 29294
      </div>
    </div>
  `;

  // Subtle Watermark
  const renderWatermark = () => `
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; pointer-events: none; z-index: 0; width: 440px;">
      <img src="${logoImg}" style="width: 100%; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="Watermark" />
    </div>
  `;

  const pageBaseStyle = `width: 794px; min-width: 794px; max-width: 794px; height: 1123px; min-height: 1123px; max-height: 1123px; padding: 5px 38px 20px 38px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; position: relative; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;`;

  // Page 1: Cover Proposal (Title, Proposed By To-Gen Solar Agro, Proposed To Dynamic Customer & Site)
  const page1Html = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}
      
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-around; align-items: center; text-align: center; z-index: 1; padding: 20px 0;">
        <div>
          <!-- Line 1 - Dynamic Document Title -->
          <h1 style="color: #0275bc; font-size: 34px; font-weight: 900; letter-spacing: 2px; margin: 0 0 16px 0; text-transform: uppercase;">${isProforma ? 'PROFORMA INVOICE' : 'QUOTATION'}</h1>
          <!-- Line 2 (Fixed) - Green -->
          <h2 style="color: #16a34a; font-size: 24px; font-weight: 800; letter-spacing: 1.5px; margin: 0 0 16px 0; text-transform: uppercase;">TECHNO-COMMERCIAL PROPOSAL</h2>
          <!-- Line 3 (Selected Business Category Only) - To-Gen Blue -->
          <div style="color: #0275bc; font-size: 22px; font-weight: 900; letter-spacing: 1px; margin: 0 0 14px 0; text-transform: uppercase;">
            ${formatCoverCategory(qData.businessCategory)}
          </div>
          <!-- Line 4 (Selected Quotation Type Only) - Green -->
          <div style="color: #16a34a; font-size: 18px; font-weight: 800; letter-spacing: 1px; margin: 0; text-transform: uppercase;">
            ${formatCoverQuotationType(qData.quotationType)}
          </div>
        </div>

        <div style="margin: 40px 0 20px 0; width: 100%;">
          <!-- Line 5 - To-Gen Blue -->
          <div style="color: #0275bc; font-size: 16px; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px;">PROPOSED BY</div>
          <!-- Line 6 - Green -->
          <div style="color: #16a34a; font-size: 22px; font-weight: 900; letter-spacing: 1px; margin-bottom: 35px;">TO-GEN SOLAR AGRO</div>
          
          <!-- Line 7 - To-Gen Blue -->
          <div style="color: #0275bc; font-size: 16px; font-weight: 800; letter-spacing: 1px; margin-bottom: 12px;">TO</div>
          <!-- Line 8 - Green -->
          <div style="color: #16a34a; font-size: 25px; font-weight: 900; letter-spacing: 1px; margin-bottom: 10px;">${qData.customerName}</div>
          <!-- Line 9 - To-Gen Blue -->
          <div style="color: #0275bc; font-size: 20px; font-weight: 800; letter-spacing: 1px;">${qData.siteAddress}</div>
        </div>
      </div>

      ${renderFooter()}
    </div>
  `;

  // Page 2 Table Rows: Dynamically customized for each business category
  const labelColStyle = 'width: 35%; padding: 7.5px 12px; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: 11px; vertical-align: middle;';
  const valColStyle = 'width: 65%; padding: 7.5px 12px; font-weight: 800; color: #0f2b48; border: 1px solid #d9e6ed; background: #ffffff; box-sizing: border-box; font-size: 11px; vertical-align: middle;';
  let projectDetailRowsHtml = '';

  if (isCctv) {
    projectDetailRowsHtml = `
      <tr>
        <td style="${labelColStyle}">Proposed Solar System</td>
        <td style="${valColStyle}">${qData.proposedSystem || 'Solar CCTV Camera System'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Camera Model & Make</td>
        <td style="${valColStyle}">${qData.panelType || 'HD Solar Camera'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Storage / Memory Card</td>
        <td style="${valColStyle}">${qData.pvModuleCapacity || '128 GB MicroSD'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Connectivity Type</td>
        <td style="${valColStyle}">${qData.inverterCapacity || 'Wi-Fi / 4G SIM'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Mounting / Bracket Structure</td>
        <td style="${valColStyle}">${qData.mountingStructure}</td>
      </tr>
      ${qData.spaceRequired ? `
      <tr>
        <td style="${labelColStyle}">Space Reqd. for Installation</td>
        <td style="${valColStyle}">${qData.spaceRequired}</td>
      </tr>` : ''}
    `;
  } else if (isWaterPump) {
    projectDetailRowsHtml = `
      <tr>
        <td style="${labelColStyle}">Proposed Solar System</td>
        <td style="${valColStyle}">${qData.proposedSystem || 'Solar Water Pump System'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Solar Drive (VFD) Model</td>
        <td style="${valColStyle}">${qData.inverterCapacity || 'Solar VFD Controller'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Mounting Structure Type & Height</td>
        <td style="${valColStyle}">${qData.mountingStructure}</td>
      </tr>
      ${qData.spaceRequired ? `
      <tr>
        <td style="${labelColStyle}">Space Reqd. for Installation</td>
        <td style="${valColStyle}">${qData.spaceRequired}</td>
      </tr>` : ''}
    `;
  } else if (isStreetLight) {
    projectDetailRowsHtml = `
      <tr>
        <td style="${labelColStyle}">Proposed Solar System</td>
        <td style="${valColStyle}">${qData.proposedSystem || 'Solar Street Light System'}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Wattage & Type</td>
        <td style="${valColStyle}">${(qData.pvModuleCapacity || '').replace(/\s*Luminaire/gi, '')}${qData.inverterCapacity ? ` (${qData.inverterCapacity})` : ''}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Solar PV Panel Type</td>
        <td style="${valColStyle}">${qData.panelType}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Pole Structure & Height</td>
        <td style="${valColStyle}">${qData.mountingStructure}</td>
      </tr>
      ${qData.spaceRequired ? `
      <tr>
        <td style="${labelColStyle}">Space Reqd. for Installation</td>
        <td style="${valColStyle}">${qData.spaceRequired}</td>
      </tr>` : ''}
    `;
  } else if (isIC) {
    projectDetailRowsHtml = `
      <tr>
        <td style="${labelColStyle}">Proposed Solar Service</td>
        <td style="${valColStyle}">Solar Installation & Commissioning (I&C)</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">System Capacity</td>
        <td style="${valColStyle}">${getFormattedCapacity()}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Service Scope</td>
        <td style="${valColStyle}">Complete Module Mounting, Structure Assembly, Cabling, Inverter Termination & Pre-Commissioning Testing</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Execution Methodology</td>
        <td style="${valColStyle}">Standard Engineering Practice & Grid Synchronization</td>
      </tr>
    `;
  } else {
    // Rooftop / Standard Solar System
    projectDetailRowsHtml = `
      <tr>
        <td style="${labelColStyle}">Mounting Structure Type</td>
        <td style="${valColStyle}">${qData.mountingStructure}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Photovoltaic Panel Type</td>
        <td style="${valColStyle}">${qData.panelType}</td>
      </tr>
      ${qData.spaceRequired ? `
      <tr>
        <td style="${labelColStyle}">Space Reqd. for Installation</td>
        <td style="${valColStyle}">${qData.spaceRequired}</td>
      </tr>` : ''}
      <tr>
        <td style="${labelColStyle}">Proposed Solar System</td>
        <td style="${valColStyle}">${qData.proposedSystem}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Capacity of PV module for Main Building</td>
        <td style="${valColStyle}">${qData.pvModuleCapacity}</td>
      </tr>
      <tr>
        <td style="${labelColStyle}">Capacity of Inverter for Main Building</td>
        <td style="${valColStyle}">${qData.inverterCapacity}</td>
      </tr>
      ${(qData.batteryType || qData.batteryCapacity) ? `
      <tr>
        <td style="${labelColStyle}">Battery Bank Capacity & Type</td>
        <td style="${valColStyle}">${qData.batteryType || 'Battery'} ${qData.batteryCapacity ? `${qData.batteryCapacity} Ah` : ''} ${qData.batteryQuantity ? `(${qData.batteryQuantity} Nos)` : ''}</td>
      </tr>` : ''}
    `;
  }

  const technicalBomHeadersHtml = `
    <tr style="background-color: #0f2b48; color: #ffffff;">
      <th style="border: 1px solid #1e3a5f; padding: 7.5px 6px; text-align: center; width: 6%; font-weight: 800; box-sizing: border-box; font-size: 10.5px;">Sl. No</th>
      <th style="border: 1px solid #1e3a5f; padding: 7.5px 10px; text-align: left; width: 28%; font-weight: 800; box-sizing: border-box; font-size: 10.5px;">Product</th>
      <th style="border: 1px solid #1e3a5f; padding: 7.5px 10px; text-align: left; width: 18%; font-weight: 800; box-sizing: border-box; font-size: 10.5px;">Make</th>
      <th style="border: 1px solid #1e3a5f; padding: 7.5px 10px; text-align: left; width: 38%; font-weight: 800; box-sizing: border-box; font-size: 10.5px;">Specification</th>
      <th style="border: 1px solid #1e3a5f; padding: 7.5px 6px; text-align: center; width: 10%; font-weight: 800; box-sizing: border-box; font-size: 10.5px;">Qty</th>
    </tr>
  `;

  const sanitizeBomRow = (product: string, spec: string, qty: string | number) => {
    let cleanProduct = (product && product !== '—' && String(product).trim().length > 0) ? String(product).trim() : '—';
    const cleanSpec = (spec && spec !== '—' && String(spec).trim().length > 0) ? String(spec).trim() : '—';
    let cleanQty = qty !== undefined && qty !== null && String(qty).trim() !== '' ? String(qty).trim() : '—';

    // 1. Matches compound e.g. "330W x 10 Nos", "550 Watts x 12", "550W x 12 Nos"
    const compoundMatch = cleanQty !== '—' ? cleanQty.match(/^(\d+(?:\.\d+)?\s*(?:watts?|w|kw|kwp|kva|va|ah|hp))\s*x\s*(\d+(?:\s*nos)?)/i) : null;
    // 2. Matches single power unit in Qty e.g. "1 Watts", "500W", "330 Watt", "5 HP", "150 Ah", "100W"
    const powerUnitMatch = cleanQty !== '—' ? cleanQty.match(/^(\d+(?:\.\d+)?)\s*(watts?|w|kw|kwp|kva|va|ah|hp|volts?|v)\b/i) : null;

    if (compoundMatch) {
      const powerRating = compoundMatch[1].trim();
      const count = compoundMatch[2].trim();
      if (!cleanProduct.toLowerCase().includes(powerRating.toLowerCase())) {
        cleanProduct = cleanProduct === '—' ? powerRating : `${cleanProduct} (${powerRating})`;
      }
      cleanQty = count.toLowerCase().includes('no') ? count : `${count} Nos`;
    } else if (powerUnitMatch) {
      const numVal = powerUnitMatch[1];
      const rawUnit = powerUnitMatch[2];
      const formattedUnit = rawUnit.toLowerCase().startsWith('w') && rawUnit.toLowerCase() !== 'w' ? 'Watts' : (rawUnit.toUpperCase() === 'W' ? 'Watts' : (rawUnit.toUpperCase() === 'KW' ? 'kW' : rawUnit));
      // Put unit value without quantity number prefix
      const unitLabel = formattedUnit;
      if (!cleanProduct.toLowerCase().includes(rawUnit.toLowerCase())) {
        cleanProduct = cleanProduct === '—' ? unitLabel : `${cleanProduct} (${unitLabel})`;
      }
      cleanQty = `${numVal} Nos`;
    }

    // Remove any quantity prefix numbers from "(1 Watts)" or "(1 kW)" so it becomes "(Watts)" or "(kW)"
    cleanProduct = cleanProduct.replace(/\(\s*\d+(?:\.\d+)?\s*(watts?|w|kw|kwp|kva|va|ah|hp|volts?|v)\s*\)/gi, (_, unit) => {
      const formatted = unit.toLowerCase().startsWith('w') && unit.toLowerCase() !== 'w' ? 'Watts' : (unit.toUpperCase() === 'W' ? 'Watts' : (unit.toUpperCase() === 'KW' ? 'kW' : unit));
      return `(${formatted})`;
    });

    return { cleanProduct, cleanSpec, cleanQty };
  };

  const renderBomRow = (slNo: number, product: string, make: string, spec: string, qty: string | number, isEven: boolean) => {
    let finalMake = (make && make !== '—' && make.trim().length > 0) ? make.trim() : 'Reputed Quality';
    if (finalMake.toLowerCase() === 'reputed') {
      finalMake = 'Reputed Quality';
    } else if (/\/\s*reputed$/i.test(finalMake)) {
      finalMake = finalMake.replace(/\/\s*reputed$/i, '/ Reputed Quality');
    }
    const { cleanProduct, cleanSpec, cleanQty } = sanitizeBomRow(product, spec, qty);
    return `
    <tr style="${isEven ? 'background-color: #fafbfc;' : ''}">
      <td style="border: 1px solid #d9e6ed; padding: 7.5px 6px; text-align: center; font-weight: 800; background: #edf6f9; color: #008289; box-sizing: border-box; vertical-align: middle; font-size: 10.5px;">${slNo}</td>
      <td style="border: 1px solid #d9e6ed; padding: 7.5px 10px; font-weight: 800; color: #008289; background: #f8fafc; box-sizing: border-box; vertical-align: middle; word-break: break-word; font-size: 10.5px;">${cleanProduct}</td>
      <td style="border: 1px solid #d9e6ed; padding: 7.5px 10px; color: #1e293b; box-sizing: border-box; vertical-align: middle; word-break: break-word; font-size: 10.5px;">${finalMake}</td>
      <td style="border: 1px solid #d9e6ed; padding: 7.5px 10px; color: #1e293b; box-sizing: border-box; vertical-align: middle; word-break: break-word; line-height: 1.4; font-size: 10.5px;">${cleanSpec}</td>
      <td style="border: 1px solid #d9e6ed; padding: 7.5px 6px; text-align: center; font-weight: 700; color: #0f2b48; background: #f8fafc; box-sizing: border-box; vertical-align: middle; font-size: 10.5px;">${cleanQty}</td>
    </tr>`;
  };

  const tech = qData.technicalDetails;
  let technicalBomRowsHtml = '';

  const buildRooftopAndIcBomRows = () => {
    const rows: string[] = [];

    // Row 1: Solar PV Panel (Dynamic user input)
    const pMake = qData.panelMake || 'Waaree / Vikram / Adani / Reputed Quality';
    const pSpec = qData.panelSpecs || 'mono';
    let pQty = qData.panelQty || '01';
    if (String(pQty) === '1') {
      pQty = '01';
    }
    rows.push(renderBomRow(1, 'Solar PV Panel', pMake, pSpec, pQty, false));

    // Row 2: Inverter (Dynamic user input)
    const invName = (qData.systemType && qData.systemType.toLowerCase().includes('off'))
      ? 'Off-Grid Inverter'
      : (qData.systemType && qData.systemType.toLowerCase().includes('hybrid') ? 'Hybrid Inverter' : 'On-Grid Inverter');
    const invMake = qData.inverterMake || 'GROWATT / POLYCAB / Reputed Quality';
    const invSpec = qData.inverterSpecs || (capacityVal ? `${capacityVal}KW` : 'string');
    const invQty = qData.inverterQty || '1';
    rows.push(renderBomRow(2, invName, invMake, invSpec, invQty, true));

    // Row 3: Mounting Structure (Dynamic user input - Make: Reputed Quality)
    const structMake = 'Reputed Quality';
    const structSpec = qData.structureSpecs || 'GI, Normal Height';
    const structQty = qData.structureQty || '1';
    rows.push(renderBomRow(3, 'Mounting Structure', structMake, structSpec, structQty, false));

    // Row 4: DCDB,ACDB, Chemical Earthling (Fixed - Make: Reputed Quality)
    rows.push(renderBomRow(4, 'DCDB,ACDB, Chemical Earthling', 'Reputed Quality', 'Earth rod with 8Kg Chemical bag', '3', true));

    // Row 5: DC Cable (Fixed as in reference)
    rows.push(renderBomRow(5, 'DC Cable', 'Polycab', '1C X 4Sq.mm Red cable and black cable', 'As required', false));

    // Row 6: AC Cable (Fixed as in reference)
    rows.push(renderBomRow(6, 'AC Cable', 'Polycab', '4C X 4.0Sq.mm and Earthling cable', 'As required', true));

    // Row 7: Lightning Arrester (Fixed as in reference)
    rows.push(renderBomRow(7, 'Lightning Arrester', 'Reputed Quality', 'Conventional Type', '1', false));

    // Optional Row 8: Battery Bank (Only for Off-Grid / Hybrid when battery details exist)
    const isOffGridOrHybrid = (qData.systemType && (qData.systemType.toLowerCase().includes('off') || qData.systemType.toLowerCase().includes('hybrid')));
    if (isOffGridOrHybrid && (tech?.battery_type || tech?.battery_capacity || tech?.battery_quantity)) {
      const bType = tech?.battery_type || qData.batteryType || 'Battery';
      const bCap = tech?.battery_capacity ?? tech?.battery_ah ?? qData.batteryCapacity;
      const bQty = tech?.battery_quantity ?? tech?.battery_count ?? qData.batteryQuantity ?? 1;
      const bSpec = `${bType}${bCap ? ` - ${bCap} Ah` : ''}`;
      rows.push(renderBomRow(8, 'Battery Bank', 'Reputed Quality', bSpec, `${bQty} Nos`, true));
    }

    return rows.join('');
  };

  if (isIC) {
    // 1. Solar Installation & Commissioning (I&C) Category
    technicalBomRowsHtml = buildRooftopAndIcBomRows();
  } else if (isCctv) {
    // 2. Solar CCTV Camera Category
    const cameraMake = tech?.camera_model?.trim() || '—';
    const specParts: string[] = [];
    if (tech?.camera_mp && String(tech.camera_mp).trim()) {
      const mpStr = String(tech.camera_mp).trim();
      specParts.push(mpStr.toUpperCase().includes('MP') ? mpStr : `${mpStr} MP`);
    }
    if (tech?.connectivity && tech.connectivity.trim()) {
      const connStr = tech.connectivity.trim();
      specParts.push(connStr.toLowerCase().includes('connect') ? connStr : `${connStr} Connectivity`);
    }
    if (tech?.memory_card_capacity && String(tech.memory_card_capacity).trim()) {
      const mcStr = String(tech.memory_card_capacity).trim();
      specParts.push(mcStr.toUpperCase().includes('CARD') || mcStr.toUpperCase().includes('GB') ? mcStr : `${mcStr} GB Memory Card`);
    }
    const cameraSpec = specParts.length > 0 ? specParts.join(', ') : (qData.proposedSystem || 'Solar CCTV Camera');

    const cameraItem = (qData.items || []).find((it: any) => {
      const pLookup = it.item_id ? productLookupMap.get(it.item_id) : undefined;
      const text = `${it.name || ''} ${it.description || ''} ${pLookup?.category || ''}`.toLowerCase();
      return text.includes('cctv') || text.includes('camera');
    });
    const cameraQtyVal = cameraItem?.quantity ?? tech?.camera_count ?? 1;
    const cameraQty = `${cameraQtyVal}${cameraItem?.unit ? ` ${cameraItem.unit}` : ' Nos'}`;

    const rows: string[] = [];
    rows.push(renderBomRow(1, 'Solar CCTV Camera', cameraMake, cameraSpec, cameraQty, false));

    // Separate component records (panels, batteries, mounting poles, storage) only if separate records exist
    if (Array.isArray(qData.items) && qData.items.length > 0) {
      let extraSlNo = 2;
      for (const it of qData.items) {
        if (it === cameraItem) continue;
        const pLookup = it.item_id ? productLookupMap.get(it.item_id) : undefined;
        const text = `${it.name || ''} ${it.description || ''} ${pLookup?.category || ''}`.toLowerCase();
        if (text.includes('cctv') || text.includes('camera')) continue;

        const rawUnit = (pLookup?.unit || it.unit || '').trim();
        const isPower = /^(watts?|w|kw|kwp|kva|va|ah|hp|volts?|v)$/i.test(rawUnit);
        let prodName = it.name || pLookup?.name || 'Component';
        let qty = `${it.quantity || 1} Nos`;
        if (isPower) {
          const unitLabel = rawUnit.toLowerCase().startsWith('w') && rawUnit.toLowerCase() !== 'w' ? 'Watts' : (rawUnit.toUpperCase() === 'W' ? 'Watts' : (rawUnit.toUpperCase() === 'KW' ? 'kW' : rawUnit));
          if (!prodName.toLowerCase().includes(rawUnit.toLowerCase())) {
            prodName = `${prodName} (${unitLabel})`;
          }
        } else if (rawUnit) {
          qty = `${it.quantity || 1} ${rawUnit}`;
        }
        const make = resolveItemMake(it);
        const spec = pLookup?.specs || it.description || it.name || '—';
        rows.push(renderBomRow(extraSlNo, prodName, make, spec, qty, extraSlNo % 2 === 0));
        extraSlNo++;
      }
    }
    technicalBomRowsHtml = rows.join('');
  } else if (isWaterPump) {
    // 3. Solar Water Pump Category
    if (Array.isArray(qData.items) && qData.items.length > 0) {
      technicalBomRowsHtml = qData.items.map((it: any, idx: number) => {
        const pLookup = it.item_id ? productLookupMap.get(it.item_id) : undefined;
        const text = `${it.name || ''} ${it.description || ''} ${pLookup?.category || ''} ${pLookup?.component_type || ''}`.toLowerCase();

        const rawUnit = (pLookup?.unit || it.unit || '').trim();
        const isPower = /^(watts?|w|kw|kwp|kva|va|ah|hp|volts?|v)$/i.test(rawUnit);
        let prodName = it.name || pLookup?.name || 'Equipment';
        let qty = `${it.quantity || 1} Nos`;
        if (isPower) {
          const unitLabel = rawUnit.toLowerCase().startsWith('w') && rawUnit.toLowerCase() !== 'w' ? 'Watts' : (rawUnit.toUpperCase() === 'W' ? 'Watts' : (rawUnit.toUpperCase() === 'KW' ? 'kW' : rawUnit));
          if (!prodName.toLowerCase().includes(rawUnit.toLowerCase())) {
            prodName = `${prodName} (${unitLabel})`;
          }
        } else if (rawUnit) {
          qty = `${it.quantity || 1} ${rawUnit}`;
        }
        let make = resolveItemMake(it);
        let spec = pLookup?.specs || it.description || it.name || '—';

        if (text.includes('panel') || text.includes('module') || text.includes('pv')) {
          const cap = tech?.pump_rating_kw || capacityVal;
          if (cap && !spec.includes(`${cap} kW`) && !spec.includes(`${cap}kW`)) {
            spec = `${spec} (${cap} kW Solar Array)`;
          }
        } else if (text.includes('drive') || text.includes('vfd') || text.includes('controller') || text.includes('inverter')) {
          if (tech?.vfd_model) make = tech.vfd_model;
          const driveAdditions: string[] = [];
          if (tech?.pump_hp && !spec.includes(`${tech.pump_hp} HP`)) driveAdditions.push(`${tech.pump_hp} HP Drive`);
          if (tech?.connectivity && !spec.includes(tech.connectivity)) driveAdditions.push(`${tech.connectivity} Connectivity`);
          if (driveAdditions.length > 0) {
            spec = `${spec} (${driveAdditions.join(', ')})`;
          }
        } else if (text.includes('pump') || text.includes('motor') || text.includes('submersible')) {
          if (tech?.pump_hp && !spec.includes(`${tech.pump_hp} HP`)) {
            spec = `${spec} (${tech.pump_hp} HP)`;
          }
        } else if (text.includes('structure') || text.includes('mounting')) {
          const structAdditions: string[] = [];
          if (tech?.structure_material) structAdditions.push(`${tech.structure_material} Structure`);
          if (tech?.structure_height) structAdditions.push(`Height: ${tech.structure_height}`);
          if (structAdditions.length > 0) {
            spec = `${structAdditions.join(', ')}${pLookup?.specs ? ` - ${pLookup.specs}` : ''}`;
          }
        }

        return renderBomRow(idx + 1, prodName, make, spec, qty, idx % 2 === 1);
      }).join('');
    } else {
      // Single Solar Water Pump System summary row when no matching component records exist
      const pumpMake = tech?.vfd_model ? `Drive: ${tech.vfd_model}` : '—';
      const specParts: string[] = [];
      if (tech?.pump_system_type) specParts.push(tech.pump_system_type);
      const cap = tech?.pump_rating_kw || capacityVal;
      if (cap) specParts.push(`${cap} kW Solar Array`);
      if (tech?.pump_hp) specParts.push(`${tech.pump_hp} HP Solar Drive`);
      if (tech?.connectivity) specParts.push(`${tech.connectivity} Connectivity`);
      if (tech?.structure_material) specParts.push(`${tech.structure_material} Structure`);
      if (tech?.structure_height) specParts.push(`Height: ${tech.structure_height}`);
      const summarySpec = specParts.length > 0 ? specParts.join(', ') : 'Solar Water Pump System';

      technicalBomRowsHtml = renderBomRow(1, 'Solar Water Pump System', pumpMake, summarySpec, '1 Set', false);
    }
  } else if (isStreetLight) {
    // 4. Solar Street Light Category
    const slItem = (qData.items || []).find((it: any) => {
      const pLookup = it.item_id ? productLookupMap.get(it.item_id) : undefined;
      const text = `${it.name || ''} ${it.description || ''} ${pLookup?.category || ''}`.toLowerCase();
      return text.includes('street') || text.includes('light') || text.includes('luminaire');
    });

    const pLookup = slItem?.item_id ? productLookupMap.get(slItem.item_id) : undefined;
    const slMake = resolveItemMake(slItem);

    const specParts: string[] = [];
    const wattageVal = tech?.luminaire_wattage_w || tech?.wattage;
    if (wattageVal) specParts.push(`${wattageVal} W`);
    if (tech?.light_type) specParts.push(tech.light_type);
    if (tech?.sl_panel_type) specParts.push(`${tech.sl_panel_type} Solar Panel`);
    if (tech?.pole_material) specParts.push(`${tech.pole_material} Pole`);
    if (tech?.pole_height_ft) specParts.push(`${tech.pole_height_ft} Feet Height`);
    const slSpec = specParts.length > 0 ? specParts.join(', ') : (pLookup?.specs || slItem?.description || 'Solar Street Light');

    const slQtyVal = slItem?.quantity ?? tech?.light_count ?? 1;
    const slQty = `${slQtyVal}${slItem?.unit ? ` ${slItem.unit}` : ' Nos'}`;

    const rows: string[] = [];
    rows.push(renderBomRow(1, 'Solar Street Light', slMake, slSpec, slQty, false));

    // If integrated, do not create duplicate standalone battery/panel rows unless separate component records exist
    if (Array.isArray(qData.items) && qData.items.length > 0) {
      let extraSlNo = 2;
      for (const it of qData.items) {
        if (it === slItem) continue;
        const itLookup = it.item_id ? productLookupMap.get(it.item_id) : undefined;
        const text = `${it.name || ''} ${it.description || ''} ${itLookup?.category || ''}`.toLowerCase();
        if (text.includes('street light') || text.includes('streetlight')) continue;

        const prodName = it.name || itLookup?.name || 'Component';
        const make = resolveItemMake(it);
        const spec = itLookup?.specs || it.description || it.name || '—';
        const qty = `${it.quantity || 1}${itLookup?.unit || it.unit ? ` ${itLookup?.unit || it.unit}` : ' Nos'}`;
        rows.push(renderBomRow(extraSlNo, prodName, make, spec, qty, extraSlNo % 2 === 0));
        extraSlNo++;
      }
    }
    technicalBomRowsHtml = rows.join('');
  } else {
    // 5. Solar Rooftop Category (Standard) - Exact same 7-item layout as I&C
    technicalBomRowsHtml = buildRooftopAndIcBomRows();
  }

  // Page 2: Combined Project Details, Technical Details BOM Table & System Block Diagram
  const page2Html = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; min-height: 0; z-index: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 24px; margin-bottom: 12px;">
        <!-- Section 1: Project Details -->
        <div style="flex-shrink: 0; margin-bottom: 18px;">
          <div style="background: #0f2b48; color: #ffffff; padding: 7.5px 12px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.8px;">PROJECT DETAILS</span>
          </div>

          <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #d9e6ed; border-top: none; box-sizing: border-box; word-break: break-word;">
            <tbody>
              <tr>
                <td style="${labelColStyle}">Solution Provider</td>
                <td style="${valColStyle}">
                  <b>${qData.solutionProvider || 'TO-GEN SOLAR AGRO'}</b><br/>
                  <span style="font-size: 9.5px; color: #475569; font-weight: 600;">3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil, Madurai – 625301</span>
                </td>
              </tr>
              <tr>
                <td style="${labelColStyle}">Customer Name</td>
                <td style="${valColStyle}">${qData.customerName}</td>
              </tr>
              <tr>
                <td style="${labelColStyle}">${docDateRowLabel}</td>
                <td style="${valColStyle}">${qData.quotationNo} / ${qData.quotationDate}</td>
              </tr>
              <tr>
                <td style="${labelColStyle}">Customer / Site Address</td>
                <td style="${valColStyle}">${qData.siteAddress}</td>
              </tr>
              ${projectDetailRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Technical Details (Standard BOM) -->
        <div style="flex-shrink: 0; margin-top: 6px;">
          <div style="background: #0f2b48; color: #ffffff; padding: 7.5px 12px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.8px;">TECHNICAL DETAILS</span>
          </div>

          <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #d9e6ed; border-top: none; box-sizing: border-box; word-break: break-word;">
            <thead>
              ${technicalBomHeadersHtml}
            </thead>
            <tbody>
              ${technicalBomRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- High-res Solar Solutions Showcase Banner -->
        <div style="text-align: center; box-sizing: border-box; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 100%; height: 110px; overflow: hidden; margin-top: auto; margin-bottom: 8px;">
          <img src="${systemBlockDiagram}" style="width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 auto; image-rendering: high-quality; image-rendering: -webkit-optimize-contrast;" alt="ToGen Solar Agro Products and Systems Banner" />
        </div>
      </div>

      ${renderFooter(false)}
    </div>
  `;

  // Helper to render Commercials table rows and totals
  const renderCommercialsRowsHtml = (isCompact = false) => {
    const pricedItems = (qData.items || []).filter((item: any) => {
      const total = Number(item.total) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return total > 0 || unitPrice > 0;
    });

    let rowsHtml = '';
    let calculatedSubtotal = 0;

    // Visual padding: proportional commercial quotation sizing
    const rowPadding = isCompact ? '7.5px 6px' : '9.5px 6px';
    const descPadding = isCompact ? '7.5px 12px' : '9.5px 12px';
    const descFontSize = isCompact ? '10.5px' : '11px';
    const descLineHeight = isCompact ? '1.4' : '1.5';
    const pricePadding = isCompact ? '7.5px 10px' : '9.5px 10px';
    const totalRowPadding = isCompact ? '7.5px 12px' : '9.5px 12px';
    const totalRowPricePadding = isCompact ? '7.5px 10px' : '9.5px 10px';
    const grandRowPadding = isCompact ? '8px 12px' : '10px 12px';
    const grandRowPricePadding = isCompact ? '8px 10px' : '10px 10px';

    if (isIC) {
      const singleBase = (qData.subtotal !== undefined && qData.subtotal > 0)
        ? (qData.subtotal / 100)
        : (qData.grand_total ? Math.round((qData.grand_total / 100) / 1.18) : 0);
      calculatedSubtotal = singleBase;
      const isUnderReview = singleBase <= 0;
      const rateText = isUnderReview ? 'Subject to Authorized Pricing Review' : `${singleBase.toLocaleString('en-IN')}/-`;
      const icCapacityDisplay = capacityVal ? `${capacityVal} kW` : (qData.proposedSystem ? `${qData.proposedSystem}` : '');

      rowsHtml = `
        <tr>
          <td style="border: 1px solid #d9e6ed; padding: ${rowPadding}; text-align: center; font-weight: 800; background: #edf6f9; color: #008289; vertical-align: middle; box-sizing: border-box;">1</td>
          <td style="border: 1px solid #d9e6ed; padding: ${descPadding}; line-height: ${descLineHeight}; color: #1e293b; text-align: left; vertical-align: middle; box-sizing: border-box; font-size: ${descFontSize}; word-break: normal; overflow-wrap: break-word;">
            <b>Solar Installation & Commissioning (I&C) Services${icCapacityDisplay ? ` – ${icCapacityDisplay}` : ''}</b><br/>
            Design, Engineering, Installation and Commissioning (I&C) of ${icCapacityDisplay ? `${icCapacityDisplay} ` : ''}Solar System – Complete mechanical mounting, electrical cabling & terminations, inverter installation, earthing and pre-commissioning testing to grid synchronization.
          </td>
          <td style="border: 1px solid #d9e6ed; padding: ${pricePadding}; text-align: right; font-weight: 900; font-size: ${isUnderReview ? '11px' : '13px'}; color: ${isUnderReview ? '#d97706' : '#008289'}; vertical-align: middle; background: #f8fafc; box-sizing: border-box; white-space: nowrap;">
            ${rateText}
          </td>
        </tr>
      `;
    } else if (pricedItems.length > 0) {
      rowsHtml = pricedItems.map((item: any, idx: number) => {
        const pLookup = (item.item_id && productLookupMap) ? productLookupMap.get(item.item_id) : undefined;
        const descParagraph = generateCommercialProductDescription(item, qData.systemType, pLookup, qData.businessCategory);

        // Base product rate without GST: (unit_price * quantity - discount)
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const discount = Number(item.discount) || 0;
        const lineBase = unitPrice > 0 ? ((unitPrice * qty) - discount) / 100 : (Number(item.total) || 0) / 100;

        calculatedSubtotal += lineBase;
        const rateStr = `${lineBase.toLocaleString('en-IN')}/-`;

        return `
          <tr>
            <td style="border: 1px solid #d9e6ed; padding: ${rowPadding}; text-align: center; font-weight: 800; background: #edf6f9; color: #008289; vertical-align: middle; box-sizing: border-box;">${idx + 1}</td>
            <td style="border: 1px solid #d9e6ed; padding: ${descPadding}; line-height: ${descLineHeight}; color: #1e293b; text-align: left; vertical-align: middle; box-sizing: border-box; font-size: ${descFontSize}; word-break: normal; overflow-wrap: break-word;">
              ${descParagraph}
            </td>
            <td style="border: 1px solid #d9e6ed; padding: ${pricePadding}; text-align: right; font-weight: 900; font-size: 13px; color: #008289; vertical-align: middle; background: #f8fafc; box-sizing: border-box; white-space: nowrap;">
              ${rateStr}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      const singleBase = qData.subtotal ? (qData.subtotal / 100) : (qData.grand_total ? Math.round((qData.grand_total / 100) / 1.18) : 0);
      calculatedSubtotal = singleBase;
      rowsHtml = `
        <tr>
          <td style="border: 1px solid #d9e6ed; padding: ${rowPadding}; text-align: center; font-weight: 800; background: #edf6f9; color: #008289; vertical-align: middle; box-sizing: border-box;">1</td>
          <td style="border: 1px solid #d9e6ed; padding: ${descPadding}; line-height: ${descLineHeight}; color: #1e293b; text-align: left; vertical-align: middle; box-sizing: border-box; font-size: ${descFontSize}; word-break: normal; overflow-wrap: break-word;">
            ${qData.commercialDescription || (() => {
              const s = formatSystemTypeForCommercials(qData.systemType, qData.businessCategory);
              const fullLabel = s.toLowerCase().startsWith('solar') ? s : `Solar ${s}`;
              return `Design, Engineering, Supply and Commissioning of ${fullLabel}.`;
            })()}
          </td>
          <td style="border: 1px solid #d9e6ed; padding: ${pricePadding}; text-align: right; font-weight: 900; font-size: 13px; color: #008289; vertical-align: middle; background: #f8fafc; box-sizing: border-box; white-space: nowrap;">
            ${singleBase > 0 ? `${singleBase.toLocaleString('en-IN')}/-` : (qData.totalPrice || 'AS QUOTED')}
          </td>
        </tr>
      `;
    }

    // Subtotal resolution
    const finalSubtotalVal = (qData.subtotal !== undefined && qData.subtotal > 0)
      ? qData.subtotal / 100
      : calculatedSubtotal;

    const isReviewState = isIC && finalSubtotalVal <= 0;

    // Tax resolution
    let finalTaxVal = 0;
    if (qData.total_tax !== undefined && qData.total_tax > 0) {
      finalTaxVal = qData.total_tax / 100;
    } else if (finalSubtotalVal > 0) {
      finalTaxVal = Math.round(finalSubtotalVal * 0.18);
    }

    // Grand Total resolution (Total + GST)
    const finalGrandTotalVal = (qData.grand_total !== undefined && qData.grand_total > 0)
      ? qData.grand_total / 100
      : (finalSubtotalVal + finalTaxVal);

    let taxPct = 18;
    if (qData.manual_tax_rate !== undefined && qData.manual_tax_rate !== null && Number(qData.manual_tax_rate) >= 0) {
      taxPct = Number(qData.manual_tax_rate);
    } else {
      const baseForTax = qData.tax_inclusive ? (finalGrandTotalVal - finalTaxVal) : finalSubtotalVal;
      const rawTaxPct = baseForTax > 0 ? (finalTaxVal / baseForTax) * 100 : 18;
      taxPct = Number(rawTaxPct.toFixed(2));
      if (Math.abs(taxPct - 25) < 0.8) taxPct = 25;
      else if (Math.abs(taxPct - 18) < 0.8) taxPct = 18;
      else if (Math.abs(taxPct - 12) < 0.8) taxPct = 12;
      else if (Math.abs(taxPct - 5) < 0.8) taxPct = 5;
    }

    const halfTaxPct = taxPct % 2 === 0 ? (taxPct / 2).toString() : (taxPct / 2).toFixed(1);
    const gstLabel = taxPct > 0 ? `GST (${halfTaxPct}% + ${halfTaxPct}%)` : `GST (0%)`;

    // Discount resolution
    const finalDiscountVal = (qData.total_discount !== undefined && qData.total_discount > 0)
      ? qData.total_discount / 100
      : 0;

    // Subsidies from quotation form (robust handling for paise or rupees)
    const parseSubsidyToRupees = (val: any): number => {
      if (!val) return 0;
      const num = Number(val);
      if (isNaN(num) || num <= 0) return 0;
      return num >= 50000 ? Math.round(num / 100) : Math.round(num);
    };

    const stateSub = parseSubsidyToRupees(qData.state_subsidy);
    const centralSub = parseSubsidyToRupees(qData.central_subsidy);
    const totalSubsidy = stateSub + centralSub;

    const totalDisplay = isReviewState ? 'Subject to Authorized Review' : `${finalSubtotalVal.toLocaleString('en-IN')}/-`;
    const taxDisplay = isReviewState ? '18% Applicable Upon Review' : `${finalTaxVal.toLocaleString('en-IN')}/-`;
    const grandDisplay = isReviewState ? 'Authorized Pricing Review Required' : `${finalGrandTotalVal.toLocaleString('en-IN')}/-`;

    return `
      ${rowsHtml}
      <tr>
        <td colspan="2" style="border: 1px solid #d9e6ed; padding: ${totalRowPadding}; text-align: right; font-weight: 800; background: #edf6f9; color: #0f2b48; vertical-align: middle; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">${qData.tax_inclusive ? 'BASE AMOUNT' : 'TOTAL'}</td>
        <td style="border: 1px solid #d9e6ed; padding: ${totalRowPricePadding}; text-align: right; font-weight: 900; font-size: ${isCompact ? '11.5px' : '12.5px'}; color: #0f2b48; vertical-align: middle; background: #ffffff; box-sizing: border-box; white-space: nowrap;">
          ${qData.tax_inclusive ? `${Math.max(0, finalGrandTotalVal - finalTaxVal).toLocaleString('en-IN')}/-` : totalDisplay}
        </td>
      </tr>
      ${finalDiscountVal > 0 ? `
      <tr>
        <td colspan="2" style="border: 1px solid #d9e6ed; padding: ${totalRowPadding}; text-align: right; font-weight: 800; background: #f0fdf4; color: #166534; vertical-align: middle; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">GLOBAL DISCOUNT ${qData.discount_percent ? `(${qData.discount_percent}%)` : ''}</td>
        <td style="border: 1px solid #d9e6ed; padding: ${totalRowPricePadding}; text-align: right; font-weight: 900; font-size: ${isCompact ? '11.5px' : '12.5px'}; color: #166534; vertical-align: middle; background: #ffffff; box-sizing: border-box; white-space: nowrap;">
          -${finalDiscountVal.toLocaleString('en-IN')}/-
        </td>
      </tr>
      ` : ''}
      <tr>
        <td colspan="2" style="border: 1px solid #d9e6ed; padding: ${totalRowPadding}; text-align: right; font-weight: 800; background: #edf6f9; color: #0f2b48; vertical-align: middle; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">${gstLabel}${qData.tax_inclusive ? ' [Included]' : ''}</td>
        <td style="border: 1px solid #d9e6ed; padding: ${totalRowPricePadding}; text-align: right; font-weight: 900; font-size: ${isCompact ? '11.5px' : '12.5px'}; color: #0f2b48; vertical-align: middle; background: #ffffff; box-sizing: border-box; white-space: nowrap;">
          ${taxDisplay}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #d9e6ed; padding: ${grandRowPadding}; text-align: right; font-weight: 900; background: #edf6f9; color: #0f2b48; vertical-align: middle; box-sizing: border-box; font-size: ${isCompact ? '11px' : '12px'};">GRAND TOTAL</td>
        <td style="border: 1px solid #d9e6ed; padding: ${grandRowPricePadding}; text-align: right; font-weight: 900; font-size: ${isCompact ? '13px' : '14px'}; color: #008289; vertical-align: middle; background: #f8fafc; box-sizing: border-box; white-space: nowrap;">
          ${grandDisplay}
        </td>
      </tr>
      ${totalSubsidy > 0 ? `
        <tr>
          <td colspan="2" style="border: 1px solid #d9e6ed; padding: ${totalRowPadding}; text-align: right; font-weight: 800; background: #fff7ed; color: #c2410c; vertical-align: middle; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">State Subsidy + Central Subsidy</td>
          <td style="border: 1px solid #d9e6ed; padding: ${totalRowPricePadding}; text-align: right; font-weight: 900; font-size: ${isCompact ? '12px' : '13px'}; color: #c2410c; vertical-align: middle; background: #fff7ed; box-sizing: border-box; white-space: nowrap;">
            ${totalSubsidy.toLocaleString('en-IN')}/-
          </td>
        </tr>
      ` : ''}
    `;
  };

  const renderCommercialsTableBlock = (isCompact = false) => `
    <div style="background: #0f2b48; color: #ffffff; padding: ${isCompact ? '7.5px 14px' : '9px 16px'}; border-radius: ${isCompact ? '5px 5px 0 0' : '6px 6px 0 0'}; text-align: center; margin-bottom: 0;">
      <span style="font-size: ${isCompact ? '13px' : '15px'}; font-weight: 800; letter-spacing: ${isCompact ? '0.8px' : '1px'};">COMMERCIALS</span>
    </div>

    <table style="table-layout: fixed; width: 100%; border-collapse: collapse; margin-bottom: ${isCompact ? '0' : '12px'}; font-size: ${isCompact ? '10.5px' : '11px'}; border: 1px solid #d9e6ed; border-top: none; box-sizing: border-box; word-break: break-word;">
      <thead>
        <tr style="background-color: #0f2b48; color: #ffffff;">
          <th style="border: 1px solid #1e3a5f; padding: ${isCompact ? '7.5px 6px' : '8.5px 6px'}; text-align: center; width: 6%; font-weight: 800; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">Sl. No</th>
          <th style="border: 1px solid #1e3a5f; padding: ${isCompact ? '7.5px 12px' : '8.5px 12px'}; text-align: left; width: 72%; font-weight: 800; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">Description</th>
          <th style="border: 1px solid #1e3a5f; padding: ${isCompact ? '7.5px 10px' : '8.5px 10px'}; text-align: right; width: 22%; font-weight: 800; box-sizing: border-box; font-size: ${isCompact ? '10.5px' : '11px'};">Total Price (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${renderCommercialsRowsHtml(isCompact)}
      </tbody>
    </table>
  `;


  const buildCommercialTermsRowsHtml = (_withSignAndBank?: boolean) => {
    let termsHtml = '';
    let isJson = false;
    let termsArr: any[] = [];
    if (qData.payment_terms) {
      try {
        termsArr = JSON.parse(qData.payment_terms);
        isJson = Array.isArray(termsArr);
      } catch {
        isJson = false;
      }
    }
    const validityDays = qData.validity_days || 7;
    let expiryDateStr = '';
    const dateParts = (qData.quotationDate || '').split('.');
    if (dateParts.length === 3) {
      const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
      date.setDate(date.getDate() + validityDays);
      expiryDateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    } else {
      const date = new Date();
      date.setDate(date.getDate() + validityDays);
      expiryDateStr = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    }

    const pad = _withSignAndBank ? '5px 10px' : '7.5px 12px';
    const fSize = _withSignAndBank ? '10px' : '10.5px';
    const lHeight = _withSignAndBank ? '1.38' : '1.45';

    if (isJson) {
      termsHtml = termsArr.map((term: any, idx: number) => {
        let val = (term.value || '').trim();
        if (term.key && term.key.toLowerCase().includes('validity')) {
          if (!val) {
            val = `This offer is valid up to ${validityDays} Days from the date of submission`;
          } else if (val.includes('10 Days from the date of submission')) {
            val = val.replace(/10 Days from the date of submission/g, `${validityDays} Days from the date of submission`);
          }
        }
        if (term.key && term.key.toLowerCase().includes('delivery')) {
          if (val.includes('Within 10 Days from the date of receipt of the Purchase Order')) {
            val = val.replace(/Within 10 Days from the date of receipt of the Purchase Order/g, 'Within 7 Days from the date of receipt of the Purchase Order');
          }
        }
        const safeVal = val.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafbfc'};">
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">${term.key}</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; box-sizing: border-box; white-space: pre-wrap; word-wrap: break-word; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">${safeVal}</td>
        </tr>
        `;
      }).join('');
    } else {
      // Legacy Hardcoded Rendering
      termsHtml = `
        <tr>
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">Quote Validity</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; background: #ffffff; box-sizing: border-box; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">Valid up to ${expiryDateStr} (${validityDays} Days from the date of submission)</td>
        </tr>
        ${qData.payment_terms ? `
        <tr style="background-color: #fafbfc;">
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">Payment Terms</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; box-sizing: border-box; white-space: pre-wrap; word-wrap: break-word; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">${qData.payment_terms.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>
        ` : `
        <tr style="background-color: #fafbfc;">
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">Payment Terms</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; box-sizing: border-box; font-size: ${fSize}; line-height: ${lHeight}; vertical-align: top;">
            1. 10% along with confirmed work order (Material Procurement Advance)<br/>
            2. 80% against delivery of materials at site<br/>
            3. 10% after successful testing, commissioning & handing over
          </td>
        </tr>
        `}
        <tr>
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">Delivery Period</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; background: #ffffff; box-sizing: border-box; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">3 - 4 Weeks from the date of technically and commercially clear work order</td>
        </tr>
        <tr style="background-color: #fafbfc;">
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">Freight & Transit Insurance</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; box-sizing: border-box; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">Included</td>
        </tr>
        <tr>
          <td style="width: 32%; padding: ${pad}; font-weight: 800; color: #008289; border: 1px solid #d9e6ed; background: #edf6f9; box-sizing: border-box; font-size: ${fSize}; vertical-align: top;">Warranty</td>
          <td style="width: 68%; padding: ${pad}; color: #1e293b; border: 1px solid #d9e6ed; background: #ffffff; box-sizing: border-box; line-height: ${lHeight}; font-size: ${fSize}; vertical-align: top;">
            1. Solar PV Modules: 25 Years performance warranty as per manufacturer terms<br/>
            2. Solar Inverter: 5 Years replacement / repair warranty<br/>
            3. Whole System Installation: 5 Years comprehensive system warranty
          </td>
        </tr>
      `;
    }
    return termsHtml;
  };

  const renderBankDetailsAndSignatureBlocks = (isCompact = false) => {
    const isCanara = Boolean(
      targetBank && (
        (targetBank.bankName && targetBank.bankName.toUpperCase().includes('CANARA')) ||
        (targetBank.ifscCode && targetBank.ifscCode.toUpperCase().startsWith('CNRB')) ||
        (targetBank.accountNumber && targetBank.accountNumber.includes('120029515077'))
      )
    );

    const bankHtml = targetBank ? `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #0f2b48; padding: ${isCompact ? '10px 14px' : '12px 18px'}; border-radius: 8px; margin-bottom: ${isCompact ? '8px' : '12px'}; box-sizing: border-box; width: 100%;">
        <div style="flex: 1;">
          <div style="font-size: ${isCompact ? '12px' : '13px'}; font-weight: 800; color: #ffffff; margin-bottom: 4px; letter-spacing: 0.5px;">BANK ACCOUNT DETAILS</div>
          <table style="width: 100%; border-collapse: collapse; font-size: ${isCompact ? '10.5px' : '11px'}; color: #cbd5e1;">
            <tr><td style="padding: 1px 0; width: 35%; font-weight: 500;">Account Name:</td><td style="padding: 1px 0; font-weight: 600; color: #ffffff;">${targetBank.accountName}</td></tr>
            <tr><td style="padding: 1px 0; font-weight: 500;">Account No:</td><td style="padding: 1px 0; font-weight: 700; color: #60a5fa; font-size: ${isCompact ? '12px' : '13px'}; font-family: monospace;">${targetBank.accountNumber}</td></tr>
            <tr><td style="padding: 1px 0; font-weight: 500;">Bank & Branch:</td><td style="padding: 1px 0; font-weight: 600; color: #ffffff;">${targetBank.bankName}, ${targetBank.branchName}</td></tr>
            <tr><td style="padding: 1px 0; font-weight: 500;">IFSC Code:</td><td style="padding: 1px 0; font-weight: 600; color: #ffffff;">${targetBank.ifscCode}</td></tr>
            ${targetBank.upiId ? `<tr><td style="padding: 1px 0; font-weight: 500;">UPI ID:</td><td style="padding: 1px 0; font-weight: 600; color: #ffffff;">${targetBank.upiId}</td></tr>` : ''}
          </table>
        </div>
        ${(isCanara && canaraQrImg) ? `<div style="display: flex; flex-direction: column; align-items: center; margin-left: 14px; flex-shrink: 0;">
          <div style="color: #ffffff; font-size: 9px; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.5px; text-transform: uppercase;">QR Code</div>
          <div style="background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <img src="${canaraQrImg}" style="width: ${isCompact ? '72px' : '84px'}; height: ${isCompact ? '72px' : '84px'}; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Canara Bank UPI QR" />
          </div>
          <div style="color: #cbd5e1; font-size: 8px; font-weight: 600; margin-top: 2px; letter-spacing: 0.5px; text-transform: uppercase;">Scan to Pay</div>
        </div>` : ''}
      </div>
    ` : '';

    const vendorAndSignHtml = `
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: ${isCompact ? '10px 16px' : '18px 24px'}; background: #edf6f9; border: 1px solid #d9e6ed; border-radius: 10px; margin-top: 0; margin-bottom: ${isCompact ? '0' : '10px'}; box-sizing: border-box;">
        <div style="display: flex; flex-direction: column; justify-content: flex-start;">
          <div style="margin-bottom: ${isCompact ? '6px' : '12px'};">
            <div style="font-size: ${isCompact ? '10px' : '11px'}; font-weight: 800; color: #008289; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">
              Empanelled &amp; Registered Vendor
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="${mnreLogo}" style="height: ${isCompact ? '40px' : '48px'}; max-width: 110px; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="MNRE Registered Vendor Logo" />
              <img src="${tangedcoLogo}" style="height: ${isCompact ? '40px' : '48px'}; width: ${isCompact ? '40px' : '48px'}; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="TANGEDCO Empanelled Logo" />
            </div>
          </div>

          <div>
            <div style="font-size: ${isCompact ? '12px' : '13px'}; font-weight: 800; color: #0f2b48; margin-bottom: 2px;">TO-GEN SOLAR AGRO</div>
            <div style="font-size: ${isCompact ? '9.5px' : '10.5px'}; color: #475569; line-height: 1.4;">
              3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil, Madurai – 625301<br/>
              GSTIN: 33BJWPA4500M1Z6 • Contact: +91 63803 29294<br/>
              <b>${docRefLabel}:</b> ${qData.quotationNo}
            </div>
          </div>
        </div>

        <div style="text-align: center; width: ${isCompact ? '210px' : '230px'}; background: #ffffff; border: 1px dashed #008289; border-radius: 8px; padding: ${isCompact ? '6px 12px' : '10px 14px'}; box-sizing: border-box;">
          <div style="font-size: 11px; font-weight: 800; color: #008289; margin-bottom: 2px;">For TO-GEN SOLAR AGRO,</div>
          <div style="height: ${isCompact ? '46px' : '56px'}; display: flex; align-items: center; justify-content: center; margin: 2px 0;">
            <img src="${signImg}" style="max-height: ${isCompact ? '44px' : '52px'}; max-width: 180px; object-fit: contain; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" alt="P. Alagu Pandi Signature" />
          </div>
          <div style="font-size: 12.5px; font-weight: 800; color: #0f2b48; margin-top: 1px;">P. Alagu Pandi</div>
          <div style="font-size: 10.5px; font-weight: 700; color: #475569;">Proprietor</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Date: ${qData.quotationDate}</div>
        </div>
      </div>
    `;

    return `
      <div style="margin-top: ${isCompact ? '0' : 'auto'}; width: 100%;">
        ${bankHtml}
        ${vendorAndSignHtml}
      </div>
    `;
  };


  // Page 5: Dedicated Important Notes & Disclaimer Page (with Bank Details & Signature in concise mode)
  const renderNotesAndDisclaimerPageHtml = (withSignAndBank: boolean) => `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; min-height: 0; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: ${withSignAndBank ? '0' : '10px'};">
        <div style="${withSignAndBank ? '' : 'margin-top: auto; margin-bottom: 30px;'} flex-shrink: 0;">
          <!-- Important Notes & Disclaimer Section -->
          <div style="background: #0f2b48; color: #ffffff; padding: 8.5px 16px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 15px; font-weight: 800; letter-spacing: 0.8px;">IMPORTANT NOTES &amp; DISCLAIMER</span>
          </div>

          <div style="border: 1px solid #d9e6ed; border-top: none; border-radius: 0 0 6px 6px; padding: ${withSignAndBank ? '12px 18px' : '14px 20px'}; background: #ffffff; box-sizing: border-box; margin-bottom: ${withSignAndBank ? '10px' : '0'};">
            <div style="background: #008289; color: #ffffff; padding: 4px 14px; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; margin-bottom: 6px; border-radius: 3px; display: inline-block;">
              NOTES:
            </div>
            
            <ol style="font-size: 11.5px; line-height: 1.55; color: #1e293b; padding-left: 20px; margin: 0 0 10px 0;">
              <li style="margin-bottom: 3.5px;">Customer shall arrange for civil foundation work, required space for inverter, module mounting structure, cable trays, and electrical room.</li>
              <li style="margin-bottom: 3.5px;">Water and Electricity for installation, fabrication and testing shall be provided free of cost by the customer.</li>
              <li style="margin-bottom: 3.5px;">The customer is responsible for safe storage of materials once delivered at site until completion of installation.</li>
              <li style="margin-bottom: 3.5px;">TANGEDCO feasibility approval, net-meter application, and commissioning will be facilitated by TO-GEN SOLAR AGRO.</li>
              <li style="margin-bottom: 3.5px;">Any statutory charges, deposits, or application fees payable to TANGEDCO/CEIG shall be borne directly by the customer.</li>
              <li style="margin-bottom: 3.5px;">Solar generation depends on seasonal climatic conditions, direct sunshine hours, shading, and regular panel cleaning by the customer.</li>
              <li style="margin-bottom: 3.5px;">Internet connectivity (Wi-Fi / LAN with stable signal near the inverter) for remote monitoring logger must be provided by the customer.</li>
            </ol>

            <div style="background: #dc2626; color: #ffffff; padding: 4px 14px; font-weight: 800; font-size: 11.5px; letter-spacing: 0.5px; margin-bottom: 6px; border-radius: 3px; display: inline-block;">
              DISCLAIMER:
            </div>
            
            <p style="font-size: 11px; line-height: 1.55; color: #1e293b; text-align: justify; margin: 0; padding-left: 4px;">
              Warranty is not covered for the damages due to natural calamities, acts of god, theft &amp; vandalism, site related problems, attempt of servicing by a third party and negligence of customer. We are not liable for any type of compensation for damages caused to person, place and things due to the above-mentioned reasons. The warranty will become null and void if the installation is done by people other than those authorized by TO-GEN SOLAR AGRO.
            </p>
          </div>
        </div>

        ${withSignAndBank ? renderBankDetailsAndSignatureBlocks(true) : ''}
      </div>

      ${renderFooter(false)}
    </div>
  `;

  // Page 3: Combined Commercials Table & Commercial Terms and Conditions Page
  const commercialsWithTermsPageHtml = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; min-height: 0; z-index: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 24px; margin-bottom: 12px;">
        <!-- Section 1: Commercials Table -->
        <div style="flex-shrink: 0;">
          ${renderCommercialsTableBlock(true)}
        </div>

        <!-- Section 2: Commercial Terms & Conditions -->
        <div style="flex-shrink: 0;">
          <div style="background: #0f2b48; color: #ffffff; padding: 7.5px 14px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.8px;">COMMERCIAL TERMS AND CONDITIONS</span>
          </div>

          <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #d9e6ed; border-top: none; box-sizing: border-box; word-break: break-word; background: #ffffff;">
            <tbody>
              ${buildCommercialTermsRowsHtml(false)}
            </tbody>
          </table>
        </div>
      </div>

      ${renderFooter(false)}
    </div>
  `;

  // Page 4 in full mode: Combined Customer Required Documents & Important Notes & Disclaimer
  const customerDocsAndNotesPageHtml = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; min-height: 0; z-index: 1; display: flex; flex-direction: column; justify-content: flex-start; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 4px; height: 16px; background: #008289; border-radius: 2px; flex-shrink: 0;"></div>
            <h2 style="margin: 0; color: #0f2b48; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">CUSTOMER REQUIRED DOCUMENTS</h2>
          </div>
          <span style="color: #475569; font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">PM - SURYA GHAR SUBSIDY</span>
        </div>

        <div style="color: #64748b; font-size: 9px; line-height: 1.3; margin: 0 0 8px 2px;">
          Official sample reference copies of documents required for PM - Surya Ghar Muft Bijli Yojana subsidy registration and net-meter sanctioning.
        </div>

        <!-- Official Required Documents Table in high-visibility 2-column layout with sample photos -->
        <table style="table-layout: fixed; width: 100%; border-collapse: collapse; margin-bottom: 0; border: 1.5px solid #0f2b48; box-sizing: border-box; background: #ffffff;">
          <thead>
            <tr style="background-color: #0f2b48; color: #ffffff;">
              <th style="border: 1px solid #1e3a5f; padding: 4.5px 8px; text-align: left; width: 50%; font-weight: 700; font-size: 10px; box-sizing: border-box; letter-spacing: 0.3px;">
                CUSTOMER REQUIRED DOCUMENT (1 / 2)
              </th>
              <th style="border: 1px solid #1e3a5f; padding: 4.5px 8px; text-align: left; width: 50%; font-weight: 700; font-size: 10px; box-sizing: border-box; letter-spacing: 0.3px;">
                CUSTOMER REQUIRED DOCUMENT (2 / 2)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <!-- Row 1: Aadhaar Card & PAN Card -->
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">1. Aadhaar Card</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">ID &amp; ADDRESS PROOF</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${sampleAadhaar}" style="max-height: 68px; max-width: 325px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample Aadhaar Card" />
                </div>
              </td>
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">2. PAN Card</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">TAX &amp; DBT IDENTIFICATION</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${samplePan}" style="max-height: 68px; max-width: 325px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample PAN Card" />
                </div>
              </td>
            </tr>
            <tr>
              <!-- Row 2: Electricity Bill & Property Ownership Document -->
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">3. Electricity Bill (TANGEDCO)</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">LATEST EB RECEIPT</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${sampleEbBill}" style="max-height: 68px; max-width: 325px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample Electricity Bill" />
                </div>
              </td>
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">4. Property / Ownership Document</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">TAX RECEIPT / PATTA</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${samplePropertyTax}" style="max-height: 68px; max-width: 325px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample Ownership Document" />
                </div>
              </td>
            </tr>
            <tr>
              <!-- Row 3: Bank Passbook & Passport Photo -->
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">5. Bank Account Details</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">PASSBOOK / CHEQUE</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${sampleBankPassbook}" style="max-height: 68px; max-width: 325px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample Bank Passbook" />
                </div>
              </td>
              <td style="border: 1px solid #d9e6ed; padding: 4px 6px; vertical-align: top; width: 50%; box-sizing: border-box; background: #fafcff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  <span style="font-weight: 800; color: #0f2b48; font-size: 10.5px;">6. Passport Size Photograph</span>
                  <span style="font-size: 7.5px; font-weight: 700; color: #008289; background: #e6f4f1; padding: 1px 4px; border-radius: 2px;">RECENT COLOR PHOTO</span>
                </div>
                <div style="height: 72px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; box-sizing: border-box;">
                  <img src="${samplePhoto}" style="max-height: 68px; max-width: 70px; width: auto; height: auto; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast;" alt="Sample Passport Photograph" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Section 2: Important Notes & Disclaimer -->
        <div style="margin-top: 16px;">
          <div style="background: #0f2b48; color: #ffffff; padding: 5px 12px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 12.5px; font-weight: 800; letter-spacing: 0.8px;">IMPORTANT NOTES &amp; DISCLAIMER</span>
          </div>

          <div style="border: 1px solid #d9e6ed; border-top: none; border-radius: 0 0 6px 6px; padding: 8px 12px; background: #ffffff; box-sizing: border-box;">
            <div style="background: #008289; color: #ffffff; padding: 2px 8px; font-weight: 800; font-size: 9.5px; letter-spacing: 0.5px; margin-bottom: 3px; border-radius: 3px; display: inline-block;">
              NOTES:
            </div>
            
            <ol style="font-size: 9px; line-height: 1.35; color: #1e293b; padding-left: 16px; margin: 0 0 6px 0;">
              <li style="margin-bottom: 2px;">Customer shall arrange for civil foundation work, required space for inverter, module mounting structure, cable trays, and electrical room.</li>
              <li style="margin-bottom: 2px;">Water and Electricity for installation, fabrication and testing shall be provided free of cost by the customer.</li>
              <li style="margin-bottom: 2px;">The customer is responsible for safe storage of materials once delivered at site until completion of installation.</li>
              <li style="margin-bottom: 2px;">TANGEDCO feasibility approval, net-meter application, and commissioning will be facilitated by TO-GEN SOLAR AGRO.</li>
              <li style="margin-bottom: 2px;">Any statutory charges, deposits, or application fees payable to TANGEDCO/CEIG shall be borne directly by the customer.</li>
              <li style="margin-bottom: 2px;">Solar generation depends on seasonal climatic conditions, direct sunshine hours, shading, and regular panel cleaning by the customer.</li>
              <li style="margin-bottom: 2px;">Internet connectivity (Wi-Fi / LAN with stable signal near the inverter) for remote monitoring logger must be provided by the customer.</li>
            </ol>

            <div style="background: #dc2626; color: #ffffff; padding: 2px 8px; font-weight: 800; font-size: 9.5px; letter-spacing: 0.5px; margin-bottom: 3px; border-radius: 3px; display: inline-block;">
              DISCLAIMER:
            </div>
            
            <p style="font-size: 9px; line-height: 1.35; color: #475569; margin: 0;">
              Warranty does not cover damages caused due to natural calamities, physical vandalism, unauthorized tampering, grid surges, or external factors beyond our control.
            </p>
          </div>
        </div>
      </div>

      ${renderFooter(false)}
    </div>
  `;

  // Combined Project Implementation Schedule & Banking Loans Page
  const scheduleAndBankingPageHtml = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; min-height: 0; z-index: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 22px; margin-bottom: 12px;">
        <!-- Section 1: Project Implementation Schedule -->
        <div>
          <div style="background: #0f2b48; color: #ffffff; padding: 7px 14px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 13.5px; font-weight: 800; letter-spacing: 0.8px;">PROJECT IMPLEMENTATION SCHEDULE</span>
          </div>

          <div style="border: 1px solid #d9e6ed; border-top: none; border-radius: 0 0 6px 6px; padding: 10px 14px; background: #ffffff; text-align: center; box-sizing: border-box;">
            <img src="${implSchedule}" style="width: 100%; max-height: 335px; object-fit: contain; display: block; margin: 0 auto; image-rendering: high-quality; image-rendering: -webkit-optimize-contrast;" alt="Project Implementation Schedule" />
          </div>
        </div>

        <!-- Section 2: Banking Loans & Financial Assistance -->
        <div>
          <div style="background: #0f2b48; color: #ffffff; padding: 7px 14px; border-radius: 5px 5px 0 0; text-align: center; margin-bottom: 0;">
            <span style="font-size: 13.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">BANKING LOANS</span>
          </div>

          <div style="border: 1px solid #d9e6ed; border-top: none; border-radius: 0 0 6px 6px; padding: 10px 14px; background: #ffffff; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; width: 100%;">
              <div style="height: 1px; flex: 1; background: #d9e6ed;"></div>
              <span style="font-size: 13px; font-weight: 800; color: #0f2b48; letter-spacing: 1px; text-transform: uppercase;">Our Banking Partners</span>
              <div style="height: 1px; flex: 1; background: #d9e6ed;"></div>
            </div>
            <div style="width: 100%; text-align: center; display: flex; justify-content: center; align-items: center;">
              <img src="${bankingPartnersHd}" style="width: 100%; max-height: 295px; object-fit: contain; display: block; margin: 0 auto; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality; image-rendering: crisp-edges;" alt="Our Banking Partners" />
            </div>
          </div>
        </div>
      </div>

      ${renderFooter(false)}
    </div>
  `;

  // Page 7 (Final Page in full mode): PM Surya Ghar Work Process & Compulsory Official Sign-off Box
  const page9Html = `
    <div class="quotation-pdf-page" style="${pageBaseStyle}">
      ${renderTopBar()}
      ${renderHeader()}
      ${renderWatermark()}

      <div style="flex: 1; z-index: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="background: #0f2b48; color: #ffffff; padding: 10px 16px; border-radius: 6px 6px 0 0; text-align: center; margin-bottom: 12px;">
          <span style="font-size: 15.5px; font-weight: 800; letter-spacing: 0.5px;">PM - SURYA GHAR WORK PROCESS & OFFICIAL AUTHORIZATION</span>
        </div>

        <!-- High-Resolution Work Process Graphic -->
        <div style="border: 1px solid #d9e6ed; border-radius: 8px; padding: 16px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04); text-align: center; margin-bottom: 16px; box-sizing: border-box;">
          <img src="${workProcess}" style="width: 100%; max-height: 420px; object-fit: contain; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality; image-rendering: crisp-edges;" alt="Work Process" />
        </div>

        ${renderBankDetailsAndSignatureBlocks(false)}
      </div>

      ${renderFooter()}
    </div>
  `;

    const customerImagesPageHtml = renderCustomerImagesPage(
      qData.images,
      renderTopBar,
      renderHeader,
      renderWatermark,
      renderFooter,
      pageBaseStyle
    );

    const pagesHtml = shouldShowSubsidyAndProcessPages ? [
      page1Html,
      page2Html,
      commercialsWithTermsPageHtml,
      customerDocsAndNotesPageHtml,
      ...(customerImagesPageHtml ? [customerImagesPageHtml] : []),
      scheduleAndBankingPageHtml,
      page9Html,
    ] : [
      page1Html,
      page2Html,
      commercialsWithTermsPageHtml,
      renderNotesAndDisclaimerPageHtml(true),
    ];

    return { pagesHtml, qData };
}

export async function generateQuotationPDF(
  input: Quotation | QuotationPdfData,
  customFilename?: string
): Promise<void> {
  try {
    const { pagesHtml, qData } = await generateQuotationPdfPagesHtml(input);
    const safeRef = (qData.quotationNo || 'Quotation').replace(/[^a-zA-Z0-9]/g, '_');
    const safeCust = (qData.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const filename = customFilename || `Quotation_${safeRef}_${safeCust}.pdf`;

    // 1. Native Electron C++ Vector Engine: Completes in ~0.35s with 100% vector clarity!
    if (typeof window !== 'undefined' && (window as any)?.desktop?.quotations?.generatePdf) {
      try {
        const res = await (window as any).desktop.quotations.generatePdf({ pagesHtml, filename });
        if (res && res.success) {
          const rawBytes = res.data?.pdfBytes;
          const b64 = res.data?.dataBase64 || res.dataBase64;
          let blob: Blob | null = null;

          if (rawBytes) {
            blob = new Blob([rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes)], { type: 'application/pdf' });
          } else if (b64) {
            const byteCharacters = atob(b64);
            const byteNumbers = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            blob = new Blob([byteNumbers], { type: 'application/pdf' });
          }

          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }
          return;
        }
      } catch (nativeErr) {
        console.warn('[PDF] Native printToPDF error, falling back to client jsPDF engine:', nativeErr);
      }
    }

    // 2. High-speed client-side fallback (< 1.5s with GPU acceleration & zero quality loss):
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore
      }
    }

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;width:794px;z-index:-99999;pointer-events:none;background:#ffffff;margin:0;padding:0;overflow:visible;';
    host.innerHTML = pagesHtml.join('');
    document.body.appendChild(host);

    const totalHeight = 1123 * pagesHtml.length;
    // Scale 2.0 gives ~1588x2246 per page, high-DPI crystal clear clarity when zooming with zero noise
    const renderScale = 2.0;
    const canvas = await html2canvas(host, {
      scale: renderScale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: totalHeight,
      windowWidth: 794,
      windowHeight: totalHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      logging: false,
      imageTimeout: 300,
    });

    document.body.removeChild(host);

    const sliceWidth = Math.round(794 * renderScale);
    const sliceHeight = Math.round(1123 * renderScale);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = sliceWidth;
    sliceCanvas.height = sliceHeight;
    const sCtx = sliceCanvas.getContext('2d', { alpha: false });
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
    }

    for (let i = 0; i < pagesHtml.length; i++) {
      if (sCtx) {
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, sliceWidth, sliceHeight);
        sCtx.drawImage(
          canvas,
          0, i * sliceHeight, sliceWidth, sliceHeight,
          0, 0, sliceWidth, sliceHeight
        );
      }

      // 0.95 high-fidelity quality prevents compression artifacts and noise when zoomed in
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
    canvas.width = 0;
    canvas.height = 0;

    pdf.save(filename);
  } catch (e) {
    console.error('Failed to generate PDF', e);
  }
}
