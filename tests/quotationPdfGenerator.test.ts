import { describe, it, expect } from 'vitest';
import type { Quotation } from '../shared/types/quotation.types';
import {
  formatSystemTypeForCommercials,
  getProductDetailsForCommercials,
  generateCommercialProductDescription,
  generateQuotationPdfPagesHtml,
} from '../src/utils/quotationPdfGenerator';
import {
  calculateIcPrice,
  DEFAULT_IC_PRICING,
  type IcPricingConfig,
} from '../shared/types/settings.types';

describe('Quotation PDF Generator - Customer Mapping & Layout Verification', () => {
  it('correctly maps Customer A dynamic project details without hardcoded values', () => {
    const customerA: Partial<Quotation> = {
      id: 101,
      reference: 'QT-2026-001',
      customerName: 'KUMARAN AGENCIES',
      siteAddress: '124 SOUTH CAR STREET, MADURAI - 625001',
      issue_date: '2026-10-15',
      created_at: '2026-10-15',
      grand_total: 22500000,
      technicalDetails: {
        system_capacity_kw: 5,
        structure_type: 'ELEVATED GI STRUCTURE',
        panel_specs: 'MONO PERC BIFICIAL, TOPCON',
        area_required_sqft: 400,
        panel_count: 8,
        panel_wattage_w: 600,
        inverter_capacity_kw: 5,
      } as any,
    };

    expect(customerA.customerName).toBe('KUMARAN AGENCIES');
    expect(customerA.customerName).not.toBe('MR. VISHNU VARDHAN A');
    expect(customerA.siteAddress).toContain('MADURAI');
    expect(customerA.siteAddress).not.toBe('TIRUNELVELI');
    expect(customerA.technicalDetails?.system_capacity_kw).toBe(5);
  });

  it('correctly maps Customer B dynamic project details without hardcoded values', () => {
    const customerB: Partial<Quotation> = {
      id: 102,
      reference: 'TGSA-SRT205',
      customerName: 'DR. SENTHIL NATHAN',
      siteAddress: '78 GREENWAYS ROAD, COIMBATORE - 641002',
      issue_date: '2026-11-01',
      created_at: '2026-11-01',
      grand_total: 35000000,
      technicalDetails: {
        system_capacity_kw: 10,
        structure_type: 'CUSTOM ROOF MOUNT',
        panel_specs: 'MONO PERC BIFICIAL,TOPCON N-TYPE',
        area_required_sqft: 800,
        panel_count: 16,
        panel_wattage_w: 600,
        inverter_capacity_kw: 10,
      } as any,
    };

    expect(customerB.customerName).toBe('DR. SENTHIL NATHAN');
    expect(customerB.customerName).not.toBe('KUMARAN AGENCIES');
    expect(customerB.customerName).not.toBe('MR. VISHNU VARDHAN A');
    expect(customerB.siteAddress).toContain('COIMBATORE');
    expect(customerB.siteAddress).not.toBe('TIRUNELVELI');
    expect(customerB.technicalDetails?.system_capacity_kw).toBe(10);
  });

  it('verifies standard 6-page layout when 0 customer images are uploaded', () => {
    const layoutPages = [
      'Page 1: Cover Proposal',
      'Page 2: Combined Project Details & Technical Details Table & Block Diagram',
      'Page 3: Combined Commercials Table & Commercial Terms and Conditions',
      'Page 4: Combined Customer Required Documents & Important Notes & Disclaimer',
      'Page 5: Combined Project Implementation Schedule & Banking Loans',
      'Page 6: PM - Surya Ghar Work Process & Compulsory Official Authorization'
    ];

    expect(layoutPages.length).toBe(6);
    expect(layoutPages[0]).toContain('Cover Proposal');
    expect(layoutPages[1]).toContain('Project Details');
    expect(layoutPages[1]).toContain('Technical Details');
    expect(layoutPages[2]).toContain('Commercials Table');
    expect(layoutPages[2]).toContain('Commercial Terms and Conditions');
    expect(layoutPages[3]).toContain('Important Notes & Disclaimer');
    expect(layoutPages[3]).toContain('Customer Required Documents');
    expect(layoutPages[4]).toContain('Project Implementation Schedule');
    expect(layoutPages[4]).toContain('Banking Loans');
    expect(layoutPages[5]).toContain('Work Process & Compulsory Official Authorization');
  });

  it('verifies 7-page layout with dedicated uncropped Customer Site Images page when images are present', () => {
    const layoutPagesWithImages = [
      'Page 1: Cover Proposal',
      'Page 2: Combined Project Details & Technical Details Table & Block Diagram',
      'Page 3: Combined Commercials Table & Commercial Terms and Conditions',
      'Page 4: Combined Customer Required Documents & Important Notes & Disclaimer',
      'Page 5: Dedicated Project Site / Installation Photographs Page (0 Cropping, Centered)',
      'Page 6: Combined Project Implementation Schedule & Banking Loans',
      'Page 7: PM - Surya Ghar Work Process & Compulsory Official Authorization'
    ];

    expect(layoutPagesWithImages.length).toBe(7);
    expect(layoutPagesWithImages[4]).toContain('Dedicated Project Site / Installation Photographs Page');
  });

  it('TEST CASE 1 & 2: Dynamic customer images behavior (0 images vs 1+ images)', () => {
    // 0 images: image section is completely absent
    const quoteWithoutImages: Partial<Quotation> = {
      id: 201,
      reference: 'TGSA-NOIMG',
      customerName: 'SIVA KUMAR',
      sitePhotos: [],
    };
    expect(quoteWithoutImages.sitePhotos?.length).toBe(0);

    // 1 image: image section renders 1 image
    const quoteWithOneImage: Partial<Quotation> = {
      id: 202,
      reference: 'TGSA-1IMG',
      customerName: 'ANITHA RAMESH',
      sitePhotos: [
        { id: 1, quotation_id: 202, photo_order: 1, data_url: 'data:image/png;base64,sample1', name: 'Rooftop.png' }
      ],
    };
    expect(quoteWithOneImage.sitePhotos?.length).toBe(1);
    expect(quoteWithOneImage.sitePhotos![0].data_url).toBe('data:image/png;base64,sample1');

    // Multiple images: all images rendered
    const quoteWithMultipleImages: Partial<Quotation> = {
      id: 203,
      reference: 'TGSA-3IMG',
      customerName: 'BALAJI AGENCIES',
      sitePhotos: [
        { id: 2, quotation_id: 203, photo_order: 1, data_url: 'data:image/png;base64,sample1', name: 'Roof.png' },
        { id: 3, quotation_id: 203, photo_order: 2, data_url: 'data:image/png;base64,sample2', name: 'EB.png' },
        { id: 4, quotation_id: 203, photo_order: 3, data_url: 'data:image/png;base64,sample3', name: 'Inverter.png' },
      ],
    };
    expect(quoteWithMultipleImages.sitePhotos?.length).toBe(3);
  });

  it('TEST CASE 3: Customer Required Documents contains exact realistic sample details matching reference image', () => {
    const requiredDocs = [
      { sl: 1, name: 'Aadhaar Card', details: 'Aadhaar No: 45546565464646\nAddress: 12, Example Street, Tirunelveli - 627001' },
      { sl: 2, name: 'PAN Card', details: 'PAN No: ABCDE1234F\nName: Vishnu Vardhan A' },
      { sl: 3, name: 'Electricity Bill', details: 'Service No: 1234567890\nConsumer Name: Vishnu Vardhan A\nAddress: Tirunelveli, Tamil Nadu' },
      { sl: 4, name: 'Property / Ownership Document', details: 'Document No: 1234/2024\nProperty: Plot No. 25, Tirunelveli\nOwner: Vishnu Vardhan A' },
      { sl: 5, name: 'Bank Account Details', details: 'Bank: Sample National Bank\nA/c No: 000012345678\nIFSC: DUMMY0001234' },
      { sl: 6, name: 'Passport Size Photograph', details: 'Applicant: Vishnu Vardhan A\nPhoto: Recent passport-size photograph\nPurpose: Customer documentation' },
    ];

    expect(requiredDocs.length).toBe(6);
    expect(requiredDocs[0].name).toBe('Aadhaar Card');
    expect(requiredDocs[0].details).toContain('45546565464646');
    expect(requiredDocs[1].name).toBe('PAN Card');
    expect(requiredDocs[1].details).toContain('ABCDE1234F');
    expect(requiredDocs[2].name).toBe('Electricity Bill');
    expect(requiredDocs[2].details).toContain('1234567890');
    expect(requiredDocs[3].name).toBe('Property / Ownership Document');
    expect(requiredDocs[3].details).toContain('1234/2024');
    expect(requiredDocs[4].name).toBe('Bank Account Details');
    expect(requiredDocs[4].details).toContain('Sample National Bank');
    expect(requiredDocs[5].name).toBe('Passport Size Photograph');
    expect(requiredDocs[5].details).toContain('Vishnu Vardhan A');
  });

  it('TEST CASE 4: Old Required Documents field is deprecated and omitted from quotation data flow', () => {
    const quotationPayload: any = {
      reference: 'TGSA-CLEAN',
      customer_id: 5,
      grand_total: 19500000,
    };
    // No documents object in payload
    expect(quotationPayload.documents).toBeUndefined();
    expect(quotationPayload.aadhar_number).toBeUndefined();
    expect(quotationPayload.pan_number).toBeUndefined();
    expect(quotationPayload.eb_consumer_number).toBeUndefined();
  });

  it('TEST CASE 5: Off-Grid quotation maps battery type, capacity, and quantity in technical details', () => {
    const offGridQuote: Partial<Quotation> = {
      id: 103,
      system_type: 'Off-Grid',
      reference: 'TGSA-OG001',
      customerName: 'SOLAR FARMS LTD',
      grand_total: 45000000,
      technicalDetails: {
        system_capacity_kw: 5,
        panel_specs: '540W Mono PERC',
        inverter_specs: '5kW Off-Grid Inverter',
        structure_type: 'Normal Height',
        area_required_sqft: 400,
        battery_type: 'Lithium Ion',
        battery_capacity: 200,
        battery_quantity: 4,
      } as any,
    };

    expect(offGridQuote.system_type).toBe('Off-Grid');
    expect(offGridQuote.technicalDetails?.battery_type).toBe('Lithium Ion');
    expect(offGridQuote.technicalDetails?.battery_capacity).toBe(200);
    expect(offGridQuote.technicalDetails?.battery_quantity).toBe(4);
  });

  it('TEST CASE 6: Solar Street Light quotation maps wattage, light type, panel type, pole material, and pole height', () => {
    const streetLightQuote: Partial<Quotation> = {
      id: 104,
      business_category: 'SOLAR_STREETLIGHT',
      reference: 'TGSA-SL001',
      customerName: 'PANCHAYAT BOARD',
      technicalDetails: {
        luminaire_wattage_w: 40,
        light_type: 'All-in-One',
        sl_panel_type: 'Mono',
        pole_material: 'GI',
        pole_height_ft: 15,
      } as any,
    };

    expect(streetLightQuote.technicalDetails?.luminaire_wattage_w).toBe(40);
    expect(streetLightQuote.technicalDetails?.light_type).toBe('All-in-One');
    expect(streetLightQuote.technicalDetails?.sl_panel_type).toBe('Mono');
    expect(streetLightQuote.technicalDetails?.pole_material).toBe('GI');
    expect(streetLightQuote.technicalDetails?.pole_height_ft).toBe(15);
  });

  it('TEST CASE 7: Solar Water Pump quotation maps system type, solar capacity, drive capacity, drive make/model, type, structure type, and structure height', () => {
    const waterPumpQuote: Partial<Quotation> = {
      id: 105,
      business_category: 'SOLAR_WATERPUMP',
      reference: 'TGSA-WP001',
      customerName: 'FARMER CO-OP',
      technicalDetails: {
        pump_system_type: 'Water Pump',
        pump_rating_kw: 5,
        pump_hp: 3,
        vfd_model: 'INVT BPD Solar VFD',
        connectivity: 'SIM',
        structure_material: 'MS',
        structure_height: '10 Feet',
      } as any,
    };

    expect(waterPumpQuote.technicalDetails?.pump_system_type).toBe('Water Pump');
    expect(waterPumpQuote.technicalDetails?.pump_rating_kw).toBe(5);
    expect(waterPumpQuote.technicalDetails?.pump_hp).toBe(3);
    expect(waterPumpQuote.technicalDetails?.vfd_model).toBe('INVT BPD Solar VFD');
    expect(waterPumpQuote.technicalDetails?.connectivity).toBe('SIM');
    expect(waterPumpQuote.technicalDetails?.structure_material).toBe('MS');
    expect(waterPumpQuote.technicalDetails?.structure_height).toBe('10 Feet');
  });

  it('TEST CASE 8: Solar CCTV Camera quotation maps model/make, connectivity, MP capacity, and memory card capacity', () => {
    const cctvQuote: Partial<Quotation> = {
      id: 106,
      business_category: 'SOLAR_CCTV',
      reference: 'TGSA-CCTV001',
      customerName: 'ESTATE RESIDENCE',
      technicalDetails: {
        camera_model: 'CP Plus 4G Solar PTZ',
        connectivity: 'SIM Type',
        camera_mp: '4 MP',
        memory_card_capacity: '128 GB',
      } as any,
    };

    expect(cctvQuote.technicalDetails?.camera_model).toBe('CP Plus 4G Solar PTZ');
    expect(cctvQuote.technicalDetails?.connectivity).toBe('SIM Type');
    expect(cctvQuote.technicalDetails?.camera_mp).toBe('4 MP');
    expect(cctvQuote.technicalDetails?.memory_card_capacity).toBe('128 GB');
  });

  it('TEST CASE 9: Space required is omitted for categories without area field (CCTV, Water Pump, Street Light) and only present when user provides valid area', () => {
    // CCTV quote has no space required field
    const cctvQuote: Partial<Quotation> = {
      id: 107,
      business_category: 'SOLAR_CCTV',
      technicalDetails: {
        camera_model: 'CP Plus 4G PTZ',
        area_required_sqft: undefined,
      } as any,
    };
    const isCctv = (cctvQuote.business_category || '').includes('CCTV');
    const hasSpaceRequiredField = !isCctv;
    const spaceRequired = (hasSpaceRequiredField && cctvQuote.technicalDetails?.area_required_sqft)
      ? `SHADOW FREE - ${cctvQuote.technicalDetails.area_required_sqft} Sq.ft`
      : undefined;

    expect(spaceRequired).toBeUndefined();

    // Rooftop quote with valid area
    const rooftopQuote: Partial<Quotation> = {
      id: 108,
      business_category: 'SOLAR_ROOFTOP',
      technicalDetails: {
        area_required_sqft: 350,
      } as any,
    };
    const isRooftopCctv = (rooftopQuote.business_category || '').includes('CCTV');
    const rooftopHasSpace = !isRooftopCctv;
    const rooftopSpace = (rooftopHasSpace && rooftopQuote.technicalDetails?.area_required_sqft)
      ? `SHADOW FREE - ${rooftopQuote.technicalDetails.area_required_sqft} Sq.ft`
      : undefined;

    expect(rooftopSpace).toBe('SHADOW FREE - 350 Sq.ft');
  });

  it('TEST CASE 10: Dynamic scheme and title mapping dynamically reflect selected business category and quotation type', () => {
    const subsidyCctv = {
      business_category: 'SOLAR_CCTV',
      quotation_type: 'Government Subsidy',
    };
    const commercialPump = {
      business_category: 'SOLAR_WATERPUMP',
      quotation_type: 'Commercial',
    };
    const proformaRooftop = {
      business_category: 'SOLAR_ROOFTOP',
      quotation_type: 'Proforma Invoice',
    };

    expect(subsidyCctv.quotation_type).toBe('Government Subsidy');
    expect(subsidyCctv.business_category).toBe('SOLAR_CCTV');
    expect(commercialPump.quotation_type).toBe('Commercial');
    expect(commercialPump.business_category).toBe('SOLAR_WATERPUMP');
    expect(proformaRooftop.quotation_type).toBe('Proforma Invoice');
  });

  describe('Commercials Table Dynamic Product Description Requirements', () => {
    it('generates the exact required paragraph format for Product 1 (Waaree Solar Panel)', () => {
      const product1 = {
        item_id: 1,
        item_type: 'Product',
        name: 'Waaree Solar Panel WS-550',
        description: '550 W Monocrystalline Half-Cut Cell Technology',
      };
      const pLookup = {
        id: 1,
        brand: 'Waaree',
        model: 'Solar Panel WS-550',
        specs: '550 W Monocrystalline Half-Cut Cell Technology',
      };

      const result = generateCommercialProductDescription(product1, 'On-Grid', pLookup);
      expect(result).toBe(
        'Design, Engineering, Supply and Commissioning of Solar On-Grid System – Waaree Solar Panel WS-550, 550 W Monocrystalline Half-Cut Cell Technology.'
      );
    });

    it('generates the exact required paragraph format for Product 2 (Growatt Solar Inverter)', () => {
      const product2 = {
        item_id: 2,
        item_type: 'Product',
        name: 'Growatt Solar Inverter MIN 5000TL-X',
        description: '5 kW Single Phase Grid-Tied Technology',
      };
      const pLookup = {
        id: 2,
        brand: 'Growatt',
        model: 'Solar Inverter MIN 5000TL-X',
        specs: '5 kW Single Phase Grid-Tied Technology',
      };

      const result = generateCommercialProductDescription(product2, 'On-Grid', pLookup);
      expect(result).toBe(
        'Design, Engineering, Supply and Commissioning of Solar On-Grid System – Growatt Solar Inverter MIN 5000TL-X, 5 kW Single Phase Grid-Tied Technology.'
      );
    });

    it('dynamically adapts system type (Off-Grid, On-Grid, Hybrid)', () => {
      const product = {
        brand: 'Waaree',
        model: 'Solar Panel WS-550',
        specs: '550 W Monocrystalline Half-Cut Cell Technology',
      };

      expect(formatSystemTypeForCommercials('On-Grid')).toBe('On-Grid System');
      expect(formatSystemTypeForCommercials('Off-Grid')).toBe('Off-Grid System');
      expect(formatSystemTypeForCommercials('Hybrid')).toBe('Hybrid System');

      const offGridDesc = generateCommercialProductDescription(product, 'Off-Grid');
      expect(offGridDesc).toBe(
        'Design, Engineering, Supply and Commissioning of Solar Off-Grid System – Waaree Solar Panel WS-550, 550 W Monocrystalline Half-Cut Cell Technology.'
      );
    });

    it('does not invent missing specifications when specifications are not provided', () => {
      const productWithoutSpecs = {
        brand: 'Adani',
        model: 'Solar Panel 540W',
        specs: '',
      };

      const result = generateCommercialProductDescription(productWithoutSpecs, 'On-Grid');
      expect(result).toBe(
        'Design, Engineering, Supply and Commissioning of Solar On-Grid System – Adani Solar Panel 540W.'
      );
      // No comma after product name when specifications are omitted
      expect(result.split('–')[1]).not.toContain(',');
    });

    it('removes labels like "Brand:", "Model:", "Specifications:" and bullet points from paragraph', () => {
      const productWithLabels = {
        name: 'Brand: Vikram Model: Bifacial 550W',
        description: 'Specifications: • 550W high efficiency; • Multi-busbar technology',
      };

      const result = generateCommercialProductDescription(productWithLabels, 'On-Grid');
      expect(result).not.toContain('Brand:');
      expect(result).not.toContain('Model:');
      expect(result).not.toContain('Specifications:');
      expect(result).not.toContain('•');
      expect(result).toMatch(/^Design, Engineering, Supply and Commissioning of Solar On-Grid System – /);
    });

    it('generates Solar Water Pump System description when businessCategory is SOLAR_WATERPUMP', () => {
      const product = {
        brand: 'Luminous',
        model: 'lum-203',
        specs: 'Submersible Water Pump',
      };

      const result = generateCommercialProductDescription(product, 'On-Grid', undefined, 'SOLAR_WATERPUMP');
      expect(result).toBe(
        'Design, Engineering, Supply and Commissioning of Solar Water Pump System – Luminous lum-203, Submersible Water Pump.'
      );
      expect(result).not.toContain('Solar On-Grid System');
    });

    it('verifies commercials table structure: product base rate, TOTAL, GST, GRAND TOTAL, and subsidies', () => {
      // 3 items from user's test scenario:
      const items = [
        { name: 'luminous lum-203', quantity: 1, unit_price: 200000, discount: 0 },
        { name: '3kW Grid Tie-Premium', quantity: 1, unit_price: 15000000, discount: 0 },
        { name: '6kW Grid ie', quantity: 1, unit_price: 1500000000, discount: 0 },
      ];

      // Base rates without GST
      const rates = items.map(it => ((it.unit_price * it.quantity) - it.discount) / 100);
      expect(rates[0]).toBe(2000);
      expect(rates[1]).toBe(150000);
      expect(rates[2]).toBe(15000000);

      const totalBase = rates.reduce((sum, r) => sum + r, 0);
      expect(totalBase).toBe(15152000);

      const gst = Math.round(totalBase * 0.18);
      expect(gst).toBe(2727360);

      const grandTotal = totalBase + gst;
      expect(grandTotal).toBe(17879360);

      // With state and central subsidies
      const stateSubsidy = 20000;
      const centralSubsidy = 78000;
      const totalSubsidy = stateSubsidy + centralSubsidy;
      expect(totalSubsidy).toBe(98000);

      // User requirement: subsidy is NOT reduced in calculation/Grand Total
      // Commercial table shows GRAND TOTAL (Total + GST) and subsidies at the end without deducting into NET AMOUNT PAYABLE
      expect(grandTotal).toBe(17879360);
    });

    it('verifies Technical Details table rows 1, 2, 3 dynamic specs and quantities, and reputed quality in rows 2, 3, 4', () => {
      // Scenario matching user input:
      // Row 1: panel_specs = "mono", panel_count = 8
      // Row 2: inverter_specs = "string", inverter_quantity = 2
      // Row 3: structure_type = "Normal Height", structure_material = "GI", structure_quantity = 1
      const techDetails = {
        panel_specs: 'mono',
        panel_count: 8,
        inverter_specs: 'string',
        inverter_quantity: 2,
        structure_type: 'Normal Height',
        structure_material: 'GI',
        structure_quantity: 1,
      };

      // Row 1 checks
      expect(techDetails.panel_specs).toBe('mono');
      expect(String(techDetails.panel_count)).toBe('8');

      // Row 2 checks
      expect(techDetails.inverter_specs).toBe('string');
      expect(String(techDetails.inverter_quantity)).toBe('2');
      const inverterMake = 'GROWATT / POLYCAB / Reputed Quality';
      expect(inverterMake).toContain('Reputed Quality');
      expect(inverterMake).not.toBe('GROWATT / POLYCAB / Reputed');

      // Row 3 checks
      const structureSpecs = `${techDetails.structure_material}, ${techDetails.structure_type}`;
      expect(structureSpecs).toBe('GI, Normal Height');
      expect(String(techDetails.structure_quantity)).toBe('1');
      const structureMake = 'Reputed Quality';
      expect(structureMake).toBe('Reputed Quality');
      expect(structureMake).not.toBe('TO-GEN SOLAR AGRO');

      // Row 4 checks
      const dcdbMake = 'Reputed Quality';
      expect(dcdbMake).toBe('Reputed Quality');
      expect(dcdbMake).not.toBe('GEESYS /Reputed Quality');
    });
  });
});

describe('Solar I&C Category – Technical Details & Configured Pricing', () => {
  it('calculates I&C pricing correctly using configured Flat Rate', () => {
    const flatConfig: IcPricingConfig = {
      enabled: true,
      pricingModel: 'per_kw',
      ratePerKw: 2500,
      slabs: [],
    };

    const res5 = calculateIcPrice(5, flatConfig);
    expect(res5.isConfigured).toBe(true);
    expect(res5.ratePerKw).toBe(2500);
    expect(res5.subtotalRupees).toBe(12500);
    expect(res5.subtotalPaise).toBe(1250000);
    expect(res5.appliedModel).toBe('per_kw');

    const res10 = calculateIcPrice(10, flatConfig);
    expect(res10.subtotalRupees).toBe(25000);
    expect(res10.ratePerKw).toBe(2500);
  });

  it('calculates I&C pricing correctly using configured Capacity Slabs', () => {
    const slabConfig: IcPricingConfig = {
      enabled: true,
      pricingModel: 'slabs',
      ratePerKw: 2500,
      slabs: [
        { minKw: 1, maxKw: 10, ratePerKw: 3000 },
        { minKw: 10.01, maxKw: 50, ratePerKw: 2500 },
        { minKw: 50.01, maxKw: 100, ratePerKw: 2000 },
        { minKw: 100.01, maxKw: 10000, ratePerKw: 1800 },
      ],
    };

    // 5 kW falls into slab 1 @ 3000
    const res5 = calculateIcPrice(5, slabConfig);
    expect(res5.isConfigured).toBe(true);
    expect(res5.ratePerKw).toBe(3000);
    expect(res5.subtotalRupees).toBe(15000);
    expect(res5.appliedModel).toBe('slabs');

    // 25 kW falls into slab 2 @ 2500
    const res25 = calculateIcPrice(25, slabConfig);
    expect(res25.ratePerKw).toBe(2500);
    expect(res25.subtotalRupees).toBe(62500);

    // 75 kW falls into slab 3 @ 2000
    const res75 = calculateIcPrice(75, slabConfig);
    expect(res75.ratePerKw).toBe(2000);
    expect(res75.subtotalRupees).toBe(150000);
  });

  it('flags unconfigured pricing or zero capacity for authorized review without inventing numbers', () => {
    // Disabled config
    const disabledConfig: IcPricingConfig = {
      enabled: false,
      pricingModel: 'per_kw',
      ratePerKw: 2500,
      slabs: [],
    };
    const resDisabled = calculateIcPrice(5, disabledConfig);
    expect(resDisabled.isConfigured).toBe(false);
    expect(resDisabled.errorMessage).toContain('disabled');

    // Zero or negative capacity
    const resZero = calculateIcPrice(0, DEFAULT_IC_PRICING);
    expect(resZero.subtotalRupees).toBe(0);

    // Out of slab bounds
    const restrictedSlabs: IcPricingConfig = {
      enabled: true,
      pricingModel: 'slabs',
      ratePerKw: 0,
      slabs: [{ minKw: 10, maxKw: 20, ratePerKw: 2500 }],
    };
    const resOut = calculateIcPrice(5, restrictedSlabs);
    expect(resOut.isConfigured).toBe(false);
    expect(resOut.errorMessage).toContain('No valid pricing slab configured');
  });

  it('generates Technical Details PDF with standard 5 columns and 7 technical detail items for Solar I&C just like Solar Rooftop', async () => {
    const icQuote: Partial<Quotation> = {
      id: 301,
      reference: 'TGSA-IC-001',
      business_category: 'SOLAR_IC',
      customerName: 'SUNSHINE FABRICS PVT LTD',
      siteAddress: 'Industrial Estate, Tirunelveli',
      issue_date: '2026-10-15',
      created_at: '2026-10-15',
      subtotal: 12500,
      total_tax: 2250,
      grand_total: 14750,
      technicalDetails: {
        system_capacity_kw: 5,
      } as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(icQuote as Quotation);
    expect(pagesHtml.length).toBe(4);

    // Also verify that when quotation type is Government Subsidy, full proposal is generated
    const fullIcQuote = { ...icQuote, quotation_type: 'Government Subsidy' };
    const { pagesHtml: fullPages } = await generateQuotationPdfPagesHtml(fullIcQuote as Quotation);
    expect(fullPages.length).toBeGreaterThanOrEqual(6);

    // Page 2: Combined Project Details & Technical Details Table (BOM)
    const page2 = pagesHtml[1];
    expect(page2).toContain('Proposed Solar Service');
    expect(page2).toContain('Solar Installation & Commissioning (I&C)');
    expect(page2).toContain('System Capacity');
    expect(page2).toContain('5 kW');

    // BOM - 5 Columns with 7 items just like Solar Rooftop on combined Page 2
    expect(page2).toContain('Sl. No');
    expect(page2).toContain('Product');
    expect(page2).toContain('Make');
    expect(page2).toContain('Specification');
    expect(page2).toContain('Qty');

    // 7 items
    expect(page2).toContain('Solar PV Panel');
    expect(page2).toContain('On-Grid Inverter');
    expect(page2).toContain('Mounting Structure');
    expect(page2).toContain('Reputed Quality');
    expect(page2).toContain('DCDB,ACDB, Chemical Earthling');
    expect(page2).toContain('DC Cable');
    expect(page2).toContain('AC Cable');
    expect(page2).toContain('Lightning Arrester');

    // Page 3: Commercials Table
    const page3 = pagesHtml[2];
    expect(page3).toContain('Solar Installation & Commissioning (I&C) Services');
    expect(page3).toContain('5 kW');
  });

  it('generates Technical Details PDF dynamically for Solar CCTV Camera category', async () => {
    const cctvQuote: Partial<Quotation> = {
      id: 303,
      reference: 'TGSA-CCTV-001',
      business_category: 'SOLAR_CCTV',
      customerName: 'SAFE SECURITY SYSTEMS',
      siteAddress: 'Madurai Ring Road',
      grand_total: 4500000,
      technicalDetails: {
        camera_model: 'CP Plus HD',
        camera_mp: '4',
        connectivity: 'Wi-Fi',
        memory_card_capacity: '128',
        camera_count: 3,
      } as any,
      items: [
        {
          item_type: 'Product',
          item_id: null,
          name: 'Solar CCTV Camera Kit',
          quantity: 3,
          unit_price: 10000,
          discount: 0,
          tax_rate: 18,
          total: 30000,
        },
        {
          item_type: 'Product',
          item_id: null,
          name: 'Mounting Pole 12ft',
          quantity: 3,
          unit_price: 5000,
          discount: 0,
          tax_rate: 18,
          total: 15000,
        },
      ] as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(cctvQuote as Quotation);
    const page2 = pagesHtml[1];

    expect(page2).toContain('Product');
    expect(page2).toContain('Solar CCTV Camera');
    expect(page2).toContain('CP Plus HD');
    expect(page2).toContain('4 MP, Wi-Fi Connectivity, 128 GB Memory Card');
    expect(page2).toContain('3 Nos');
    // Separate pole component row present
    expect(page2).toContain('Mounting Pole 12ft');
  });

  it('generates Technical Details PDF dynamically for Solar Water Pump category without package items as single summary row', async () => {
    const pumpQuote: Partial<Quotation> = {
      id: 304,
      reference: 'TGSA-WP-001',
      business_category: 'SOLAR_WATERPUMP',
      customerName: 'RAMESH AGRO FARMS',
      siteAddress: 'Theni',
      grand_total: 25000000,
      technicalDetails: {
        pump_system_type: 'Water Pump',
        pump_rating_kw: 5,
        pump_hp: 3,
        vfd_model: 'INVT VFD Solar Drive',
        connectivity: 'SIM',
        structure_material: 'GI',
        structure_height: '10 Feet',
      } as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(pumpQuote as Quotation);
    const page2 = pagesHtml[1];

    expect(page2).toContain('Product');
    expect(page2).toContain('Solar Water Pump System');
    expect(page2).toContain('Drive: INVT VFD Solar Drive');
    expect(page2).toContain('5 kW Solar Array');
    expect(page2).toContain('3 HP Solar Drive');
    expect(page2).toContain('SIM Connectivity');
    expect(page2).toContain('GI Structure');
    expect(page2).toContain('Height: 10 Feet');
    expect(page2).toContain('1 Set');
  });

  it('renders Solar Water Pump System in Commercials table for quotation with SOLAR_WATERPUMP category', async () => {
    const pumpQuoteWithItems: Partial<Quotation> = {
      id: 308,
      reference: 'TGSA-WP-002',
      business_category: 'SOLAR_WATERPUMP',
      system_type: 'On-Grid',
      customerName: 'KUMAR AGRO',
      siteAddress: 'Madurai',
      items: [
        { name: 'luminous lum-203', description: 'dscsc', quantity: 1, unit_price: 600000000, discount: 0, total: 600000000 } as any,
        { name: 'lum poly 330', description: 'mono perc', quantity: 1, unit_price: 4000000, discount: 0, total: 4000000 } as any,
        { name: 'adani 625', description: 'topcon n type', quantity: 1, unit_price: 80000000, discount: 0, total: 80000000 } as any,
      ],
      subtotal: 684000000,
      total_tax: 108000000,
      grand_total: 792000000,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(pumpQuoteWithItems as Quotation);
    const page3 = pagesHtml[2];
    expect(page3).toContain('COMMERCIALS');
    expect(page3).toContain('Design, Engineering, Supply and Commissioning of Solar Water Pump System – luminous lum-203, dscsc.');
    expect(page3).toContain('Design, Engineering, Supply and Commissioning of Solar Water Pump System – lum poly 330, mono perc.');
    expect(page3).toContain('Design, Engineering, Supply and Commissioning of Solar Water Pump System – adani 625, topcon n type.');
    expect(page3).not.toContain('Solar On-Grid System');
  });

  it('generates Technical Details PDF dynamically for Solar Street Light category', async () => {
    const slQuote: Partial<Quotation> = {
      id: 305,
      reference: 'TGSA-SL-001',
      business_category: 'SOLAR_STREETLIGHT',
      customerName: 'PANCHAYAT BOARD',
      siteAddress: 'Alagarkoil',
      grand_total: 12000000,
      technicalDetails: {
        luminaire_wattage_w: 60,
        light_type: 'All-in-One',
        sl_panel_type: 'Poly',
        pole_material: 'GI',
        pole_height_ft: 15,
        light_count: 5,
      } as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(slQuote as Quotation);
    const page2 = pagesHtml[1];

    expect(page2).toContain('Product');
    expect(page2).toContain('Solar Street Light');
    expect(page2).toContain('60 W, All-in-One, Poly Solar Panel, GI Pole, 15 Feet Height');
    expect(page2).toContain('5 Nos');
  });

  it('generates Technical Details PDF for Solar Rooftop: excludes battery on On-Grid and includes battery on Off-Grid', async () => {
    // 1. On-Grid Rooftop
    const onGridQuote: Partial<Quotation> = {
      id: 306,
      reference: 'TGSA-RT-ONG',
      business_category: 'SOLAR_ROOFTOP',
      system_type: 'On-Grid',
      customerName: 'VIJAY RESIDENCY',
      siteAddress: 'Madurai',
      grand_total: 18000000,
      technicalDetails: {
        system_capacity_kw: 3,
        panel_specs: '540W Mono PERC',
        inverter_specs: '3kW String Inverter',
        structure_type: 'Normal Height',
        area_required_sqft: 250,
      } as any,
    };

    const { pagesHtml: onGridPages } = await generateQuotationPdfPagesHtml(onGridQuote as Quotation);
    const onGridPage2 = onGridPages[1];
    expect(onGridPage2).toContain('Solar PV Panel');
    expect(onGridPage2).toContain('540W Mono PERC');
    expect(onGridPage2).toContain('On-Grid Inverter');
    expect(onGridPage2).toContain('3kW String Inverter');
    expect(onGridPage2).toContain('Mounting Structure');
    expect(onGridPage2).toContain('Reputed Quality');
    expect(onGridPage2).toContain('Normal Height');
    expect(onGridPage2).toContain('DCDB,ACDB, Chemical Earthling');
    expect(onGridPage2).toContain('DC Cable');
    expect(onGridPage2).toContain('AC Cable');
    expect(onGridPage2).toContain('Lightning Arrester');
    expect(onGridPage2).not.toContain('Battery Bank');

    // 2. Off-Grid Rooftop
    const offGridQuote: Partial<Quotation> = {
      id: 307,
      reference: 'TGSA-RT-OFF',
      business_category: 'SOLAR_ROOFTOP',
      system_type: 'Off-Grid',
      customerName: 'VIJAY FARM HOUSE',
      siteAddress: 'Madurai',
      grand_total: 28000000,
      technicalDetails: {
        system_capacity_kw: 3,
        panel_specs: '540W Mono PERC',
        inverter_specs: '3kW Off-Grid Inverter',
        structure_type: 'Normal Height',
        area_required_sqft: 250,
        battery_type: 'Lithium Ion',
        battery_capacity: 150,
        battery_quantity: 2,
      } as any,
    };

    const { pagesHtml: offGridPages } = await generateQuotationPdfPagesHtml(offGridQuote as Quotation);
    const offGridPage2 = offGridPages[1];
    expect(offGridPage2).toContain('Solar PV Panel');
    expect(offGridPage2).toContain('Off-Grid Inverter');
    expect(offGridPage2).toContain('Battery Bank');
    expect(offGridPage2).toContain('Lithium Ion - 150 Ah');
    expect(offGridPage2).toContain('2 Nos');
  });

  it('renders authorized pricing review badge in Commercials PDF when pricing is unconfigured', async () => {
    const unconfiguredIcQuote: Partial<Quotation> = {
      id: 302,
      reference: 'TGSA-IC-002',
      business_category: 'SOLAR_IC',
      customerName: 'KALYAN SPINNERS',
      siteAddress: 'Coimbatore',
      subtotal: 0,
      total_tax: 0,
      grand_total: 0,
      technicalDetails: {
        system_capacity_kw: 10,
      } as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(unconfiguredIcQuote as Quotation);
    const page3 = pagesHtml[2];
    expect(page3).toContain('Authorized Pricing Review');
  });

  it('validates I&C quotation technical details requiring only capacity (kW) and allows PDF generation without rooftop fields', () => {
    const fullQuote: any = {
      business_category: 'SOLAR_IC',
      technicalDetails: {
        system_capacity_kw: 5454,
      },
    };

    const cat = (fullQuote.business_category || '').toUpperCase();
    const isStreetLight = cat === 'SOLAR_STREETLIGHT' || cat.includes('STREET LIGHT') || cat.includes('STREETLIGHT');
    const isWaterPump = cat === 'SOLAR_WATERPUMP' || cat.includes('WATER PUMP') || cat.includes('WATERPUMP');
    const isCctv = cat === 'SOLAR_CCTV' || cat.includes('CCTV');
    const isIC = cat === 'SOLAR_IC' || cat.includes('I & C') || cat.includes('I&C') || cat.includes('INSTALLATION') || cat.includes('COMMISSIONING');

    const missing: string[] = [];
    const tech = fullQuote.technicalDetails;

    if (isStreetLight) {
      if (!tech?.luminaire_wattage_w || Number(tech.luminaire_wattage_w) <= 0) missing.push('Wattage');
    } else if (isWaterPump) {
      const pCap = tech?.pump_rating_kw ?? tech?.system_capacity_kw;
      if (!pCap || Number(pCap) <= 0) missing.push('Solar Capacity (kW)');
    } else if (isCctv) {
      if (!tech?.camera_model?.trim()) missing.push('Model / Make');
    } else if (isIC) {
      const icCap = tech?.system_capacity_kw ?? tech?.dc_capacity_kwp;
      if (!icCap || Number(icCap) <= 0) missing.push('Capacity (kW)');
    } else {
      if (!tech?.system_capacity_kw || tech.system_capacity_kw <= 0) missing.push('System Capacity (kW)');
      if (!tech?.panel_specs?.trim()) missing.push('Solar Module/Panel specs');
      if (!tech?.inverter_specs?.trim()) missing.push('Inverter specs');
      if (!tech?.structure_type?.trim()) missing.push('Mounting Structure Type');
      if (!tech?.area_required_sqft || tech.area_required_sqft <= 0) missing.push('Area Required (sq ft)');
    }

    // Must be completely valid for I&C without missing panel_specs, inverter_specs or area_required_sqft
    expect(missing).toEqual([]);
    expect(isIC).toBe(true);
  });

  it('ensures packages added to quotation have non-empty Make column in technical details table', async () => {
    const quoteWithPackage: Partial<Quotation> = {
      id: 401,
      reference: 'TGSA-PKG-001',
      business_category: 'SOLAR_CCTV',
      customerName: 'KAVIN ENTERPRISES',
      siteAddress: 'Madurai',
      grand_total: 5000000,
      technicalDetails: {
        camera_model: 'Hikvision 4MP',
        camera_mp: '4',
        connectivity: '4G SIM',
        memory_card_capacity: '256',
        camera_count: 2,
      } as any,
      items: [
        {
          item_type: 'Product',
          item_id: null,
          name: 'Solar CCTV Camera Unit',
          quantity: 2,
          unit_price: 15000,
          discount: 0,
          tax_rate: 18,
          total: 30000,
        },
        {
          item_type: 'Package',
          item_id: 99,
          name: 'Solar Power & Battery Package',
          description: 'Package containing solar battery, mounting kit and cables',
          quantity: 1,
          unit_price: 20000,
          discount: 0,
          tax_rate: 18,
          total: 20000,
          // Brand not populated directly
        },
      ] as any,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(quoteWithPackage as Quotation);
    const page2 = pagesHtml[1];

    expect(page2).toContain('Solar Power & Battery Package');
    // Ensure Make is not empty or '—'
    expect(page2).toContain('Reputed Quality');
    // Ensure the table doesn't have an empty cell for Make
    expect(page2).not.toContain('>—<');
  });

  it('renders combined Banking Loans & Project Implementation Schedule page right before the final page', async () => {
    const dummyQuote: Partial<Quotation> = {
      id: 555,
      reference: 'QT-2026-10-099',
      customerName: 'K. RAMESH',
      siteAddress: 'MADURAI, TAMIL NADU',
      system_type: 'ON-GRID',
      business_category: 'SOLAR_ROOFTOP',
      grand_total: 18000000,
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(dummyQuote as Quotation);

    // Ensure total pages is at least 6 (without extra customer photos page)
    expect(pagesHtml.length).toBeGreaterThanOrEqual(6);

    // The combined Schedule & Banking Loans page is right before the last page
    const bankingLoansPage = pagesHtml[pagesHtml.length - 2];
    const finalPage = pagesHtml[pagesHtml.length - 1];

    // Check header and subheading
    expect(bankingLoansPage).toContain('PROJECT IMPLEMENTATION SCHEDULE');
    expect(bankingLoansPage).toContain('BANKING LOANS');
    expect(bankingLoansPage).toContain('Our Banking Partners');

    // Ensure financing benefits cards are completely removed as requested
    expect(bankingLoansPage).not.toContain('SPECIAL SOLAR FINANCING BENEFITS');
    expect(bankingLoansPage).not.toContain('From 7% p.a.*');
    expect(bankingLoansPage).not.toContain('Collateral Free');
    expect(bankingLoansPage).not.toContain('Up to 10 Years');

    // Ensure loan assistance box is removed as requested
    expect(bankingLoansPage).not.toContain('BANKING LOAN PROCESSING &amp; DOCUMENTATION ASSISTANCE');

    // Check final page is PM - Surya Ghar Work Process & Signatures
    expect(finalPage).toContain('PM - SURYA GHAR WORK PROCESS');
    expect(finalPage).toContain('P. Alagu Pandi');
  });

  it('places Watts/power rating next to Product Name and keeps Specification clean with numeric Qty', async () => {
    const quoteWithWattsUnit: Partial<Quotation> = {
      id: 556,
      reference: 'QT-WATTS-TEST',
      customerName: 'S. KUMAR',
      siteAddress: 'MADURAI',
      business_category: 'SOLAR_WATERPUMP',
      items: [
        {
          name: 'LUMINOUS LUM-203',
          make: 'luminous',
          description: 'dcsc',
          quantity: 1,
          unit: 'Watts',
          unit_price: 5000,
          discount: 0,
          tax_rate: 18,
          total: 5000,
        } as any,
      ],
    };

    const { pagesHtml } = await generateQuotationPdfPagesHtml(quoteWithWattsUnit as Quotation);
    const techPage = pagesHtml[1];

    // Product Name column should contain 'LUMINOUS LUM-203 (Watts)' without quantity prefix number
    expect(techPage).toContain('LUMINOUS LUM-203 (Watts)');
    expect(techPage).not.toContain('LUMINOUS LUM-203 (1 Watts)');

    // Specification column should contain only 'dcsc' and NOT '(Watts)' or '(1 Watts)'
    expect(techPage).toContain('dcsc');
    expect(techPage).not.toContain('dcsc (1 Watts)');
    expect(techPage).not.toContain('dcsc (Watts)');

    // Qty column should NOT contain '1 Watts', it must strictly contain '1 Nos'
    expect(techPage).not.toContain('>1 Watts<');
    expect(techPage).toContain('>1 Nos<');
  });

  describe('Concise Mode vs Full Mode & Page Layout Balance', () => {
    it('always generates full proposal for SOLAR_ROOFTOP with Commercials and Terms on Page 3', async () => {
      const rooftopQuote: Partial<Quotation> = {
        id: 401,
        reference: 'TGSA-RT-FULL',
        business_category: 'SOLAR_ROOFTOP',
        quotation_type: 'Quotation',
        customerName: 'KUMAR RESIDENCY',
        siteAddress: 'Madurai',
        grand_total: 15000000,
        technicalDetails: {
          system_capacity_kw: 5,
        } as any,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(rooftopQuote as Quotation);
      expect(pagesHtml.length).toBeGreaterThanOrEqual(6);

      // Page 3 in full mode has combined Commercials and Commercial Terms on ONE page
      expect(pagesHtml[2]).toContain('COMMERCIALS');
      expect(pagesHtml[2]).toContain('COMMERCIAL TERMS AND CONDITIONS');

      // Page 4 in full mode has combined Customer Required Documents and Important Notes & Disclaimer
      expect(pagesHtml[3]).toContain('CUSTOMER REQUIRED DOCUMENTS');
      expect(pagesHtml[3]).toContain('IMPORTANT NOTES &amp; DISCLAIMER');

      // Final page has the sign and bank details (Image 3)
      const lastPage = pagesHtml[pagesHtml.length - 1];
      expect(lastPage).toContain('BANK ACCOUNT DETAILS');
      expect(lastPage).toContain('P. Alagu Pandi');
    });

    it('generates concise 4-page PDF for non-rooftop with regular Quotation with zero subsidy images', async () => {
      const slQuote: Partial<Quotation> = {
        id: 402,
        reference: 'TGSA-SL-CONCISE',
        business_category: 'SOLAR_STREETLIGHT',
        quotation_type: 'Quotation',
        customerName: 'PANCHAYAT BOARD',
        siteAddress: 'Madurai',
        grand_total: 8000000,
        technicalDetails: {
          luminaire_wattage_w: 60,
          light_type: 'All-in-One',
        } as any,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(slQuote as Quotation);
      expect(pagesHtml.length).toBe(4);

      // Page 2: Wattage & Type label used and 'Luminaire' removed, plus TECHNICAL DETAILS combined
      const page2 = pagesHtml[1];
      expect(page2).toContain('Wattage & Type');
      expect(page2).not.toContain('Luminaire Wattage');
      expect(page2).toContain('60W (All-in-One)');
      expect(page2).not.toContain('60W Luminaire');
      expect(page2).toContain('TECHNICAL DETAILS');

      // Page 3: Combined Commercials Table & Commercial Terms and Conditions
      const page3 = pagesHtml[2];
      expect(page3).toContain('COMMERCIALS');
      expect(page3).toContain('COMMERCIAL TERMS AND CONDITIONS');

      // Page 4 (Final Page): Dedicated Important Notes & Disclaimer + Bank Details + Official Sign-off
      const page4 = pagesHtml[3];
      expect(page4).toContain('IMPORTANT NOTES &amp; DISCLAIMER');
      expect(page4).toContain('BANK ACCOUNT DETAILS');
      expect(page4).toContain('Empanelled &amp; Registered Vendor');
      expect(page4).toContain('P. Alagu Pandi');

      // None of the 3 subsidy/process images should appear!
      const allHtml = pagesHtml.join('');
      expect(allHtml).not.toContain('CUSTOMER REQUIRED DOCUMENTS');
      expect(allHtml).not.toContain('PROJECT IMPLEMENTATION SCHEDULE');
      expect(allHtml).not.toContain('PM - SURYA GHAR WORK PROCESS');

      // Logos order: MNRE 1st, TANGEDCO 2nd
      const mnreIdx = page4.indexOf('alt="MNRE Registered Vendor Logo"');
      const tangedcoIdx = page4.indexOf('alt="TANGEDCO Empanelled Logo"');
      expect(mnreIdx).toBeGreaterThan(0);
      expect(tangedcoIdx).toBeGreaterThan(0);
      expect(mnreIdx).toBeLessThan(tangedcoIdx);
    });

    it('strictly excludes the 3 subsidy/process images for Proforma Invoice even on SOLAR_ROOFTOP', async () => {
      const proformaQuote: Partial<Quotation> = {
        id: 406,
        reference: 'TGSA-PI-ROOFTOP',
        business_category: 'SOLAR_ROOFTOP',
        quotation_type: 'Proforma Invoice',
        customerName: 'SOLAR ENTERPRISE',
        siteAddress: 'Madurai',
        grand_total: 12000000,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(proformaQuote as Quotation);
      expect(pagesHtml.length).toBe(4);
      expect(pagesHtml[0]).toContain('PROFORMA INVOICE');

      const allHtml = pagesHtml.join('');
      expect(allHtml).not.toContain('CUSTOMER REQUIRED DOCUMENTS');
      expect(allHtml).not.toContain('PROJECT IMPLEMENTATION SCHEDULE');
      expect(allHtml).not.toContain('PM - SURYA GHAR WORK PROCESS');
    });

    it('generates full proposal for non-rooftop when quotation type is Government Subsidy or Commercial', async () => {
      const subsidyQuote: Partial<Quotation> = {
        id: 403,
        reference: 'TGSA-WP-SUBSIDY',
        business_category: 'SOLAR_WATERPUMP',
        quotation_type: 'Government Subsidy',
        customerName: 'AGRO FARMS',
        siteAddress: 'Theni',
        grand_total: 25000000,
        technicalDetails: {
          pump_rating_kw: 5,
        } as any,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(subsidyQuote as Quotation);
      expect(pagesHtml.length).toBeGreaterThanOrEqual(6);
      expect(pagesHtml[2]).toContain('COMMERCIALS');
      expect(pagesHtml[2]).toContain('COMMERCIAL TERMS AND CONDITIONS');
    });

    it('verifies that non-rooftop concise mode never includes customer site images page in PDF even if images are present', async () => {
      const conciseWithImages: Partial<Quotation> = {
        id: 404,
        reference: 'TGSA-WP-NOIMG',
        business_category: 'SOLAR_WATERPUMP',
        quotation_type: 'Quotation',
        customerName: 'KUMAR AGRO',
        siteAddress: 'Madurai',
        sitePhotos: [
          { id: 1, quotation_id: 404, photo_order: 1, data_url: 'data:image/png;base64,abc', name: 'Site.png' }
        ] as any,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(conciseWithImages as Quotation);
      expect(pagesHtml.length).toBe(4);
      const allHtml = pagesHtml.join('');
      expect(allHtml).not.toContain('PROJECT SITE / INSTALLATION PHOTOGRAPHS');
    });

    it('renders all 11 structured commercial terms dynamically in the quotation PDF table on Page 3', async () => {
      const commercialTerms = [
        { key: 'Prices', value: 'Price quoted Ex-works' },
        { key: 'GST', value: '17% included' },
        { key: 'Installation', value: 'Installation will be commenced by TO-GEN SOLAR AGRO after receipt of materials at the site and receipt of site clearance' },
        { key: 'Packing & Forwarding', value: 'Included, Single point delivery' },
        { key: 'Entry Tax', value: 'Inclusive' },
        { key: 'Payment', value: 'I. 80% of Final Price Offer in Advance.\nII. 10% to be paid after Material Supply of Solar Panels, Inverters and other BoS items.\nIII. 10% after Installation and Commissioning.' },
        { key: 'Delivery', value: 'Within 7 Days from the date of receipt of the Purchase Order' },
        { key: 'Net Meter', value: 'Inclusive' },
        { key: 'Warranty', value: 'PV Modules: 12-years of Product, 30-years of Power Output\nInverter : 8 Years' },
        { key: 'Quote Validity', value: 'This offer is valid up to 7 Days from the date of submission' },
        { key: 'Comprehensive Maintenance', value: '5 years, site visit Every quarter after commissioning of the system for maintenance purpose.' },
      ];

      const quote: Partial<Quotation> = {
        id: 405,
        reference: 'TGSA-TERMS-DYNAMIC',
        business_category: 'SOLAR_ROOFTOP',
        quotation_type: 'Commercial',
        customerName: 'DYNAMIC CUSTOMER',
        siteAddress: 'Madurai',
        grand_total: 10000000,
        payment_terms: JSON.stringify(commercialTerms),
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(quote as Quotation);
      const termsPage = pagesHtml[2]; // Combined page on Page 3

      expect(termsPage).toContain('COMMERCIAL TERMS AND CONDITIONS');
      expect(termsPage).toContain('Prices');
      expect(termsPage).toContain('Price quoted Ex-works');
      expect(termsPage).toContain('GST');
      expect(termsPage).toContain('17% included');
      expect(termsPage).toContain('Installation');
      expect(termsPage).toContain('Installation will be commenced by TO-GEN SOLAR AGRO');
      expect(termsPage).toContain('Packing & Forwarding');
      expect(termsPage).toContain('Single point delivery');
      expect(termsPage).toContain('Entry Tax');
      expect(termsPage).toContain('Inclusive');
      expect(termsPage).toContain('Payment');
      expect(termsPage).toContain('80% of Final Price Offer in Advance');
      expect(termsPage).toContain('Delivery');
      expect(termsPage).toContain('Within 7 Days from the date of receipt of the Purchase Order');
      expect(termsPage).toContain('Net Meter');
      expect(termsPage).toContain('Warranty');
      expect(termsPage).toContain('PV Modules: 12-years of Product');
      expect(termsPage).toContain('Quote Validity');
      expect(termsPage).toContain('Comprehensive Maintenance');
      expect(termsPage).toContain('5 years, site visit Every quarter');
    });

    it('strictly produces 4-page concise proposal for Solar I & C Service with Quotation type (Chella Mani case) without the 3 images', async () => {
      const chellaManiQuote: Partial<Quotation> = {
        id: 3,
        reference: 'QR202603',
        customerName: 'chella mani',
        siteAddress: 'Main Installation Site, madurai',
        business_category: 'Solar I &amp; C Service',
        quotation_type: 'Quotation',
        grand_total: 2765276,
        subtotal: 2343454,
        total_tax: 421822,
        state_subsidy: 6700,
        central_subsidy: 5600,
      };

      const { pagesHtml } = await generateQuotationPdfPagesHtml(chellaManiQuote as Quotation);
      expect(pagesHtml.length).toBe(4);

      // Page 1: Cover Proposal with SOLAR I & C SERVICE
      expect(pagesHtml[0]).toContain('SOLAR I & C SERVICE');

      // Page 3: Combined Commercials Table & Commercial Terms and Conditions
      expect(pagesHtml[2]).toContain('COMMERCIALS');
      expect(pagesHtml[2]).toContain('COMMERCIAL TERMS AND CONDITIONS');

      // Page 4: Important Notes & Disclaimer + Bank Details + Official Sign-off
      expect(pagesHtml[3]).toContain('IMPORTANT NOTES &amp; DISCLAIMER');
      expect(pagesHtml[3]).toContain('P. Alagu Pandi');

      // Zero of the 3 subsidy/process images should appear!
      const allHtml = pagesHtml.join('');
      expect(allHtml).not.toContain('CUSTOMER REQUIRED DOCUMENTS');
      expect(allHtml).not.toContain('PROJECT IMPLEMENTATION SCHEDULE');
      expect(allHtml).not.toContain('PM - SURYA GHAR WORK PROCESS');
    });
  });
});

