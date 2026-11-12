import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { CategoryBadge, getCategoryBadgeInfo } from '../../components/ui/CategoryBadge';
import { formatCurrency } from '../../utils/formatters';
import { getBankAccounts, BankAccount } from '../../utils/bankAccountStorage';
import { useAlert } from '../../context/AlertContext';
import { generateQuotationPDF } from '../../utils/quotationPdfGenerator';
import { validateName, validatePhone, validateEmail, validatePincode, sanitizeNameInput, sanitizePhoneInput } from '../../utils/validation';
import type { Quotation, CreateQuotationDto, QuotationItem, QuotationMilestone, QuotationTechnicalDetails } from '@shared/types/quotation.types';
import { 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Eye, 
  Camera, 
  X
} from 'lucide-react';

interface SitePhotoItem {
  id: string;
  name: string;
  size: string;
  dataUrl: string;
  caption?: string;
  uploadedAt: string;
}

export default function QuotationEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isOtherCategory, setIsOtherCategory] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);

  const [isManualCustomer, setIsManualCustomer] = useState<boolean>(false);
  const [manualCustomer, setManualCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    customer_type: 'Individual',
    company_name: '',
    alternate_phone: '',
  });
  const [manualCustomerErrors, setManualCustomerErrors] = useState<{
    name?: string;
    company_name?: string;
    phone?: string;
    alternate_phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }>({});
  const [technicalErrors, setTechnicalErrors] = useState<{
    system_capacity_kw?: string;
    panel_specs?: string;
    inverter_specs?: string;
    structure_type?: string;
    area_required_sqft?: string;
    battery_type?: string;
    battery_capacity?: string;
    battery_quantity?: string;
    luminaire_wattage_w?: string;
    light_type?: string;
    sl_panel_type?: string;
    pole_material?: string;
    pole_height_ft?: string;
    pump_rating_kw?: string;
    pump_hp?: string;
    vfd_model?: string;
    camera_model?: string;
    connectivity?: string;
    camera_mp?: string;
    memory_card_capacity?: string;
    structure_material?: string;
    structure_height?: string;
  }>({});

  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerComboboxRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Quotation>>({
    customer_id: 0,
    site_id: 0,
    status: 'Draft',
    subtotal: 0,
    total_discount: 0,
    total_tax: 0,
    grand_total: 0,
    tax_inclusive: false,
    items: [],
    payment_terms: JSON.stringify([
      { key: "Prices", value: "Price quoted Ex-works" },
      { key: "GST", value: "5% included" },
      { key: "Installation", value: "Installation will be commenced by TO-GEN SOLAR AGRO after receipt of materials at the site and receipt of site clearance" },
      { key: "Packing & Forwarding", value: "Included, Single point delivery" },
      { key: "Entry Tax", value: "Inclusive" },
      { key: "Payment", value: "I. 80% of Final Price Offer in Advance.\nII. 10% to be paid after Material Supply of Solar Panels, Inverters and other BoS items.\nIII. 10% after Installation and Commissioning." },
      { key: "Delivery", value: "Within 7 Days from the date of receipt of the Purchase Order" },
      { key: "Net Meter", value: "Inclusive" },
      { key: "Warranty", value: "PV Modules: 12-years of Product, 30-years of Power Output\nInverter : 8 Years" },
      { key: "Quote Validity", value: "This offer is valid up to 7 Days from the date of submission" },
      { key: "Comprehensive Maintenance", value: "5 years, site visit Every quarter after commissioning of the system for maintenance purpose." }
    ]),
    business_category: undefined,
    system_type: 'On-Grid',
    project_type: 'Capex',
    quotation_type: 'Quotation',
    validity_days: 7,
    technicalDetails: { structure_type: 'Normal Height', structure_material: 'GI' },
    milestones: []
  });
  const [originalFormData, setOriginalFormData] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('customer');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [taxInput, setTaxInput] = useState<string>('');
  const [isTaxManuallySet, setIsTaxManuallySet] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [itemDiscountInputs, setItemDiscountInputs] = useState<Record<number, string>>({});
  const [itemDiscountErrors, setItemDiscountErrors] = useState<Record<number, string | null>>({});

  const hasItemDiscountError = Object.values(itemDiscountErrors).some(err => !!err);
  const hasAnyDiscountError = !!discountError || hasItemDiscountError;

  const [selectedItemType, setSelectedItemType] = useState<'product' | 'package'>('product');
  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [selectedItemPrice, setSelectedItemPrice] = useState<string>('');
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);



  // Tab 7: Customer Scope & Site Photos (Max 3, customer choice)
  const [sitePhotos, setSitePhotos] = useState<SitePhotoItem[]>([]);
  const [originalSitePhotos, setOriginalSitePhotos] = useState<string>('[]');

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    setBankAccounts(getBankAccounts());
  }, []);
  const [customerScopeNotes, setCustomerScopeNotes] = useState<string>('');
  const [originalScopeNotes, setOriginalScopeNotes] = useState<string>('');
  const [scopeChecklist, setScopeChecklist] = useState<Record<string, boolean>>({
    roofAccess: true,
    waterSupply: true,
    powerPoint: true,
    shadowFree: true,
    internetAvailable: false
  });
  const [originalScopeChecklist, setOriginalScopeChecklist] = useState<string>('{}');
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; title: string } | null>(null);

  const isReadOnly = false;

  const handleNonNegativeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = true) => {
    if (
      e.key === '-' ||
      e.key === '+' ||
      e.key === 'e' ||
      e.key === 'E' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      (!allowDecimal && e.key === '.')
    ) {
      e.preventDefault();
    }
  };

  const handleNonNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>, allowDecimal = true) => {
    const paste = e.clipboardData.getData('text');
    if (paste.includes('-') || paste.includes('+')) {
      e.preventDefault();
      return;
    }
    const num = allowDecimal ? parseFloat(paste) : parseInt(paste, 10);
    if (isNaN(num) || num < 0) {
      e.preventDefault();
    }
  };

  const handleNumericOnlyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, allowDecimal = true) => {
    // Allow navigation, editing keys, and Ctrl/Cmd shortcuts
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    // Allow decimal point only once
    if (allowDecimal && e.key === '.') {
      const currentVal = (e.target as HTMLInputElement).value || '';
      const selectionStart = (e.target as HTMLInputElement).selectionStart ?? 0;
      const selectionEnd = (e.target as HTMLInputElement).selectionEnd ?? 0;
      const selectedText = currentVal.substring(selectionStart, selectionEnd);
      if (currentVal.includes('.') && !selectedText.includes('.')) {
        e.preventDefault();
      }
      return;
    }

    // Allow digits 0-9 only
    if (/^[0-9]$/.test(e.key)) {
      return;
    }

    // Block all other characters (letters a-z, symbols, space)
    e.preventDefault();
  };

  const handleNumericOnlyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text');
    if (/[^0-9.]/.test(paste)) {
      e.preventDefault();
      const sanitized = sanitizeNumericInput(paste);
      if (sanitized) {
        document.execCommand('insertText', false, sanitized);
      }
    }
  };

  const handleWheelPrevent = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLElement).blur();
  };

  useEffect(() => {
    loadDependencies();
    if (!isNew && id) {
      loadQuotation(Number(id));
    } else {
      const qCustId = searchParams.get('customerId');
      if (qCustId) {
        const cId = Number(qCustId);
        if (!isNaN(cId) && cId > 0) {
          setFormData(prev => ({ ...prev, customer_id: cId }));
          fetchSites(cId).then(sitesList => {
            if (sitesList && sitesList.length > 0) {
              const qSiteId = searchParams.get('siteId');
              const matchSite = qSiteId ? sitesList.find((s: any) => s.id === Number(qSiteId)) : null;
              const selectedSiteId = matchSite ? matchSite.id : sitesList[0].id;
              setFormData(prev => ({ ...prev, site_id: selectedSiteId }));
            }
          });
        }
      }
    }
  }, [id, isNew, searchParams]);

  const loadDependencies = async () => {
    try {
      const [custRes, prodRes, pkgRes, catRes] = await Promise.all([
        window.desktop.customers.list(),
        window.desktop.products.list(),
        window.desktop.packages.list(),
        window.desktop.categories.listActive()
      ]);

      if (custRes.success) setCustomers(custRes.data);
      if (prodRes.success) setProducts(prodRes.data);
      if (pkgRes.success) setPackages(pkgRes.data);
      if (catRes.success) setCategories(catRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (categories.length > 0 && formData.business_category) {
      const isStandard = categories.some((c: any) => c.code === formData.business_category);
      if (!isStandard) {
        setIsOtherCategory(true);
        setCustomCategory(formData.business_category);
      } else {
        setIsOtherCategory(false);
        setCustomCategory('');
      }
    }
  }, [categories, formData.business_category]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === formData.customer_id);
  }, [customers, formData.customer_id]);

  // When a customer is loaded or selected (e.g. from URL or customer list),
  // auto-select their business category if not already explicitly selected
  useEffect(() => {
    if (selectedCustomer?.business_category && !formData.business_category) {
      const cat = selectedCustomer.business_category;
      const isStandard = categories.some((c: any) => c.code === cat);
      if (!isStandard) {
        setIsOtherCategory(true);
        setCustomCategory(cat);
        setCustomCategoryError(null);
      } else {
        setIsOtherCategory(false);
        setCustomCategory('');
        setCustomCategoryError(null);
      }
      setFormData(prev => ({ ...prev, business_category: cat }));
    }
  }, [selectedCustomer, categories, formData.business_category]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.trim().toLowerCase();
    if (!query || (selectedCustomer && query === selectedCustomer.name.toLowerCase())) {
      return customers;
    }
    return customers.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(query);
      const phoneMatch = c.phone?.toLowerCase().includes(query);
      const companyMatch = c.company_name?.toLowerCase().includes(query);
      const cityMatch = c.city?.toLowerCase().includes(query);
      return Boolean(nameMatch || phoneMatch || companyMatch || cityMatch);
    });
  }, [customers, customerSearchQuery, selectedCustomer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        customerComboboxRef.current &&
        !customerComboboxRef.current.contains(target) &&
        (!customerDropdownRef.current || !customerDropdownRef.current.contains(target))
      ) {
        setIsCustomerDropdownOpen(false);
        if (selectedCustomer) {
          setCustomerSearchQuery(selectedCustomer.name);
        } else {
          setCustomerSearchQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearchQuery(selectedCustomer.name);
    }
  }, [selectedCustomer]);

  const fetchSites = async (customerId: number): Promise<any[]> => {
    try {
      const sitesRes = await window.desktop.installationSites.listByCustomer(customerId);
      if (sitesRes.success) {
        setSites(sitesRes.data);
        if (sitesRes.data.length > 0) {
          setFormData(prev => ({ ...prev, site_id: prev.site_id || sitesRes.data[0].id }));
        }
        return sitesRes.data;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const validateManualCustomer = (data = manualCustomer) => {
    const errs: typeof manualCustomerErrors = {};
    const nameRes = validateName(data.name, 'Full Name', true);
    if (!nameRes.isValid) errs.name = nameRes.error!;

    if (data.customer_type === 'Business') {
      const compNoSpace = (data.company_name || '').replace(/\s+/g, '');
      if (!data.company_name?.trim()) {
        errs.company_name = 'Company Name is required for business customers.';
      } else if (compNoSpace.length < 3) {
        errs.company_name = 'Company Name must contain at least 3 characters.';
      }
    }

    const phoneRes = validatePhone(data.phone, true, 'Phone number');
    if (!phoneRes.isValid) errs.phone = phoneRes.error!;

    if (data.alternate_phone) {
      const altRes = validatePhone(data.alternate_phone, false, 'Alternate phone');
      if (!altRes.isValid) errs.alternate_phone = altRes.error!;
    }

    if (data.email) {
      const emailRes = validateEmail(data.email, false);
      if (!emailRes.isValid) errs.email = emailRes.error!;
    }

    if (!data.address?.trim()) {
      errs.address = 'Billing Address is required.';
    } else if (data.address.trim().length < 3) {
      errs.address = 'Billing Address must be at least 3 characters.';
    }

    if (!data.city?.trim()) {
      errs.city = 'City is required.';
    } else if (data.city.trim().length < 2) {
      errs.city = 'City must be at least 2 characters.';
    }

    if (!data.state?.trim()) {
      errs.state = 'State is required.';
    } else if (data.state.trim().length < 2) {
      errs.state = 'State must be at least 2 characters.';
    }

    const pinRes = validatePincode(data.pincode, true);
    if (!pinRes.isValid) errs.pincode = pinRes.error!;

    return errs;
  };

  const handleSelectCustomer = async (customer: any) => {
    setIsManualCustomer(false);
    setManualCustomerErrors({});
    setCustomerSearchQuery(customer.name);
    setIsCustomerDropdownOpen(false);
    const loadedSites = await fetchSites(customer.id);
    const autoSiteId = (loadedSites && loadedSites.length > 0) ? loadedSites[0].id : 0;

    const custCat = customer.business_category;
    if (custCat) {
      const isStandard = categories.some((c: any) => c.code === custCat);
      if (!isStandard) {
        setIsOtherCategory(true);
        setCustomCategory(custCat);
        setCustomCategoryError(null);
      } else {
        setIsOtherCategory(false);
        setCustomCategory('');
        setCustomCategoryError(null);
      }
      setFormData(prev => ({
        ...prev,
        customer_id: customer.id,
        site_id: autoSiteId,
        is_manual_customer: false,
        business_category: custCat,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customer_id: customer.id,
        site_id: autoSiteId,
        is_manual_customer: false,
      }));
    }
  };

  const handleClearCustomer = () => {
    setIsManualCustomer(false);
    setManualCustomerErrors({});
    setFormData(prev => ({ ...prev, customer_id: 0, site_id: 0, is_manual_customer: false }));
    setCustomerSearchQuery('');
    setSites([]);
    setIsCustomerDropdownOpen(true);
  };

  const handleSelectOthersCustomer = () => {
    setIsManualCustomer(true);
    setIsCustomerDropdownOpen(false);
    setFormData(prev => ({
      ...prev,
      customer_id: 0,
      site_id: 0,
      is_manual_customer: true,
    }));
    setCustomerSearchQuery('');
    setSites([]);
  };


  const validateLineItemDiscount = (
    rawVal: string | number,
    unitPricePaise: number,
    quantity: number
  ) => {
    const grossPaise = Math.max(0, Math.round((unitPricePaise || 0) * (quantity || 0)));
    const maxDiscountPaise = grossPaise > 0 ? Math.floor(grossPaise * 0.20) : 0;
    const maxDiscountAmount = maxDiscountPaise / 100;

    const rawStr = String(rawVal ?? '').trim().replace('%', '');

    if (rawStr === '-' || rawStr.startsWith('-') || Number(rawStr) < 0) {
      return {
        isValid: false,
        error: 'Negative amount is not allowed.',
        discountPaise: 0,
        maxDiscountAmount,
      };
    }

    if (rawStr === '') {
      return {
        isValid: true,
        error: null,
        discountPaise: 0,
        maxDiscountAmount,
      };
    }

    if (isNaN(Number(rawStr)) || !isFinite(Number(rawStr))) {
      return {
        isValid: false,
        error: 'Please enter a valid discount value.',
        discountPaise: 0,
        maxDiscountAmount,
      };
    }

    const percentage = Number(rawStr);

    if (percentage > 20 || (grossPaise <= 0 && percentage > 0)) {
      return {
        isValid: false,
        error: `Discount cannot exceed 20% of the actual price. Maximum allowed: ${formatCurrency(maxDiscountAmount)}.`,
        discountPaise: 0,
        maxDiscountAmount,
      };
    }

    const discountPaise = Math.floor(grossPaise * (percentage / 100));

    return {
      isValid: true,
      error: null,
      discountPaise,
      maxDiscountAmount,
    };
  };

  const validateDiscountInput = (
    rawInput: string | number,
    subtotalPaise: number,
    totalTaxPaise: number
  ) => {
    const actualPricePaise = Math.max(0, Math.round(subtotalPaise || 0));
    const maxDiscountPaise = actualPricePaise > 0 ? Math.floor(actualPricePaise * 0.20) : 0;
    const maxDiscountAmount = maxDiscountPaise / 100;

    const rawStr = String(rawInput ?? '').trim().replace('%', '');

    // 1. Negative check FIRST (including typing a minus sign '-')
    if (rawStr === '-' || rawStr.startsWith('-') || Number(rawStr) < 0) {
      return {
        isValid: false,
        error: 'Negative amount is not allowed.',
        discountPaise: 0,
        maxDiscountPaise,
        maxDiscountAmount,
        priceAfterDiscountPaise: actualPricePaise,
        grandTotalPaise: actualPricePaise + totalTaxPaise,
      };
    }

    // 2. Empty check (valid 0% discount)
    if (rawStr === '') {
      return {
        isValid: true,
        error: null,
        discountPaise: 0,
        maxDiscountPaise,
        maxDiscountAmount,
        priceAfterDiscountPaise: actualPricePaise,
        grandTotalPaise: actualPricePaise + totalTaxPaise,
      };
    }

    // 3. Invalid number check
    if (isNaN(Number(rawStr)) || !isFinite(Number(rawStr))) {
      return {
        isValid: false,
        error: 'Please enter a valid discount value.',
        discountPaise: 0,
        maxDiscountPaise,
        maxDiscountAmount,
        priceAfterDiscountPaise: actualPricePaise,
        grandTotalPaise: actualPricePaise + totalTaxPaise,
      };
    }

    const percentage = Number(rawStr);

    // 3. Discount cannot exceed 20%
    if (percentage > 20 || (actualPricePaise <= 0 && percentage > 0)) {
      return {
        isValid: false,
        error: `Discount cannot exceed 20% of the actual price. Maximum allowed: ${formatCurrency(maxDiscountAmount)}.`,
        discountPaise: 0,
        maxDiscountPaise,
        maxDiscountAmount,
        priceAfterDiscountPaise: actualPricePaise,
        grandTotalPaise: actualPricePaise + totalTaxPaise,
      };
    }

    // 4. Valid percentage (0 to 20%): Calculate reliable currency arithmetic
    const discountPaise = Math.floor(actualPricePaise * (percentage / 100));
    const priceAfterDiscountPaise = actualPricePaise - discountPaise;
    const grandTotalPaise = priceAfterDiscountPaise + totalTaxPaise;

    if (priceAfterDiscountPaise < 0 || grandTotalPaise < 0) {
      return {
        isValid: false,
        error: 'Please ensure the grand total is not negative.',
        discountPaise: 0,
        maxDiscountPaise,
        maxDiscountAmount,
        priceAfterDiscountPaise: actualPricePaise,
        grandTotalPaise: actualPricePaise + totalTaxPaise,
      };
    }

    return {
      isValid: true,
      error: null,
      discountPaise,
      maxDiscountPaise,
      maxDiscountAmount,
      priceAfterDiscountPaise,
      grandTotalPaise,
    };
  };

  const loadQuotation = async (qId: number) => {
    try {
      const res = await window.desktop.quotations.get(qId);
      if (res.success) {
        const loadedData = res.data;
        const subtotal = loadedData.subtotal || 0;
        const discountPaise = loadedData.total_discount || 0;
        let pct = '';
        if (subtotal > 0 && discountPaise > 0) {
          pct = Number(((discountPaise / subtotal) * 100).toFixed(2)).toString();
        }
        setDiscountInput(pct);

        const isLoadedTaxInclusive = !!loadedData.tax_inclusive;
        let loadedTax = '';
        if (subtotal > 0 && loadedData.total_tax > 0) {
          if (isLoadedTaxInclusive) {
            const basePaise = subtotal - loadedData.total_tax;
            loadedTax = basePaise > 0 ? Number(((loadedData.total_tax / basePaise) * 100).toFixed(2)).toString() : '18';
          } else {
            loadedTax = Number(((loadedData.total_tax / subtotal) * 100).toFixed(2)).toString();
          }
          setIsTaxManuallySet(true);
        }
        setTaxInput(loadedTax);

        if (loadedData.is_manual_customer) {
          setIsManualCustomer(true);
          setManualCustomer({
            name: loadedData.manual_customer_name || '',
            phone: loadedData.manual_customer_phone || '',
            email: loadedData.manual_customer_email || '',
            address: loadedData.manual_customer_address || '',
            city: loadedData.manual_customer_city || '',
            state: '',
            pincode: '',
            gstin: '',
            pan: '',
            customer_type: 'Individual',
            company_name: '',
            alternate_phone: '',
          });
          setCustomerSearchQuery(loadedData.manual_customer_name || 'Others (Manual Entry)');
        } else {
          setIsManualCustomer(false);
          if (loadedData.customer_id) fetchSites(loadedData.customer_id);
        }

        let finalData = { ...loadedData };
        if (loadedData.items && loadedData.items.length > 0) {
          const itemsCopy = loadedData.items.map((it: any) => ({ ...it }));
          let calcSubtotal = 0;
          let calcTax = 0;
          const customTaxRate = loadedTax !== '' ? parseFloat(loadedTax) : null;
          itemsCopy.forEach((item: any) => {
            const itemLineTotal = (item.unit_price * item.quantity) - (item.discount || 0);
            if (customTaxRate !== null && !isNaN(customTaxRate)) {
              item.tax_rate = customTaxRate;
            }
            const itemTax = Math.round(itemLineTotal * (item.tax_rate || 0) / 100);
            item.total = itemLineTotal + itemTax;
            calcSubtotal += itemLineTotal;
            calcTax += itemTax;
          });
          const validation = validateDiscountInput(pct, calcSubtotal, calcTax);
          setDiscountError(validation.error);
          const effectiveDiscount = validation.isValid ? validation.discountPaise : 0;
          const grand_total = calcSubtotal + calcTax - effectiveDiscount;
          finalData = {
            ...finalData,
            items: itemsCopy,
            subtotal: calcSubtotal,
            total_tax: calcTax,
            total_discount: effectiveDiscount,
            grand_total
          };
        }
        if (loadedData.business_category) {
          const isStandard = categories.some((c: any) => c.code === loadedData.business_category);
          if (categories.length > 0 && !isStandard) {
            setIsOtherCategory(true);
            setCustomCategory(loadedData.business_category);
          } else if (categories.length > 0 && isStandard) {
            setIsOtherCategory(false);
            setCustomCategory('');
          }
        } else {
          setIsOtherCategory(false);
          setCustomCategory('');
        }
        if (finalData.technicalDetails) {
          finalData.technicalDetails = {
            ...finalData.technicalDetails,
            system_capacity_kw: finalData.technicalDetails.system_capacity_kw !== undefined && finalData.technicalDetails.system_capacity_kw !== null
              ? Math.max(0, Number(finalData.technicalDetails.system_capacity_kw))
              : undefined,
            inverter_capacity_kw: finalData.technicalDetails.inverter_capacity_kw !== undefined && finalData.technicalDetails.inverter_capacity_kw !== null
              ? Math.max(0, Number(finalData.technicalDetails.inverter_capacity_kw))
              : undefined,
            daily_generation_est: finalData.technicalDetails.daily_generation_est !== undefined && finalData.technicalDetails.daily_generation_est !== null
              ? Math.max(0, Number(finalData.technicalDetails.daily_generation_est))
              : undefined,
            area_required_sqft: finalData.technicalDetails.area_required_sqft !== undefined && finalData.technicalDetails.area_required_sqft !== null
              ? Math.max(0, Number(finalData.technicalDetails.area_required_sqft))
              : undefined,
            battery_capacity: finalData.technicalDetails.battery_capacity !== undefined && finalData.technicalDetails.battery_capacity !== null
              ? Math.max(0, Number(finalData.technicalDetails.battery_capacity))
              : (finalData.technicalDetails.battery_ah !== undefined && finalData.technicalDetails.battery_ah !== null
                ? Math.max(0, Number(finalData.technicalDetails.battery_ah))
                : undefined),
            battery_quantity: finalData.technicalDetails.battery_quantity !== undefined && finalData.technicalDetails.battery_quantity !== null
              ? Math.max(0, Number(finalData.technicalDetails.battery_quantity))
              : (finalData.technicalDetails.battery_count !== undefined && finalData.technicalDetails.battery_count !== null
                ? Math.max(0, Number(finalData.technicalDetails.battery_count))
                : undefined),
          };
        }
        finalData.validity_days = finalData.validity_days || 7;
        if (finalData.payment_terms && typeof finalData.payment_terms === 'string') {
          finalData.payment_terms = finalData.payment_terms
            .replace(/10 Days from the date of submission/g, `${finalData.validity_days} Days from the date of submission`)
            .replace(/Within 10 Days from the date of receipt of the Purchase Order/g, 'Within 7 Days from the date of receipt of the Purchase Order');
        }
        setFormData(finalData);
        setOriginalFormData(JSON.stringify(finalData));

        // Load customer scope and site photos
        try {
          if (finalData.scope) {
            const scNotes = finalData.scope.notes || '';
            const scCheck = {
              roofAccess: Boolean(finalData.scope.roof_access),
              waterSupply: Boolean(finalData.scope.water_supply),
              powerPoint: Boolean(finalData.scope.power_point),
              shadowFree: Boolean(finalData.scope.shadow_free),
              internetAvailable: Boolean(finalData.scope.internet_available),
            };
            setCustomerScopeNotes(scNotes);
            setScopeChecklist(scCheck);
            setOriginalScopeNotes(scNotes);
            setOriginalScopeChecklist(JSON.stringify(scCheck));
          } else {
            const cachedScope = localStorage.getItem(`togen_quotation_scope_${qId}`);
            if (cachedScope) {
              const parsed = JSON.parse(cachedScope);
              if (parsed.notes) setCustomerScopeNotes(parsed.notes);
              if (parsed.checklist) setScopeChecklist(parsed.checklist);
              setOriginalScopeNotes(parsed.notes || '');
              setOriginalScopeChecklist(JSON.stringify(parsed.checklist || {}));
            }
          }

          if (finalData.sitePhotos && finalData.sitePhotos.length > 0) {
            const loadedPhotos: SitePhotoItem[] = finalData.sitePhotos.slice(0, 3).map((p: any) => ({
              id: String(p.id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
              name: p.name || 'Photo',
              size: typeof p.size === 'number' ? `${Math.round(p.size / 1024)} KB` : (p.size || ''),
              dataUrl: p.data_url || p.url || '',
              caption: p.caption || '',
              uploadedAt: p.uploaded_at || ''
            }));
            setSitePhotos(loadedPhotos);
            setOriginalSitePhotos(JSON.stringify(loadedPhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '', name: p.name }))));
          } else {
            const cachedPhotos = localStorage.getItem(`togen_quotation_site_photos_${qId}`);
            if (cachedPhotos) {
              try {
                const parsed = JSON.parse(cachedPhotos);
                setSitePhotos(parsed);
                setOriginalSitePhotos(JSON.stringify(parsed.map((p: any) => ({ dataUrl: p.dataUrl, caption: p.caption || '', name: p.name }))));
              } catch {
                setSitePhotos([]);
                setOriginalSitePhotos('[]');
              }
            } else {
              setSitePhotos([]);
              setOriginalSitePhotos('[]');
            }
          }
        } catch (e) {
          console.error('Failed to load docs/photos/scope', e);
        }
      } else {
        setError(res.error?.message || 'Failed to load quotation');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isNew) {
      try {
        const draftPhotos = localStorage.getItem('togen_quotation_site_photos_draft');
        if (draftPhotos) setSitePhotos(JSON.parse(draftPhotos));
        const draftScope = localStorage.getItem('togen_quotation_scope_draft');
        if (draftScope) {
          const parsed = JSON.parse(draftScope);
          if (parsed.notes) setCustomerScopeNotes(parsed.notes);
          if (parsed.checklist) setScopeChecklist(parsed.checklist);
        }
      } catch (e) {}
    }
  }, [isNew]);


  useEffect(() => {
    if (isNew) {
      try {
        localStorage.setItem('togen_quotation_site_photos_draft', JSON.stringify(sitePhotos));
      } catch (e) {}
    }
  }, [isNew, sitePhotos]);

  useEffect(() => {
    if (isNew) {
      try {
        localStorage.setItem('togen_quotation_scope_draft', JSON.stringify({
          notes: customerScopeNotes,
          checklist: scopeChecklist
        }));
      } catch (e) {}
    }
  }, [isNew, customerScopeNotes, scopeChecklist]);



  const handleSitePhotosUpload = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const availableSlots = 3 - sitePhotos.length;

    if (availableSlots <= 0) {
      showAlert({
        type: 'warning',
        title: 'Maximum Limit Reached',
        description: 'You can upload a maximum of 3 site inspection photos. Please remove an existing photo if you want to upload a different one.',
      });
      return;
    }

    if (incoming.length > availableSlots) {
      showAlert({
        type: 'info',
        title: 'Upload Limit (Max 3)',
        description: `Maximum 3 site photos allowed. Only ${availableSlots} of ${incoming.length} selected photo(s) will be added.`,
      });
    }

    const filesToProcess = incoming.slice(0, availableSlots);
    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const sizeFormatted = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`;
        const photoItem: SitePhotoItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: sizeFormatted,
          dataUrl,
          caption: '',
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSitePhotos(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, photoItem];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveSitePhoto = async (id: string) => {
    const photo = sitePhotos.find(p => p.id === id);
    const photoTitle = photo?.caption ? `"${photo.caption}"` : (photo?.name ? `"${photo.name}"` : 'this photo');
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Remove Photo',
      description: `Are you sure you want to remove ${photoTitle}? This image will be deleted from the quotation.`,
      confirmLabel: 'Remove Photo',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    setSitePhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleClearAllPhotos = async () => {
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Clear All Photos',
      description: 'Are you sure you want to remove all uploaded site photos from this quotation?',
      confirmLabel: 'Clear All',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    setSitePhotos([]);
  };


  const getCategoryType = (cat?: string | null): 'STREETLIGHT' | 'WATERPUMP' | 'CCTV' | 'IC' | 'ROOFTOP' => {
    if (!cat) return 'ROOFTOP';
    const upper = cat.trim().toUpperCase();
    if (upper === 'SOLAR_STREETLIGHT' || upper.includes('STREET LIGHT') || upper.includes('STREETLIGHT')) return 'STREETLIGHT';
    if (upper === 'SOLAR_WATERPUMP' || upper.includes('WATER PUMP') || upper.includes('WATERPUMP')) return 'WATERPUMP';
    if (upper === 'SOLAR_CCTV' || upper.includes('CCTV')) return 'CCTV';
    if (upper === 'SOLAR_IC' || upper.includes('I & C') || upper.includes('I&C') || upper.includes('INSTALLATION') || upper.includes('COMMISSIONING')) return 'IC';
    return 'ROOFTOP';
  };

  const sanitizeNumericInput = (val: string): string => {
    if (!val) return '';
    // Strip all characters except digits and decimal point
    let s = val.replace(/[^0-9.]/g, '');
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts[0] + '.' + parts.slice(1).join('');
    }
    if (/^0[0-9]/.test(s)) {
      s = s.replace(/^0+/, '');
      if (s === '') s = '0';
    }
    return s;
  };

  const calculateTotals = (
    items: QuotationItem[],
    rawDiscount: string | number = discountInput,
    updateState: boolean = true,
    overrideTaxInput?: string
  ) => {
    let subtotal = 0;
    let total_tax = 0;

    const currentTaxStr = overrideTaxInput !== undefined ? overrideTaxInput : taxInput;
    const hasManualTax = isTaxManuallySet || overrideTaxInput !== undefined || (currentTaxStr !== '' && !isNaN(Number(currentTaxStr)));
    const isInclusive = !!formData.tax_inclusive;

    if (hasManualTax && currentTaxStr !== '') {
      const taxRateNum = parseFloat(currentTaxStr);
      const safeTaxRate = isNaN(taxRateNum) || taxRateNum < 0 ? 0 : taxRateNum;
      items.forEach(item => {
        const itemLineTotal = (item.unit_price * item.quantity) - (item.discount || 0);
        item.tax_rate = safeTaxRate;
        if (isInclusive) {
          const itemTax = safeTaxRate > 0 ? Math.round(itemLineTotal - itemLineTotal / (1 + safeTaxRate / 100)) : 0;
          item.total = itemLineTotal;
          subtotal += itemLineTotal;
          total_tax += itemTax;
        } else {
          const itemTax = Math.round(itemLineTotal * (safeTaxRate / 100));
          item.total = itemLineTotal + itemTax;
          subtotal += itemLineTotal;
          total_tax += itemTax;
        }
      });
      if (items.length === 0 && (formData.subtotal || 0) > 0) {
        subtotal = formData.subtotal || 0;
        if (isInclusive) {
          total_tax = safeTaxRate > 0 ? Math.round(subtotal - subtotal / (1 + safeTaxRate / 100)) : 0;
        } else {
          total_tax = Math.round(subtotal * (safeTaxRate / 100));
        }
      }
    } else {
      items.forEach(item => {
        const itemLineTotal = (item.unit_price * item.quantity) - (item.discount || 0);
        const rate = item.tax_rate || 0;
        if (isInclusive) {
          const itemTax = rate > 0 ? Math.round(itemLineTotal - itemLineTotal / (1 + rate / 100)) : 0;
          item.total = itemLineTotal;
          subtotal += itemLineTotal;
          total_tax += itemTax;
        } else {
          const itemTax = Math.round(itemLineTotal * (rate / 100));
          item.total = itemLineTotal + itemTax;
          subtotal += itemLineTotal;
          total_tax += itemTax;
        }
      });

      if (items.length === 0 && (formData.subtotal || 0) > 0) {
        subtotal = formData.subtotal || 0;
        total_tax = formData.total_tax || 0;
      }
    }

    const validation = validateDiscountInput(rawDiscount, subtotal, total_tax);
    setDiscountError(validation.error);

    // Only apply discount if valid! When invalid (negative or >20%), do not accept/apply it!
    const effectiveDiscount = validation.isValid ? validation.discountPaise : 0;
    const grand_total = isInclusive
      ? subtotal - effectiveDiscount
      : subtotal + total_tax - effectiveDiscount;

    if (updateState) {
      setFormData(prev => ({
        ...prev,
        items: items as any,
        subtotal,
        total_tax,
        total_discount: effectiveDiscount,
        grand_total
      }));
    }

    return validation;
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const val = sanitizeNumericInput(raw);
    setDiscountInput(val);
    const catType = getCategoryType(formData.business_category);
    if (catType === 'IC' || (!formData.items || formData.items.length === 0)) {
      const subtotal = formData.subtotal || 0;
      const total_tax = formData.total_tax || 0;
      const validation = validateDiscountInput(val, subtotal, total_tax);
      setDiscountError(validation.error);
      const effectiveDiscount = validation.isValid ? validation.discountPaise : 0;
      const grand_total = formData.tax_inclusive
        ? subtotal - effectiveDiscount
        : subtotal + total_tax - effectiveDiscount;
      setFormData(prev => ({ ...prev, total_discount: effectiveDiscount, grand_total }));
    } else {
      calculateTotals(formData.items as QuotationItem[], val);
    }
  };

  const handleTaxTypeChange = (newType: 'Exclusive' | 'Inclusive') => {
    const isInclusive = newType === 'Inclusive';
    const subtotal = formData.subtotal || 0;
    const taxRateNum = taxInput !== '' ? parseFloat(taxInput) : 18;
    const safeTax = isNaN(taxRateNum) || taxRateNum < 0 ? 0 : taxRateNum;

    let total_tax = 0;
    if (isInclusive) {
      total_tax = safeTax > 0 ? Math.round(subtotal - subtotal / (1 + safeTax / 100)) : 0;
    } else {
      total_tax = Math.round(subtotal * (safeTax / 100));
    }

    const validation = validateDiscountInput(discountInput, subtotal, total_tax);
    setDiscountError(validation.error);
    const effectiveDiscount = validation.isValid ? validation.discountPaise : 0;
    const grand_total = isInclusive
      ? subtotal - effectiveDiscount
      : subtotal + total_tax - effectiveDiscount;

    const updatedItems = (formData.items || []).map((it: QuotationItem) => {
      const itemLineTotal = (it.unit_price * it.quantity) - (it.discount || 0);
      let itemTax = 0;
      let itemTotal = 0;
      if (isInclusive) {
        itemTax = safeTax > 0 ? Math.round(itemLineTotal - itemLineTotal / (1 + safeTax / 100)) : 0;
        itemTotal = itemLineTotal;
      } else {
        itemTax = Math.round(itemLineTotal * (safeTax / 100));
        itemTotal = itemLineTotal + itemTax;
      }
      return {
        ...it,
        tax_rate: safeTax,
        total: itemTotal
      };
    });

    setFormData(prev => ({
      ...prev,
      tax_inclusive: isInclusive,
      items: updatedItems as any,
      total_tax,
      total_discount: effectiveDiscount,
      grand_total
    }));
  };

  const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const val = sanitizeNumericInput(raw);
    setTaxInput(val);
    setIsTaxManuallySet(true);

    const subtotal = formData.subtotal || 0;
    const tax_pct = val === '' ? 0 : parseFloat(val);
    const safeTax = isNaN(tax_pct) || tax_pct < 0 ? 0 : tax_pct;
    const isInclusive = !!formData.tax_inclusive;

    let total_tax = 0;
    if (isInclusive) {
      total_tax = safeTax > 0 ? Math.round(subtotal - subtotal / (1 + safeTax / 100)) : 0;
    } else {
      total_tax = Math.round(subtotal * (safeTax / 100));
    }

    const updatedItems = (formData.items || []).map((it: QuotationItem) => {
      const itemLineTotal = (it.unit_price * it.quantity) - (it.discount || 0);
      let itemTax = 0;
      let itemTotal = 0;
      if (isInclusive) {
        itemTax = safeTax > 0 ? Math.round(itemLineTotal - itemLineTotal / (1 + safeTax / 100)) : 0;
        itemTotal = itemLineTotal;
      } else {
        itemTax = Math.round(itemLineTotal * (safeTax / 100));
        itemTotal = itemLineTotal + itemTax;
      }
      return {
        ...it,
        tax_rate: safeTax,
        total: itemTotal
      };
    });

    const validation = validateDiscountInput(discountInput, subtotal, total_tax);
    setDiscountError(validation.error);
    const effectiveDiscount = validation.isValid ? validation.discountPaise : 0;
    const grand_total = isInclusive
      ? subtotal - effectiveDiscount
      : subtotal + total_tax - effectiveDiscount;

    setFormData(prev => ({
      ...prev,
      items: updatedItems as any,
      total_tax,
      total_discount: effectiveDiscount,
      grand_total
    }));
  };


  const handleUpdateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const rawVal = itemDiscountInputs[index] ?? '0';
      const validation = validateLineItemDiscount(rawVal, newItems[index].unit_price, newItems[index].quantity);
      setItemDiscountErrors(prev => ({ ...prev, [index]: validation.error }));
      newItems[index] = {
        ...newItems[index],
        discount: validation.isValid ? validation.discountPaise : 0
      };
    }

    calculateTotals(newItems as QuotationItem[]);
  };

  const handleAddItem = async () => {
    if (!selectedItemId) return;

    const currentItems = (formData.items as QuotationItem[]) || [];
    const manualPriceVal = selectedItemPrice.trim() !== '' ? parseFloat(selectedItemPrice) : null;
    if (manualPriceVal === null || isNaN(manualPriceVal) || manualPriceVal <= 0) {
      alert('Please enter a valid unit price.');
      return;
    }
    const manualPriceInPaise = Math.round(manualPriceVal * 100);
    const qty = Math.max(1, selectedItemQty || 1);

    const existingIndex = currentItems.findIndex(it =>
      selectedItemType === 'product'
        ? (it.item_type === 'Product' && it.item_id === selectedItemId)
        : (it.item_type === 'Package' && it.item_id === selectedItemId)
    );

    if (existingIndex >= 0) {
      const newItems = [...currentItems];
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + qty,
        unit_price: manualPriceInPaise
      };
      calculateTotals(newItems);
      setSelectedItemPrice('');
      setSelectedItemQty(1);
      return;
    }

    let newItem: QuotationItem;

    if (selectedItemType === 'product') {
      const p = products.find(x => x.id === selectedItemId);
      if (!p) return;
      newItem = {
        item_type: 'Product',
        item_id: p.id,
        name: `${p.brand} ${p.model}`.toUpperCase(),
        description: p.specs,
        quantity: qty,
        unit_price: manualPriceInPaise,
        discount: 0,
        tax_rate: p.tax_rate || 0,
        total: 0,
        brand: (p.brand || 'Reputed Quality').toUpperCase()
      };
    } else {
      const p = packages.find(x => x.id === selectedItemId);
      if (!p) return;

      let pkgBrand = (p as any).brand || (p as any).make;
      let fetchedPkg: any = null;

      try {
        const detailRes = await window.desktop.packages.get(p.id);
        if (detailRes && detailRes.success && detailRes.data) {
          fetchedPkg = detailRes.data;
          if (fetchedPkg.items && fetchedPkg.items.length > 0) {
            const brands = fetchedPkg.items
              .map((it: any) => it.product?.brand)
              .filter(Boolean);
            if (brands.length > 0) {
              pkgBrand = Array.from(new Set(brands)).join(' / ');
            }
          }
        }
      } catch (e) {
        console.error('Failed to get package details', e);
      }

      if (!pkgBrand) {
        pkgBrand = 'Reputed Quality';
      }

      newItem = {
        item_type: 'Package',
        item_id: p.id,
        name: (p.name || '').toUpperCase(),
        description: p.description,
        quantity: qty,
        unit_price: manualPriceInPaise,
        discount: 0,
        tax_rate: 18,
        total: 0,
        brand: (pkgBrand || 'Reputed Quality').toUpperCase()
      };
    }

    const newItems = [...currentItems, newItem];
    calculateTotals(newItems);
    setSelectedItemPrice('');
    setSelectedItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);

    const newInputs: Record<number, string> = {};
    const newErrors: Record<number, string | null> = {};
    newItems.forEach((_, i) => {
      const oldIdx = i >= index ? i + 1 : i;
      if (itemDiscountInputs[oldIdx] !== undefined) newInputs[i] = itemDiscountInputs[oldIdx];
      if (itemDiscountErrors[oldIdx] !== undefined) newErrors[i] = itemDiscountErrors[oldIdx];
    });
    setItemDiscountInputs(newInputs);
    setItemDiscountErrors(newErrors);

    calculateTotals(newItems as QuotationItem[]);
  };

  const isManualCustomerValid = useMemo(() => {
    if (!isManualCustomer) return true;
    const errs = validateManualCustomer(manualCustomer);
    return Object.keys(errs).length === 0;
  }, [isManualCustomer, manualCustomer]);

  const isCustomerTabValid = useMemo(() => {
    const categoryValid = !isOtherCategory || Boolean(customCategory.trim());
    if (isManualCustomer) {
      return isManualCustomerValid && categoryValid;
    }
    return Boolean(formData.customer_id && formData.site_id && categoryValid);
  }, [isManualCustomer, isManualCustomerValid, formData.customer_id, formData.site_id, isOtherCategory, customCategory]);

  const missingProposalRequirements = useMemo(() => {
    const missing: string[] = [];

    // 1. Customer Tab
    if (!isCustomerTabValid) {
      if (isManualCustomer) {
        missing.push('Customer Contact Details (Name, 10-digit Phone, Site Address)');
      } else if (!formData.customer_id || !formData.site_id) {
        missing.push('Customer & Installation Site selection');
      }
      if (isOtherCategory && !customCategory.trim()) {
        missing.push('Business Category specification');
      }
    }

    // 2. Technical Details Tab
    const catType = getCategoryType(formData.business_category);
    const tech = formData.technicalDetails;
    if (catType === 'IC') {
      const cap = tech?.system_capacity_kw ?? tech?.dc_capacity_kwp;
      if (!cap || Number(cap) <= 0) {
        missing.push('Capacity (kW) in Technical Details');
      }
    } else if (catType === 'ROOFTOP') {
      if (!tech?.system_capacity_kw || tech.system_capacity_kw <= 0) {
        missing.push('System Capacity (kW) in Technical Details');
      }
      if (!tech?.panel_specs?.trim()) {
        missing.push('Solar Module/Panel specifications in Technical Details');
      }
      if (!tech?.inverter_specs?.trim()) {
        missing.push('Solar Inverter specifications in Technical Details');
      }
      if (!tech?.structure_type?.trim()) {
        missing.push('Mounting Structure Type in Technical Details');
      }
      if (!tech?.area_required_sqft || tech.area_required_sqft <= 0) {
        missing.push('Area Required (sq ft) in Technical Details');
      }
    }

    // 3. Package & Components Tab
    if (catType !== 'IC' && (!formData.items || formData.items.length === 0)) {
      missing.push('At least 1 Package or Component item');
    }

    // 4. Pricing Tab
    if (hasAnyDiscountError || !formData.grand_total || formData.grand_total <= 0) {
      missing.push('Valid Pricing & Grand Total');
    }

    return missing;
  }, [
    isCustomerTabValid,
    isManualCustomer,
    formData.customer_id,
    formData.site_id,
    isOtherCategory,
    customCategory,
    formData.business_category,
    formData.technicalDetails,
    formData.items,
    hasAnyDiscountError,
    formData.grand_total,
  ]);

  const isProposalPdfReady = missingProposalRequirements.length === 0;

  const changeCount = useMemo(() => {
    if (isNew) {
      return Boolean(
        formData.customer_id ||
        (isManualCustomer && manualCustomer.name.trim()) ||
        (formData.items && formData.items.length > 0) ||
        formData.business_category ||
        customCategory.trim() ||
        formData.subtotal ||
        formData.grand_total ||
        sitePhotos.length > 0 ||
        customerScopeNotes.trim()
      ) ? 1 : 0;
    }
    if (!originalFormData) return 0;

    let count = 0;
    try {
      const orig = JSON.parse(originalFormData);
      Object.keys(formData).forEach(key => {
        const k = key as keyof typeof formData;
        if (JSON.stringify(formData[k]) !== JSON.stringify(orig[k])) {
          count++;
        }
      });
    } catch {
      if (JSON.stringify(formData) !== originalFormData) count++;
    }

    const isManualChanged = isManualCustomer && (
      manualCustomer.name !== (formData.manual_customer_name || '') ||
      manualCustomer.phone !== (formData.manual_customer_phone || '') ||
      manualCustomer.address !== (formData.manual_customer_address || '') ||
      manualCustomer.city !== (formData.manual_customer_city || '')
    );
    if (isManualChanged) count++;

    const currentPhotosBrief = sitePhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '', name: p.name }));
    let isPhotosChanged = false;
    try {
      const orig = JSON.parse(originalSitePhotos || '[]');
      const origBrief = orig.map((p: any) => ({ dataUrl: p.dataUrl, caption: p.caption || '', name: p.name }));
      isPhotosChanged = JSON.stringify(currentPhotosBrief) !== JSON.stringify(origBrief);
    } catch {
      isPhotosChanged = sitePhotos.length > 0;
    }
    if (isPhotosChanged) count++;

    const isScopeNotesChanged = (customerScopeNotes || '').trim() !== (originalScopeNotes || '').trim();
    if (isScopeNotesChanged) count++;

    const isScopeChecklistChanged = JSON.stringify(scopeChecklist) !== (originalScopeChecklist || '{}');
    if (isScopeChecklistChanged) count++;

    return count;
  }, [
    isNew,
    originalFormData,
    formData,
    customCategory,
    isManualCustomer,
    manualCustomer,
    sitePhotos,
    originalSitePhotos,
    customerScopeNotes,
    originalScopeNotes,
    scopeChecklist,
    originalScopeChecklist
  ]);

  const isChanged = changeCount > 0;

  // Step 1: Customer & Category validation
  const validateCustomerStep = (): { isValid: boolean; message: string } => {
    if (isManualCustomer) {
      const custErrs = validateManualCustomer();
      if (Object.keys(custErrs).length > 0) {
        setManualCustomerErrors(custErrs);
        return {
          isValid: false,
          message: 'Please complete Customer Name, 10-digit Phone number, and Site address (*).'
        };
      }
    } else {
      if (!formData.customer_id) {
        return {
          isValid: false,
          message: 'Please select a Customer before proceeding.'
        };
      }
      if (!formData.site_id) {
        return {
          isValid: false,
          message: 'Please select an Installation Site for the customer.'
        };
      }
    }

    if (isOtherCategory && !customCategory.trim()) {
      setCustomCategoryError('Please specify the business category.');
      return {
        isValid: false,
        message: 'You selected "Others" for category. Please specify the business category name.'
      };
    }

    return { isValid: true, message: '' };
  };

  // Step 2: Technical Details validation

  const validateTechnicalStep = (): { isValid: boolean; message: string; missing: string[] } => {
    const tech = formData.technicalDetails;
    const missing: string[] = [];
    const newErrors: Record<string, string> = {};
    const catType = getCategoryType(formData.business_category);

    if (catType === 'STREETLIGHT') {
      const watt = tech?.luminaire_wattage_w ?? tech?.wattage;
      if (watt === undefined || watt === null || watt === ('' as any) || Number(watt) <= 0 || isNaN(Number(watt))) {
        missing.push('Wattage must be greater than 0');
        newErrors.luminaire_wattage_w = 'Wattage is required and must be > 0';
      }
      if (!tech?.light_type || !tech.light_type.trim()) {
        missing.push('Light Type');
        newErrors.light_type = 'Light Type is required';
      }
      if (!tech?.sl_panel_type || !tech.sl_panel_type.trim()) {
        missing.push('Solar Panel Type');
        newErrors.sl_panel_type = 'Solar Panel Type is required';
      }
      if (!tech?.pole_material || !tech.pole_material.trim()) {
        missing.push('Pole Material');
        newErrors.pole_material = 'Pole Material is required';
      }
      const poleHt = tech?.pole_height_ft;
      if (poleHt === undefined || poleHt === null || poleHt === ('' as any) || Number(poleHt) <= 0 || isNaN(Number(poleHt))) {
        missing.push('Pole Height (Feet) must be greater than 0');
        newErrors.pole_height_ft = 'Pole Height is required and must be > 0';
      }
    } else if (catType === 'WATERPUMP') {
      const pumpCap = tech?.pump_rating_kw ?? tech?.system_capacity_kw;
      if (pumpCap === undefined || pumpCap === null || pumpCap === ('' as any) || Number(pumpCap) <= 0 || isNaN(Number(pumpCap))) {
        missing.push('Solar Capacity (kW) must be greater than 0');
        newErrors.pump_rating_kw = 'Solar Capacity is required and must be > 0';
      }
      const pumpHp = tech?.pump_hp;
      if (pumpHp === undefined || pumpHp === null || pumpHp === ('' as any) || Number(pumpHp) <= 0 || isNaN(Number(pumpHp))) {
        missing.push('Solar Drive Capacity (HP) must be greater than 0');
        newErrors.pump_hp = 'Solar Drive Capacity is required and must be > 0';
      }
      if (!tech?.vfd_model || !tech.vfd_model.trim()) {
        missing.push('Solar Drive Make & Model');
        newErrors.vfd_model = 'Solar Drive Make & Model is required';
      }
      if (!tech?.connectivity || !tech.connectivity.trim()) {
        missing.push('Connectivity Type');
        newErrors.connectivity = 'Connectivity Type is required';
      }
      if (!tech?.structure_material || !tech.structure_material.trim()) {
        missing.push('Structure Type');
        newErrors.structure_material = 'Structure Type is required';
      }
      if (!tech?.structure_height || !String(tech.structure_height).trim()) {
        missing.push('Structure Height');
        newErrors.structure_height = 'Structure Height is required';
      }
    } else if (catType === 'CCTV') {
      if (!tech?.camera_model || !tech.camera_model.trim()) {
        missing.push('Model / Make');
        newErrors.camera_model = 'Model / Make is required';
      }
      if (!tech?.connectivity || !tech.connectivity.trim()) {
        missing.push('Connectivity Type');
        newErrors.connectivity = 'Connectivity Type is required';
      }
      if (!tech?.camera_mp || !tech.camera_mp.trim()) {
        missing.push('MP Capacity');
        newErrors.camera_mp = 'MP Capacity is required';
      }
      if (!tech?.memory_card_capacity || !tech.memory_card_capacity.trim()) {
        missing.push('Memory Card Capacity');
        newErrors.memory_card_capacity = 'Memory Card Capacity is required';
      }
    } else if (catType === 'IC') {
      const cap = tech?.system_capacity_kw ?? tech?.dc_capacity_kwp;
      if (cap === undefined || cap === null || cap === ('' as any) || Number(cap) <= 0 || isNaN(Number(cap))) {
        missing.push('Capacity (kW) must be greater than 0');
        newErrors.system_capacity_kw = 'Capacity is required and must be > 0';
      }
    } else {
      // Solar Rooftop (Standard)
      if (!tech?.system_capacity_kw || Number(tech.system_capacity_kw) <= 0) {
        missing.push('System Capacity (kW) must be greater than 0');
        newErrors.system_capacity_kw = 'System Capacity (kW) is required and must be > 0';
      }
      if (!tech?.panel_specs || !tech.panel_specs.trim()) {
        missing.push('Solar Module/Brand/Specifications');
        newErrors.panel_specs = 'Solar Module specifications are required';
      }
      if (!tech?.inverter_specs || !tech.inverter_specs.trim()) {
        missing.push('Solar Inverter/Specifications');
        newErrors.inverter_specs = 'Solar Inverter specifications are required';
      }
      if (!tech?.structure_type || !tech.structure_type.trim()) {
        missing.push('Mounting Structure Type');
        newErrors.structure_type = 'Structure Type is required';
      }
      if (!tech?.area_required_sqft || Number(tech.area_required_sqft) <= 0) {
        missing.push('Area Required (sq ft) must be greater than 0');
        newErrors.area_required_sqft = 'Area Required (sq ft) is required and must be > 0';
      }

      if (formData.system_type === 'Off-Grid' || formData.system_type === 'Hybrid') {
        if (!tech?.battery_type || !tech.battery_type.trim()) {
          missing.push('Battery Type');
          newErrors.battery_type = `Battery Type is required for ${formData.system_type}`;
        }
        const bCap = tech?.battery_capacity ?? tech?.battery_ah;
        if (bCap === undefined || bCap === null || bCap === ('' as any) || Number(bCap) <= 0 || isNaN(Number(bCap))) {
          missing.push('Battery Capacity must be greater than 0');
          newErrors.battery_capacity = 'Battery Capacity is required and must be > 0';
        }
        const bQty = tech?.battery_quantity ?? tech?.battery_count;
        if (bQty === undefined || bQty === null || bQty === ('' as any) || Number(bQty) <= 0 || isNaN(Number(bQty))) {
          missing.push('Quantity must be greater than 0');
          newErrors.battery_quantity = 'Quantity is required and must be > 0';
        }
      }
    }

    setTechnicalErrors(newErrors);

    if (missing.length > 0) {
      return {
        isValid: false,
        missing,
        message: `Please complete the following required technical details:\n• ${missing.join('\n• ')}`
      };
    }

    return { isValid: true, message: '', missing: [] };
  };

  // Step 3: Package & Components validation
  const validatePackageStep = (): { isValid: boolean; message: string } => {
    if (getCategoryType(formData.business_category) === 'IC') {
      return { isValid: true, message: '' };
    }
    if (!formData.items || formData.items.length === 0) {
      return {
        isValid: false,
        message: 'Please add at least one Package or Component item to the quotation before proceeding.'
      };
    }
    const zeroPriceItem = formData.items.find(it => !it.unit_price || Number(it.unit_price) <= 0);
    if (zeroPriceItem) {
      return {
        isValid: false,
        message: `Product "${zeroPriceItem.name || 'Component'}" price cannot be ₹0. Please enter a valid price before proceeding to Pricing & Tax.`
      };
    }
    if (hasItemDiscountError) {
      return {
        isValid: false,
        message: 'Please correct invalid discount values on quotation items before proceeding.'
      };
    }
    return { isValid: true, message: '' };
  };

  // Step 4: Pricing & Tax validation
  const validatePricingStep = (): { isValid: boolean; message: string } => {
    if (hasAnyDiscountError) {
      return {
        isValid: false,
        message: discountError || 'Please provide a valid discount value before proceeding.'
      };
    }
    if (getCategoryType(formData.business_category) === 'IC') {
      if (!formData.subtotal || Number(formData.subtotal) <= 0) {
        return {
          isValid: false,
          message: 'Solar I&C subtotal (₹) is required and must be greater than ₹0.'
        };
      }
      if (!formData.grand_total || Number(formData.grand_total) <= 0) {
        return {
          isValid: false,
          message: 'Grand Total must be greater than ₹0 before proceeding to Terms & Conditions.'
        };
      }
      return { isValid: true, message: '' };
    }
    const validation = calculateTotals(formData.items as QuotationItem[], discountInput, false);
    if (!validation.isValid) {
      return {
        isValid: false,
        message: 'Pricing calculation is invalid. Please check line items and discount.'
      };
    }
    if (!formData.grand_total || formData.grand_total <= 0) {
      return {
        isValid: false,
        message: 'Grand Total must be greater than ₹0 before proceeding to Terms & Conditions.'
      };
    }
    return { isValid: true, message: '' };
  };

  // Step 5: Terms & Condition validation
  const validateTermsStep = (): { isValid: boolean; message: string } => {
    if (!formData.payment_terms || !formData.payment_terms.trim()) {
      return {
        isValid: false,
        message: 'Please enter Payment Terms & Conditions before proceeding.'
      };
    }
    return { isValid: true, message: '' };
  };

  const catType = getCategoryType(formData.business_category);
  const isICCategory = catType === 'IC';
  const isRooftopCategory = catType === 'ROOFTOP';
  const rawQuoteType = (formData.quotation_type || 'Quotation').toLowerCase();
  const isQuotationOrProforma = rawQuoteType === 'quotation' || rawQuoteType.includes('proforma') || rawQuoteType.includes('performa');
  const hideSitePhotosTab = !isRooftopCategory && isQuotationOrProforma;

  const currentStepIds = hideSitePhotosTab
    ? (isICCategory
        ? (['customer', 'technical', 'pricing', 'terms'] as const)
        : (['customer', 'technical', 'package', 'pricing', 'terms'] as const))
    : (isICCategory
        ? (['customer', 'technical', 'pricing', 'terms', 'scope'] as const)
        : (['customer', 'technical', 'package', 'pricing', 'terms', 'scope'] as const));

  useEffect(() => {
    if (hideSitePhotosTab && activeTab === 'scope') {
      setActiveTab('terms');
    }
  }, [hideSitePhotosTab, activeTab]);

  const validateStepById = (stepId: string): { isValid: boolean; message: string } => {
    switch (stepId) {
      case 'customer':
        return validateCustomerStep();
      case 'technical':
        return validateTechnicalStep();
      case 'package':
        return isICCategory ? { isValid: true, message: '' } : validatePackageStep();
      case 'pricing':
        return validatePricingStep();
      case 'terms':
        return validateTermsStep();
      default:
        return { isValid: true, message: '' };
    }
  };

  const handleGoToNextTab = (currentStepId: string, nextStepId: string) => {
    const val = validateStepById(currentStepId);
    if (!val.isValid) {
      const currentIdx = currentStepIds.indexOf(currentStepId as any);
      showAlert({
        type: 'warning',
        title: `Step ${currentIdx + 1} Required`,
        description: val.message,
      });
      return;
    }
    setActiveTab(nextStepId);
  };

  const handleTabChange = (targetTabId: string) => {
    const currentIdx = currentStepIds.indexOf(activeTab as any);
    const targetIdx = currentStepIds.indexOf(targetTabId as any);

    if (targetIdx <= currentIdx) {
      setActiveTab(targetTabId);
      return;
    }

    for (let i = 0; i < targetIdx; i++) {
      const stepVal = validateStepById(currentStepIds[i]);
      if (!stepVal.isValid) {
        showAlert({
          type: 'warning',
          title: `Step ${i + 1} Required`,
          description: stepVal.message,
        });
        setActiveTab(currentStepIds[i]);
        return;
      }
    }

    setActiveTab(targetTabId);
  };

  const handleSave = async (issue: boolean = false) => {
    // 1. Customer & Category validation
    const custVal = validateCustomerStep();
    if (!custVal.isValid) {
      await showAlert({
        type: 'warning',
        title: 'Customer & Category Required',
        description: custVal.message,
      });
      setActiveTab('customer');
      return;
    }

    // 2. Technical Details validation
    const techVal = validateTechnicalStep();
    if (!techVal.isValid) {
      await showAlert({
        type: 'warning',
        title: 'Technical Details Required',
        description: techVal.message,
      });
      setActiveTab('technical');
      return;
    }

    // 3. Package & Components validation (skip if I & C Service)
    if (!isICCategory) {
      const pkgVal = validatePackageStep();
      if (!pkgVal.isValid) {
        await showAlert({
          type: 'warning',
          title: 'Package & Components Required',
          description: pkgVal.message,
        });
        setActiveTab('package');
        return;
      }
    }

    // 4. Pricing & Tax validation
    const pricingVal = validatePricingStep();
    if (!pricingVal.isValid) {
      await showAlert({
        type: 'warning',
        title: 'Pricing & Tax Required',
        description: pricingVal.message,
      });
      setActiveTab('pricing');
      return;
    }

    // 5. Terms & Conditions validation
    const termsVal = validateTermsStep();
    if (!termsVal.isValid) {
      await showAlert({
        type: 'warning',
        title: 'Terms & Conditions Required',
        description: termsVal.message,
      });
      setActiveTab('terms');
      return;
    }

    const finalBusinessCategory = isOtherCategory
      ? (customCategory.trim() || undefined)
      : (formData.business_category || undefined);

    if (!isNew) {
      const confirmed = await showConfirm({
        type: 'save',
        title: issue ? 'Issue Quotation' : 'Save Quotation Changes',
        description: `Are you sure you want to ${issue ? 'issue' : 'save changes for'} quotation "${formData.reference || ''}"?`,
        confirmLabel: issue ? 'Issue' : 'Save Changes',
        cancelLabel: 'Cancel',
        isDestructive: false
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    try {
      let finalCustomerId = formData.customer_id;
      let finalSiteId = formData.site_id;
      let isManualCustomerFlag = isManualCustomer;

      if (isManualCustomer) {
        const customerRes = await window.desktop.customers.create({
          name: manualCustomer.name,
          phone: manualCustomer.phone,
          email: manualCustomer.email || undefined,
          address: manualCustomer.address,
          city: manualCustomer.city,
          state: manualCustomer.state,
          pincode: manualCustomer.pincode,
          gstin: manualCustomer.gstin || undefined,
          pan: manualCustomer.pan || undefined,
          customer_type: manualCustomer.customer_type as any,
          company_name: manualCustomer.company_name || undefined,
          alternate_phone: manualCustomer.alternate_phone || undefined,
          business_category: finalBusinessCategory || undefined,
        });

        if (!customerRes.success) {
          setError(customerRes.error?.message || 'Failed to create customer');
          setSaving(false);
          return;
        }

        finalCustomerId = customerRes.data.id;

        const siteRes = await window.desktop.installationSites.create({
          customerId: finalCustomerId,
          address: manualCustomer.address,
          city: manualCustomer.city,
          state: manualCustomer.state,
          postcode: manualCustomer.pincode,
        });

        if (!siteRes.success) {
           setError(siteRes.error?.message || 'Failed to create installation site');
           setSaving(false);
           return;
        }

        finalSiteId = siteRes.data.id;
        isManualCustomerFlag = false;
        
        // update local state
        setFormData(prev => ({
           ...prev,
           customer_id: finalCustomerId,
           site_id: finalSiteId,
           is_manual_customer: false
        }));
        setIsManualCustomer(false);
      }

      const fullAddress = isManualCustomerFlag
        ? [manualCustomer.address.trim(), manualCustomer.city.trim()].filter(Boolean).join(', ')
        : undefined;

      const payload: CreateQuotationDto = {
        customer_id: isManualCustomerFlag ? null : finalCustomerId,
        site_id: isManualCustomerFlag ? null : finalSiteId,
        is_manual_customer: isManualCustomerFlag,
        manual_customer_name: isManualCustomerFlag ? manualCustomer.name.trim() : undefined,
        manual_customer_phone: isManualCustomerFlag ? manualCustomer.phone.trim() : undefined,
        manual_customer_email: isManualCustomerFlag ? (manualCustomer.email.trim() || undefined) : undefined,
        manual_customer_address: isManualCustomerFlag ? fullAddress : undefined,
        manual_customer_city: isManualCustomerFlag ? (manualCustomer.city.trim() || undefined) : undefined,
        status: issue ? 'Issued' : (isNew ? 'Draft' : (formData.status === 'Expired' ? 'Draft' : (formData.status || 'Draft'))),
        issue_date: issue ? (formData.issue_date || new Date().toISOString()) : (formData.issue_date || undefined),
        subtotal: formData.subtotal || 0,
        total_discount: formData.total_discount || 0,
        total_tax: formData.total_tax || 0,
        grand_total: formData.grand_total || 0,
        tax_inclusive: !!formData.tax_inclusive,
        payment_terms: formData.payment_terms || '',
        items: formData.items as QuotationItem[] || [],
        business_category: finalBusinessCategory,
        system_type: formData.system_type || undefined,
        quotation_type: formData.quotation_type || 'Quotation',
        project_type: formData.project_type || undefined,
        validity_days: formData.validity_days || 7,
        bank_account_id: formData.bank_account_id || undefined,
        state_subsidy: formData.state_subsidy || 0,
        central_subsidy: formData.central_subsidy || 0,
        valid_until: (() => {
          const createDate = formData.created_at
            ? new Date(formData.created_at)
            : (formData.issue_date ? new Date(formData.issue_date) : new Date());
          return new Date(createDate.getTime() + (formData.validity_days || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        })(),
        notes_internal: formData.notes_internal || undefined,
        technicalDetails: formData.technicalDetails ? {
          ...formData.technicalDetails,
          system_capacity_kw: formData.technicalDetails.system_capacity_kw !== undefined && formData.technicalDetails.system_capacity_kw !== null && formData.technicalDetails.system_capacity_kw !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.system_capacity_kw))
            : undefined,
          inverter_capacity_kw: formData.technicalDetails.inverter_capacity_kw !== undefined && formData.technicalDetails.inverter_capacity_kw !== null && formData.technicalDetails.inverter_capacity_kw !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.inverter_capacity_kw))
            : undefined,
          daily_generation_est: formData.technicalDetails.daily_generation_est !== undefined && formData.technicalDetails.daily_generation_est !== null && formData.technicalDetails.daily_generation_est !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.daily_generation_est))
            : undefined,
          area_required_sqft: (getCategoryType(finalBusinessCategory) === 'ROOFTOP' && formData.technicalDetails.area_required_sqft !== undefined && formData.technicalDetails.area_required_sqft !== null && formData.technicalDetails.area_required_sqft !== ('' as any) && Number(formData.technicalDetails.area_required_sqft) > 0)
            ? Math.max(0, Number(formData.technicalDetails.area_required_sqft))
            : undefined,
          battery_type: formData.technicalDetails.battery_type?.trim() || undefined,
          battery_capacity: formData.technicalDetails.battery_capacity !== undefined && formData.technicalDetails.battery_capacity !== null && formData.technicalDetails.battery_capacity !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.battery_capacity))
            : (formData.technicalDetails.battery_ah !== undefined && formData.technicalDetails.battery_ah !== null && formData.technicalDetails.battery_ah !== ('' as any)
              ? Math.max(0, Number(formData.technicalDetails.battery_ah))
              : undefined),
          battery_quantity: formData.technicalDetails.battery_quantity !== undefined && formData.technicalDetails.battery_quantity !== null && formData.technicalDetails.battery_quantity !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.battery_quantity))
            : (formData.technicalDetails.battery_count !== undefined && formData.technicalDetails.battery_count !== null && formData.technicalDetails.battery_count !== ('' as any)
              ? Math.max(0, Number(formData.technicalDetails.battery_count))
              : undefined),
          battery_ah: formData.technicalDetails.battery_capacity !== undefined && formData.technicalDetails.battery_capacity !== null && formData.technicalDetails.battery_capacity !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.battery_capacity))
            : (formData.technicalDetails.battery_ah !== undefined && formData.technicalDetails.battery_ah !== null && formData.technicalDetails.battery_ah !== ('' as any)
              ? Math.max(0, Number(formData.technicalDetails.battery_ah))
              : undefined),
          battery_count: formData.technicalDetails.battery_quantity !== undefined && formData.technicalDetails.battery_quantity !== null && formData.technicalDetails.battery_quantity !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.battery_quantity))
            : (formData.technicalDetails.battery_count !== undefined && formData.technicalDetails.battery_count !== null && formData.technicalDetails.battery_count !== ('' as any)
              ? Math.max(0, Number(formData.technicalDetails.battery_count))
              : undefined),
          // Category-specific fields:
          luminaire_wattage_w: formData.technicalDetails.luminaire_wattage_w !== undefined && formData.technicalDetails.luminaire_wattage_w !== null && formData.technicalDetails.luminaire_wattage_w !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.luminaire_wattage_w))
            : (formData.technicalDetails.wattage !== undefined && formData.technicalDetails.wattage !== null && formData.technicalDetails.wattage !== ('' as any)
              ? Math.max(0, Number(formData.technicalDetails.wattage))
              : undefined),
          light_type: formData.technicalDetails.light_type?.trim() || undefined,
          sl_panel_type: formData.technicalDetails.sl_panel_type?.trim() || undefined,
          pole_material: formData.technicalDetails.pole_material?.trim() || undefined,
          pole_height_ft: formData.technicalDetails.pole_height_ft !== undefined && formData.technicalDetails.pole_height_ft !== null && formData.technicalDetails.pole_height_ft !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.pole_height_ft))
            : undefined,
          pump_system_type: formData.technicalDetails.pump_system_type?.trim() || 'Water Pump',
          pump_rating_kw: formData.technicalDetails.pump_rating_kw !== undefined && formData.technicalDetails.pump_rating_kw !== null && formData.technicalDetails.pump_rating_kw !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.pump_rating_kw))
            : undefined,
          pump_hp: formData.technicalDetails.pump_hp !== undefined && formData.technicalDetails.pump_hp !== null && formData.technicalDetails.pump_hp !== ('' as any)
            ? Math.max(0, Number(formData.technicalDetails.pump_hp))
            : undefined,
          vfd_model: formData.technicalDetails.vfd_model?.trim() || undefined,
          camera_model: formData.technicalDetails.camera_model?.trim() || undefined,
          camera_count: formData.technicalDetails.camera_count !== undefined && formData.technicalDetails.camera_count !== null && formData.technicalDetails.camera_count !== ('' as any)
            ? Math.max(1, Number(formData.technicalDetails.camera_count))
            : undefined,
          light_count: formData.technicalDetails.light_count !== undefined && formData.technicalDetails.light_count !== null && formData.technicalDetails.light_count !== ('' as any)
            ? Math.max(1, Number(formData.technicalDetails.light_count))
            : undefined,
          connectivity: formData.technicalDetails.connectivity?.trim() || undefined,
          camera_mp: formData.technicalDetails.camera_mp?.trim() || undefined,
          memory_card_capacity: formData.technicalDetails.memory_card_capacity?.trim() || undefined,
          structure_material: formData.technicalDetails.structure_material?.trim() || undefined,
          structure_type: formData.technicalDetails.structure_type?.trim() || formData.technicalDetails.structure_material?.trim() || undefined,
          mounting_structure: formData.technicalDetails.mounting_structure?.trim() || formData.technicalDetails.structure_material?.trim() || undefined,
          structure_height: formData.technicalDetails.structure_height !== undefined && formData.technicalDetails.structure_height !== null && formData.technicalDetails.structure_height !== ('' as any)
            ? String(formData.technicalDetails.structure_height).trim()
            : undefined,
        } as QuotationTechnicalDetails : undefined,
        milestones: formData.milestones as QuotationMilestone[] || [],

        scope: {
          notes: customerScopeNotes?.trim() || undefined,
          roof_access: scopeChecklist.roofAccess,
          water_supply: scopeChecklist.waterSupply,
          power_point: scopeChecklist.powerPoint,
          shadow_free: scopeChecklist.shadowFree,
          internet_available: scopeChecklist.internetAvailable,
        },
        sitePhotos: sitePhotos.slice(0, 3).map((p, idx) => ({
          photo_order: idx + 1,
          name: p.name,
          size: p.size,
          data_url: p.dataUrl,
          caption: p.caption,
          uploaded_at: p.uploadedAt,
        })),
      };

      let res;
      if (isNew) {
        res = await window.desktop.quotations.create(payload);
      } else {
        res = await window.desktop.quotations.update({ id: Number(id), ...payload });
      }

        if (res.success) {
        const savedId = res.data.id;
        try {
          localStorage.setItem(`togen_quotation_site_photos_${savedId}`, JSON.stringify(sitePhotos));
          localStorage.setItem(`togen_quotation_scope_${savedId}`, JSON.stringify({
            notes: customerScopeNotes,
            checklist: scopeChecklist
          }));
          if (isNew) {
            localStorage.removeItem('togen_quotation_site_photos_draft');
            localStorage.removeItem('togen_quotation_scope_draft');
          }
        } catch (e) {
          console.error(e);
        }
        setOriginalSitePhotos(JSON.stringify(sitePhotos.map(p => ({ dataUrl: p.dataUrl, caption: p.caption || '', name: p.name }))));
        setOriginalScopeNotes(customerScopeNotes || '');
        setOriginalScopeChecklist(JSON.stringify(scopeChecklist));
        showAlert({ type: 'success', description: isNew ? 'Quotation created successfully' : 'Quotation updated successfully' });
        
        setTimeout(() => {
          navigate('/quotations');
        }, 1500);
      } else {
        setError(res.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading quotation...</div>;

  const editorTabs = [
    {
      id: 'customer',
      label: '1. Customer & Category',
      content: (
        <Card className="mt-4 animate-fade-in" style={{ overflow: 'visible' }}>
          <h3 className="mb-4">Select Customer & Category</h3>
          <div className="grid grid-cols-2 gap-4 items-start">
            {isManualCustomer ? (
              <div className="col-span-2 flex flex-col gap-4 p-4 rounded-lg border border-border-color bg-surface animate-fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-border-color">
                  <div className="flex items-center gap-1 font-semibold text-sm">
                    <span>Manual Customer Details (Others)</span>
                    <span className="text-red-500">*</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualCustomer(false);
                      setManualCustomerErrors({});
                      setFormData(prev => ({
                        ...prev,
                        is_manual_customer: false
                      }));
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1.5px solid var(--primary-color)',
                      backgroundColor: '#eff6ff',
                      color: 'var(--primary-color)',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }}
                    title="Return to existing customer selection"
                  >
                    <span>← Back to Customer Search</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Customer Type */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Customer Type</label>
                    <select
                      className="input-field"
                      value={manualCustomer.customer_type}
                      onChange={e => setManualCustomer(p => ({ ...p, customer_type: e.target.value }))}
                      disabled={isReadOnly}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Business">Business</option>
                      <option value="Government">Government</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="hidden"></div> {/* Empty div to align grid */}

                  {/* Customer Full Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Full Name (Primary Contact) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualCustomer.name}
                      onChange={e => {
                        const val = sanitizeNameInput(e.target.value);
                        setManualCustomer(p => ({ ...p, name: val }));
                        if (manualCustomerErrors.name) {
                          const res = validateName(val, 'Full Name', true);
                          setManualCustomerErrors(p => ({ ...p, name: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      onBlur={() => {
                        const res = validateName(manualCustomer.name, 'Full Name', true);
                        setManualCustomerErrors(p => ({ ...p, name: res.isValid ? undefined : res.error! }));
                      }}
                      placeholder="e.g. Suresh Kumar"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      autoFocus
                    />
                    {manualCustomerErrors.name && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.name}</span>
                    )}
                  </div>

                  {/* Company Name */}
                  {manualCustomer.customer_type === 'Business' ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-semibold">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualCustomer.company_name}
                        onChange={e => {
                          setManualCustomer(p => ({ ...p, company_name: e.target.value }));
                          if (manualCustomerErrors.company_name && e.target.value.trim()) {
                            setManualCustomerErrors(p => ({ ...p, company_name: undefined }));
                          }
                        }}
                        placeholder="e.g. SunTech Enterprises"
                        disabled={isReadOnly}
                        className={`input-field ${manualCustomerErrors.company_name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {manualCustomerErrors.company_name && (
                        <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.company_name}</span>
                      )}
                    </div>
                  ) : <div className="hidden"></div>}

                  {/* Phone Number */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={manualCustomer.phone}
                      maxLength={10}
                      onChange={e => {
                        const val = sanitizePhoneInput(e.target.value);
                        setManualCustomer(p => ({ ...p, phone: val }));
                        if (manualCustomerErrors.phone) {
                          const res = validatePhone(val, true, 'Phone number');
                          setManualCustomerErrors(p => ({ ...p, phone: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      onBlur={() => {
                        const res = validatePhone(manualCustomer.phone, true, 'Phone number');
                        setManualCustomerErrors(p => ({ ...p, phone: res.isValid ? undefined : res.error! }));
                      }}
                      placeholder="10-digit mobile number"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.phone && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.phone}</span>
                    )}
                  </div>

                  {/* Alternate Phone Number */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      value={manualCustomer.alternate_phone}
                      maxLength={10}
                      onChange={e => {
                        const val = sanitizePhoneInput(e.target.value);
                        setManualCustomer(p => ({ ...p, alternate_phone: val }));
                        if (manualCustomerErrors.alternate_phone) {
                          const res = validatePhone(val, false, 'Alternate phone');
                          setManualCustomerErrors(p => ({ ...p, alternate_phone: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      onBlur={() => {
                        if (manualCustomer.alternate_phone) {
                          const res = validatePhone(manualCustomer.alternate_phone, false, 'Alternate phone');
                          setManualCustomerErrors(p => ({ ...p, alternate_phone: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      placeholder="Optional 10-digit number"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.alternate_phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.alternate_phone && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.alternate_phone}</span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-semibold">Email Address</label>
                    <input
                      type="email"
                      value={manualCustomer.email}
                      onChange={e => {
                        setManualCustomer(p => ({ ...p, email: e.target.value }));
                        if (manualCustomerErrors.email) {
                          const res = validateEmail(e.target.value, false);
                          setManualCustomerErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      onBlur={() => {
                        if (manualCustomer.email) {
                          const res = validateEmail(manualCustomer.email, false);
                          setManualCustomerErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      placeholder="name@example.com"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.email ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.email && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.email}</span>
                    )}
                  </div>

                  {/* Site Address */}
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-semibold">
                      Billing Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualCustomer.address}
                      onChange={e => {
                        const val = e.target.value;
                        setManualCustomer(p => ({ ...p, address: val }));
                        if (manualCustomerErrors.address && val.trim().length >= 3) {
                          setManualCustomerErrors(p => ({ ...p, address: undefined }));
                        }
                      }}
                      onBlur={() => {
                        if (!manualCustomer.address.trim()) {
                          setManualCustomerErrors(p => ({ ...p, address: 'Billing Address is required.' }));
                        } else if (manualCustomer.address.trim().length < 3) {
                          setManualCustomerErrors(p => ({ ...p, address: 'Billing Address must be at least 3 characters.' }));
                        }
                      }}
                      placeholder="e.g. 12/4, North Street, Anna Nagar"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.address ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.address && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.address}</span>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">City <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={manualCustomer.city}
                      onChange={e => {
                        setManualCustomer(p => ({ ...p, city: e.target.value }));
                        if (manualCustomerErrors.city && e.target.value.trim().length >= 2) {
                          setManualCustomerErrors(p => ({ ...p, city: undefined }));
                        }
                      }}
                      onBlur={() => {
                        if (!manualCustomer.city?.trim()) {
                          setManualCustomerErrors(p => ({ ...p, city: 'City is required.' }));
                        } else if (manualCustomer.city.trim().length < 2) {
                          setManualCustomerErrors(p => ({ ...p, city: 'City must be at least 2 characters.' }));
                        }
                      }}
                      placeholder="e.g. Madurai"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.city ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.city && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.city}</span>
                    )}
                  </div>
                  
                  {/* State */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">State <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={manualCustomer.state}
                      onChange={e => {
                        setManualCustomer(p => ({ ...p, state: e.target.value }));
                        if (manualCustomerErrors.state && e.target.value.trim().length >= 2) {
                          setManualCustomerErrors(p => ({ ...p, state: undefined }));
                        }
                      }}
                      onBlur={() => {
                        if (!manualCustomer.state?.trim()) {
                          setManualCustomerErrors(p => ({ ...p, state: 'State is required.' }));
                        } else if (manualCustomer.state.trim().length < 2) {
                          setManualCustomerErrors(p => ({ ...p, state: 'State must be at least 2 characters.' }));
                        }
                      }}
                      placeholder="e.g. Tamil Nadu"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.state ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.state && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.state}</span>
                    )}
                  </div>

                  {/* Pincode */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Pincode <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={manualCustomer.pincode}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setManualCustomer(p => ({ ...p, pincode: val }));
                        if (manualCustomerErrors.pincode) {
                          const res = validatePincode(val, true);
                          setManualCustomerErrors(p => ({ ...p, pincode: res.isValid ? undefined : res.error! }));
                        }
                      }}
                      onBlur={() => {
                        const res = validatePincode(manualCustomer.pincode, true);
                        setManualCustomerErrors(p => ({ ...p, pincode: res.isValid ? undefined : res.error! }));
                      }}
                      placeholder="6-digit pincode"
                      disabled={isReadOnly}
                      className={`input-field ${manualCustomerErrors.pincode ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {manualCustomerErrors.pincode && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {manualCustomerErrors.pincode}</span>
                    )}
                  </div>
                  
                  <div className="hidden"></div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">GSTIN</label>
                    <input
                      type="text"
                      value={manualCustomer.gstin}
                      onChange={e => setManualCustomer(p => ({ ...p, gstin: e.target.value }))}
                      disabled={isReadOnly}
                      className="input-field"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">PAN</label>
                    <input
                      type="text"
                      value={manualCustomer.pan}
                      onChange={e => setManualCustomer(p => ({ ...p, pan: e.target.value }))}
                      disabled={isReadOnly}
                      className="input-field"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end pt-2 border-t border-border-color">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualCustomer(false);
                        setManualCustomerErrors({});
                        setFormData(prev => ({
                          ...prev,
                          is_manual_customer: false
                        }));
                      }}
                      className="btn btn-secondary text-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Customer Search
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1" style={{ position: 'relative' }} ref={customerComboboxRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold">
                      Customer <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSelectOthersCustomer}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0 flex items-center gap-0.5"
                    >
                      <span>Others</span>
                      <span className="text-red-500">*</span>
                    </button>
                  </div>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      placeholder="Type to search customer (name, phone)..."
                      value={isCustomerDropdownOpen ? customerSearchQuery : (selectedCustomer ? selectedCustomer.name : '')}
                      onChange={e => {
                        setCustomerSearchQuery(e.target.value);
                        if (!isCustomerDropdownOpen) setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={e => {
                        setIsCustomerDropdownOpen(true);
                        e.target.select();
                      }}
                      disabled={isReadOnly}
                      className="input-field"
                      style={{ width: '100%', paddingRight: '56px' }}
                    />
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 3 }}>
                      {formData.customer_id ? (
                        <button
                          type="button"
                          onClick={handleClearCustomer}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#e2e8f0',
                            color: '#64748b',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Clear customer"
                        >
                          ✕
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                        style={{
                          width: '20px',
                          height: '20px',
                          color: '#64748b',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        tabIndex={-1}
                      >
                        ▾
                      </button>
                    </div>

                    {/* Dropdown list placed strictly below the input field */}
                    {isCustomerDropdownOpen && !isReadOnly && (
                      <div
                        ref={customerDropdownRef}
                        className="customer-dropdown-container"
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          width: '100%',
                          maxHeight: '340px',
                          display: 'flex',
                          flexDirection: 'column',
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '8px',
                          boxShadow: '0 12px 28px -4px rgba(15, 43, 72, 0.18), 0 6px 14px -2px rgba(0, 0, 0, 0.1)',
                          zIndex: 9999,
                          overflow: 'hidden'
                        }}
                      >
                        {/* Others option at the top of dropdown */}
                        <div
                          onClick={handleSelectOthersCustomer}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-surface-subtle)',
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--primary-color)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.875rem',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface-hover)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface-subtle)'; }}
                        >
                          <span>Others</span>
                          <span style={{ color: '#ef4444' }}>*</span>
                        </div>

                        <div style={{
                          padding: '8px 14px',
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          fontWeight: 700,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          flexShrink: 0
                        }}>
                          <span>Matching Existing Customers ({filteredCustomers.length})</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to select</span>
                        </div>

                        {filteredCustomers.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            No customers found matching &quot;{customerSearchQuery}&quot;
                          </div>
                        ) : (
                          <ul
                            className="customer-dropdown-list"
                            style={{
                              listStyle: 'none',
                              margin: 0,
                              padding: '4px 0',
                              overflowY: 'auto',
                              maxHeight: '220px',
                              flex: '1 1 auto',
                              minHeight: 0,
                              overscrollBehavior: 'contain'
                            }}
                          >
                            {filteredCustomers.map(c => {
                              const isSelected = c.id === formData.customer_id;
                              return (
                                <li
                                  key={c.id}
                                  onClick={() => handleSelectCustomer(c)}
                                  style={{
                                    padding: '10px 14px',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: isSelected ? 'var(--primary-light)' : undefined,
                                    color: isSelected ? 'var(--primary-light-text)' : undefined,
                                    borderBottom: '1px solid rgba(226, 232, 240, 0.7)',
                                    transition: 'background-color 0.15s ease'
                                  }}
                                  onMouseEnter={e => {
                                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface-hover)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary-light-text)' : 'var(--text-primary)' }}>
                                      {c.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                      {c.phone && <span>📞 {c.phone}</span>}
                                      {c.city && <span>• 📍 {c.city}</span>}
                                      {c.company_name && <span>• 🏢 {c.company_name}</span>}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 700 }}>
                                      ✓ Selected
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold">Installation Site</label>
                  <select
                    value={formData.site_id || 0}
                    onChange={e => setFormData(p => ({ ...p, site_id: Number(e.target.value) }))}
                    disabled={isReadOnly || !formData.customer_id}
                    className="input-field"
                  >
                    <option value={0} disabled>
                      {!formData.customer_id
                        ? 'Select customer first...'
                        : sites.length === 0
                        ? 'No address registered for customer'
                        : 'Select installation site...'}
                    </option>
                    {sites.map(s => {
                      const fullAddr = [s.address, s.city, s.state, s.postcode].filter(Boolean).join(', ');
                      return (
                        <option key={s.id} value={s.id}>
                          {fullAddr || s.address || `Site #${s.id}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Business Category {isOtherCategory && <span className="text-red-500">*</span>}
              </label>
              <select
                value={isOtherCategory ? 'OTHER' : (formData.business_category || '')}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'OTHER') {
                    setIsOtherCategory(true);
                    setCustomCategory('');
                    setCustomCategoryError('Please specify the business category.');
                    setFormData(p => ({ ...p, business_category: undefined }));
                    setTechnicalErrors({});
                  } else {
                    setIsOtherCategory(false);
                    setCustomCategory('');
                    setCustomCategoryError(null);
                    setFormData(p => ({ ...p, business_category: val || undefined }));
                    setTechnicalErrors({});
                    if (getCategoryType(val) === 'IC' && activeTab === 'package') {
                      setActiveTab('pricing');
                    }
                  }
                }}
                disabled={isReadOnly}
                className="input-field"
              >
                <option value="">None (Standard)</option>
                {categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                <option value="OTHER">Others (Specify)</option>
              </select>
              {isOtherCategory && (
                <div className="mt-1 flex flex-col gap-1 animate-fade-in">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomCategory(val);
                      if (val.trim()) {
                        setCustomCategoryError(null);
                      } else {
                        setCustomCategoryError('Please specify the business category.');
                      }
                      setFormData(p => ({ ...p, business_category: val.trim() ? val : undefined }));
                    }}
                    onBlur={() => {
                      if (!customCategory.trim()) {
                        setCustomCategoryError('Please specify the business category.');
                      }
                    }}
                    placeholder="Enter business category (required)..."
                    disabled={isReadOnly}
                    className={`input-field ${customCategoryError ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500' : ''}`}
                    autoFocus
                  />
                  {customCategoryError ? (
                    <span className="text-xs text-red-500 font-medium">⚠️ {customCategoryError}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Type your custom business category above <span className="text-red-500">*</span></span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">Quotation Type</label>
              <select value={formData.quotation_type || 'Quotation'} onChange={e => setFormData(p => ({ ...p, quotation_type: e.target.value as any }))} disabled={isReadOnly} className="input-field">
                <option value="Quotation">Quotation</option>
                <option value="Government Subsidy">Government Subsidy</option>
                <option value="Commercial">Commercial</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
                {formData.quotation_type &&
                  formData.quotation_type !== 'Quotation' &&
                  formData.quotation_type !== 'Government Subsidy' &&
                  formData.quotation_type !== 'Commercial' &&
                  formData.quotation_type !== 'Proforma Invoice' && (
                    <option value={formData.quotation_type}>{formData.quotation_type}</option>
                  )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">Status</label>
              <select value={formData.status || 'Draft'} onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))} disabled={isReadOnly} className="input-field">
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              variant="primary"
              onClick={() => handleGoToNextTab('customer', 'technical')}
              title="Next: Technical Details"
            >
              Next: Technical Details &gt;
            </Button>
          </div>
        </Card>
      )
    },
    {
      id: 'technical',
      label: '2. Technical Details',
      content: (() => {
        const catType = getCategoryType(formData.business_category);

        return (
          <Card className="mt-4 animate-fade-in">
            {catType === 'STREETLIGHT' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="m-0">Solar Street Light Specifications</h3>
                  <CategoryBadge category="SOLAR_STREETLIGHT" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Wattage (W) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.technicalDetails?.luminaire_wattage_w ?? formData.technicalDetails?.wattage ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.luminaire_wattage_w) {
                          setTechnicalErrors(p => ({ ...p, luminaire_wattage_w: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, luminaire_wattage_w: '' as any, wattage: '' as any }
                          }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, luminaire_wattage_w: num, wattage: num }
                          }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.luminaire_wattage_w ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 30"
                    />
                    {technicalErrors.luminaire_wattage_w && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.luminaire_wattage_w}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Light Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.light_type || ''}
                      onChange={e => {
                        if (technicalErrors.light_type) {
                          setTechnicalErrors(p => ({ ...p, light_type: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, light_type: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.light_type ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Light Type</option>
                      <option value="All-in-One">All-in-One</option>
                      <option value="Semi-Integrated">Semi-Integrated</option>
                    </select>
                    {technicalErrors.light_type && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.light_type}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Panel Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.sl_panel_type || ''}
                      onChange={e => {
                        if (technicalErrors.sl_panel_type) {
                          setTechnicalErrors(p => ({ ...p, sl_panel_type: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, sl_panel_type: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.sl_panel_type ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Panel Type</option>
                      <option value="Poly">Poly</option>
                      <option value="Mono">Mono</option>
                    </select>
                    {technicalErrors.sl_panel_type && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.sl_panel_type}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Pole Material <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.pole_material || ''}
                      onChange={e => {
                        if (technicalErrors.pole_material) {
                          setTechnicalErrors(p => ({ ...p, pole_material: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, pole_material: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.pole_material ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Pole Material</option>
                      <option value="GI">GI</option>
                      <option value="MS">MS</option>
                    </select>
                    {technicalErrors.pole_material && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.pole_material}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Pole Height (Feet) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.technicalDetails?.pole_height_ft ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.pole_height_ft) {
                          setTechnicalErrors(p => ({ ...p, pole_height_ft: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, pole_height_ft: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, pole_height_ft: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.pole_height_ft ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 15"
                    />
                    {technicalErrors.pole_height_ft && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.pole_height_ft}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Number of Lights (Qty)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.technicalDetails?.light_count ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, light_count: '' as any } }));
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 1) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, light_count: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                      onPaste={e => handleNonNegativePaste(e, false)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>
              </>
            )}

            {catType === 'WATERPUMP' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="m-0">Solar Water Pump Specifications</h3>
                  <CategoryBadge category="SOLAR_WATERPUMP" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">System Type</label>
                    <input
                      type="text"
                      value="Water Pump"
                      disabled
                      className="input-field bg-secondary-bg/60 cursor-not-allowed opacity-90 font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Capacity (kW) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.technicalDetails?.pump_rating_kw ?? formData.technicalDetails?.system_capacity_kw ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.pump_rating_kw) {
                          setTechnicalErrors(p => ({ ...p, pump_rating_kw: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, pump_rating_kw: '' as any, system_capacity_kw: '' as any }
                          }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, pump_rating_kw: num, system_capacity_kw: num }
                          }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.pump_rating_kw ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 5"
                    />
                    {technicalErrors.pump_rating_kw && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.pump_rating_kw}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Drive Capacity (HP) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.technicalDetails?.pump_hp ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.pump_hp) {
                          setTechnicalErrors(p => ({ ...p, pump_hp: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, pump_hp: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, pump_hp: num }
                          }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.pump_hp ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 3"
                    />
                    {technicalErrors.pump_hp && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.pump_hp}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Drive Make & Model <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.technicalDetails?.vfd_model || ''}
                      onChange={e => {
                        if (technicalErrors.vfd_model) {
                          setTechnicalErrors(p => ({ ...p, vfd_model: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, vfd_model: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.vfd_model ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. INVT / Vacon / Shakti"
                    />
                    {technicalErrors.vfd_model && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.vfd_model}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Connectivity Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.connectivity || ''}
                      onChange={e => {
                        if (technicalErrors.connectivity) {
                          setTechnicalErrors(p => ({ ...p, connectivity: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, connectivity: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.connectivity ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Connectivity Type</option>
                      <option value="SIM">SIM</option>
                      <option value="Wi-Fi">Wi-Fi</option>
                    </select>
                    {technicalErrors.connectivity && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.connectivity}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Structure Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.structure_material || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.structure_material) {
                          setTechnicalErrors(p => ({ ...p, structure_material: undefined }));
                        }
                        setFormData(p => ({
                          ...p,
                          technicalDetails: {
                            ...p.technicalDetails,
                            structure_material: val,
                            structure_type: val,
                            mounting_structure: val
                          }
                        }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.structure_material ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Structure Type</option>
                      <option value="MS">MS</option>
                      <option value="GI">GI</option>
                    </select>
                    {technicalErrors.structure_material && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.structure_material}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Structure Height <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.technicalDetails?.structure_height || ''}
                      onChange={e => {
                        if (technicalErrors.structure_height) {
                          setTechnicalErrors(p => ({ ...p, structure_height: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, structure_height: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.structure_height ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 10 Feet"
                    />
                    {technicalErrors.structure_height && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.structure_height}</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {catType === 'CCTV' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="m-0">Solar CCTV Camera Specifications</h3>
                  <CategoryBadge category="SOLAR_CCTV" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Model / Make <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.technicalDetails?.camera_model || ''}
                      onChange={e => {
                        if (technicalErrors.camera_model) {
                          setTechnicalErrors(p => ({ ...p, camera_model: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, camera_model: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.camera_model ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. CP Plus / Hikvision / Dahua"
                    />
                    {technicalErrors.camera_model && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.camera_model}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Connectivity Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.connectivity || ''}
                      onChange={e => {
                        if (technicalErrors.connectivity) {
                          setTechnicalErrors(p => ({ ...p, connectivity: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, connectivity: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.connectivity ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Select Connectivity</option>
                      <option value="SIM Type">SIM Type</option>
                      <option value="Wi-Fi">Wi-Fi</option>
                    </select>
                    {technicalErrors.connectivity && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.connectivity}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      MP Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.technicalDetails?.camera_mp || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (technicalErrors.camera_mp) {
                          setTechnicalErrors(p => ({ ...p, camera_mp: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, camera_mp: val } }));
                      }}
                      onKeyDown={e => {
                        if (
                          !/^\d$/.test(e.key) &&
                          !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) &&
                          !((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase()))
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        const paste = e.clipboardData.getData('text').replace(/\D/g, '');
                        if (technicalErrors.camera_mp) {
                          setTechnicalErrors(p => ({ ...p, camera_mp: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, camera_mp: paste } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.camera_mp ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 4"
                    />
                    {technicalErrors.camera_mp && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.camera_mp}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Memory Card Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.technicalDetails?.memory_card_capacity || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (technicalErrors.memory_card_capacity) {
                          setTechnicalErrors(p => ({ ...p, memory_card_capacity: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, memory_card_capacity: val } }));
                      }}
                      onKeyDown={e => {
                        if (
                          !/^\d$/.test(e.key) &&
                          !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) &&
                          !((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase()))
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        const paste = e.clipboardData.getData('text').replace(/\D/g, '');
                        if (technicalErrors.memory_card_capacity) {
                          setTechnicalErrors(p => ({ ...p, memory_card_capacity: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, memory_card_capacity: paste } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.memory_card_capacity ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 128"
                    />
                    {technicalErrors.memory_card_capacity && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.memory_card_capacity}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Camera Quantity (Qty)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.technicalDetails?.camera_count ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, camera_count: '' as any } }));
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 1) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, camera_count: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                      onPaste={e => handleNonNegativePaste(e, false)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>
              </>
            )}

            {catType === 'IC' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="m-0">Solar I & C Service Specifications</h3>
                  <CategoryBadge category="SOLAR_IC" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Capacity (kW) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.technicalDetails?.system_capacity_kw ?? formData.technicalDetails?.dc_capacity_kwp ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.system_capacity_kw) {
                          setTechnicalErrors(p => ({ ...p, system_capacity_kw: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, system_capacity_kw: '' as any, dc_capacity_kwp: '' as any },
                          }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({
                            ...p,
                            technicalDetails: { ...p.technicalDetails, system_capacity_kw: num, dc_capacity_kwp: num },
                          }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.system_capacity_kw ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 50"
                    />
                    {technicalErrors.system_capacity_kw && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.system_capacity_kw}</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {catType === 'ROOFTOP' && (() => {
              const activeCat = formData.business_category || 'SOLAR_ROOFTOP';
              const badgeInfo = getCategoryBadgeInfo(activeCat);
              const headerTitle = badgeInfo.label === 'Solar Rooftop'
                ? 'System Specifications'
                : `${badgeInfo.label} Specifications`;

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="m-0">{headerTitle}</h3>
                    <CategoryBadge category={activeCat} />
                  </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">System Type</label>
                    <select
                      value={formData.system_type || 'On-Grid'}
                      onChange={e => {
                        const val = e.target.value as any;
                        setFormData(p => ({ ...p, system_type: val }));
                        if (val !== 'Off-Grid' && val !== 'Hybrid') {
                          setTechnicalErrors(p => {
                            const copy = { ...p };
                            delete copy.battery_type;
                            delete copy.battery_capacity;
                            delete copy.battery_quantity;
                            return copy;
                          });
                        }
                      }}
                      disabled={isReadOnly}
                      className="input-field"
                    >
                      <option value="On-Grid">On-Grid</option>
                      <option value="Off-Grid">Off-Grid</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Project Type</label>
                    <select value={formData.project_type || 'Capex'} onChange={e => setFormData(p => ({ ...p, project_type: e.target.value as any }))} disabled={isReadOnly} className="input-field">
                      <option value="Capex">Capex</option>
                      <option value="Opex">Opex</option>
                      <option value="Lease">Lease</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      System Capacity (kW) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.technicalDetails?.system_capacity_kw ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.system_capacity_kw) {
                          setTechnicalErrors(p => ({ ...p, system_capacity_kw: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, system_capacity_kw: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, system_capacity_kw: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.system_capacity_kw ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {technicalErrors.system_capacity_kw && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.system_capacity_kw}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Daily Generation Est. (kWh)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.technicalDetails?.daily_generation_est ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, daily_generation_est: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, daily_generation_est: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Module/Brand/Specifications <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.technicalDetails?.panel_specs || ''}
                      onChange={e => {
                        if (technicalErrors.panel_specs) {
                          setTechnicalErrors(p => ({ ...p, panel_specs: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, panel_specs: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.panel_specs ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 540W Mono PERC"
                    />
                    {technicalErrors.panel_specs && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.panel_specs}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Solar Module Quantity (Nos)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.technicalDetails?.panel_count ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, panel_count: '' as any } }));
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, panel_count: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                      onPaste={e => handleNonNegativePaste(e, false)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Solar Inverter/Specifications <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.technicalDetails?.inverter_specs || ''}
                      onChange={e => {
                        if (technicalErrors.inverter_specs) {
                          setTechnicalErrors(p => ({ ...p, inverter_specs: undefined }));
                        }
                        setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, inverter_specs: e.target.value } }));
                      }}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.inverter_specs ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="e.g. 5kW String Inverter"
                    />
                    {technicalErrors.inverter_specs && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.inverter_specs}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Inverter Capacity (kW)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.technicalDetails?.inverter_capacity_kw ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, inverter_capacity_kw: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, inverter_capacity_kw: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Inverter Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.technicalDetails?.inverter_quantity ?? formData.technicalDetails?.inverter_count ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, inverter_quantity: '' as any, inverter_count: '' as any } }));
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, inverter_quantity: num, inverter_count: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                      onPaste={e => handleNonNegativePaste(e, false)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Structure Material</label>
                    <select
                      value={formData.technicalDetails?.structure_material || 'GI'}
                      onChange={e => setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, structure_material: e.target.value } }))}
                      disabled={isReadOnly}
                      className="input-field"
                    >
                      <option value="GI">GI</option>
                      <option value="MS">MS</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Area Required (sq ft) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.technicalDetails?.area_required_sqft ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (technicalErrors.area_required_sqft) {
                          setTechnicalErrors(p => ({ ...p, area_required_sqft: undefined }));
                        }
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, area_required_sqft: '' as any } }));
                          return;
                        }
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, area_required_sqft: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                      onPaste={e => handleNonNegativePaste(e, true)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className={`input-field ${technicalErrors.area_required_sqft ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {technicalErrors.area_required_sqft && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.area_required_sqft}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">
                      Structure Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.technicalDetails?.structure_type || 'Normal Height'}
                      onChange={e => setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, structure_type: e.target.value } }))}
                      disabled={isReadOnly}
                      className="input-field"
                    >
                      <option value="Normal Height">Normal Height</option>
                      <option value="Elevated Height">Elevated Height</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold">Structure Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.technicalDetails?.structure_quantity ?? formData.technicalDetails?.structure_count ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, structure_quantity: '' as any, structure_count: '' as any } }));
                          return;
                        }
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setFormData(p => ({ ...p, technicalDetails: { ...p.technicalDetails, structure_quantity: num, structure_count: num } }));
                        }
                      }}
                      onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                      onPaste={e => handleNonNegativePaste(e, false)}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                      className="input-field"
                      placeholder="e.g. 1"
                    />
                  </div>

                  {(formData.system_type === 'Off-Grid' || formData.system_type === 'Hybrid') && (
                    <div className="col-span-2 mt-2 pt-4 border-t border-border-color">
                      <div className="mb-3">
                        <h4 className="font-semibold text-base text-primary">Battery Specifications</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-secondary-bg/50 border border-border-color">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold">
                            Battery Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.technicalDetails?.battery_type || ''}
                            onChange={e => {
                              if (technicalErrors.battery_type) {
                                setTechnicalErrors(p => ({ ...p, battery_type: undefined }));
                              }
                              setFormData(p => ({
                                ...p,
                                technicalDetails: { ...p.technicalDetails, battery_type: e.target.value }
                              }));
                            }}
                            disabled={isReadOnly}
                            className={`input-field ${technicalErrors.battery_type ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          >
                            <option value="">Select Battery Type</option>
                            <option value="Lead acid">Lead acid</option>
                            <option value="Lithium Ion">Lithium Ion</option>
                          </select>
                          {technicalErrors.battery_type && (
                            <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.battery_type}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold">
                            Battery Capacity <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={formData.technicalDetails?.battery_capacity ?? formData.technicalDetails?.battery_ah ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (technicalErrors.battery_capacity) {
                                setTechnicalErrors(p => ({ ...p, battery_capacity: undefined }));
                              }
                              if (val === '') {
                                setFormData(p => ({
                                  ...p,
                                  technicalDetails: { ...p.technicalDetails, battery_capacity: '' as any, battery_ah: '' as any }
                                }));
                                return;
                              }
                              const num = parseFloat(val);
                              if (!isNaN(num) && num >= 0) {
                                setFormData(p => ({
                                  ...p,
                                  technicalDetails: { ...p.technicalDetails, battery_capacity: num, battery_ah: num }
                                }));
                              }
                            }}
                            onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                            onPaste={e => handleNonNegativePaste(e, true)}
                            onWheel={handleWheelPrevent}
                            disabled={isReadOnly}
                            className={`input-field ${technicalErrors.battery_capacity ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            placeholder="e.g. 150"
                          />
                          {technicalErrors.battery_capacity && (
                            <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.battery_capacity}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold">
                            Quantity <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={formData.technicalDetails?.battery_quantity ?? formData.technicalDetails?.battery_count ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (technicalErrors.battery_quantity) {
                                setTechnicalErrors(p => ({ ...p, battery_quantity: undefined }));
                              }
                              if (val === '') {
                                setFormData(p => ({
                                  ...p,
                                  technicalDetails: { ...p.technicalDetails, battery_quantity: '' as any, battery_count: '' as any }
                                }));
                                return;
                              }
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0) {
                                setFormData(p => ({
                                  ...p,
                                  technicalDetails: { ...p.technicalDetails, battery_quantity: num, battery_count: num }
                                }));
                              }
                            }}
                            onKeyDown={e => handleNonNegativeKeyDown(e, false)}
                            onPaste={e => handleNonNegativePaste(e, false)}
                            onWheel={handleWheelPrevent}
                            disabled={isReadOnly}
                            className={`input-field ${technicalErrors.battery_quantity ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            placeholder="e.g. 4"
                          />
                          {technicalErrors.battery_quantity && (
                            <span className="text-xs text-red-500 font-medium">⚠️ {technicalErrors.battery_quantity}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
            <div className="flex justify-between mt-6 pt-4 border-t border-border-color">
              <Button variant="secondary" onClick={() => setActiveTab('customer')}>&lt; Back</Button>
              <Button
                variant="primary"
                onClick={() => handleGoToNextTab('technical', isICCategory ? 'pricing' : 'package')}
              >
                {isICCategory ? 'Next: Pricing & Tax >' : 'Next: Package & Components >'}
              </Button>
            </div>
          </Card>
        );
      })()
    },
    ...(isICCategory ? [] : [{
      id: 'package',
      label: '3. Package & Components',
      content: (
        <Card className="mt-4 animate-fade-in">
          {!isReadOnly && (
            <div className="flex gap-4 items-end mb-6 p-4 bg-secondary-bg rounded border border-border-color flex-wrap">
              <div className="flex flex-col gap-1 shrink-0" style={{ width: '200px' }}>
                <label className="text-xs uppercase text-secondary font-semibold">Item Type</label>
                <select 
                  value={selectedItemType} 
                  onChange={e => {
                    setSelectedItemType(e.target.value as any);
                    setSelectedItemId(0);
                    setSelectedItemPrice('');
                  }} 
                  className="input-field text-sm w-full"
                  style={{ height: '36px', padding: '0 0.5rem' }}
                >
                  <option value="product">Product Component</option>
                  <option value="package">Standard Package</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 shrink-0" style={{ minWidth: '220px', flex: 1 }}>
                <label className="text-xs uppercase text-secondary font-semibold">Select Item</label>
                <select 
                  value={selectedItemId} 
                  onChange={e => {
                    const id = Number(e.target.value);
                    setSelectedItemId(id);
                    setSelectedItemPrice('');
                  }} 
                  className="input-field text-sm w-full uppercase"
                  style={{ height: '36px', padding: '0 0.5rem' }}
                >
                  <option value={0} disabled>Select item...</option>
                  {selectedItemType === 'product'
                    ? products.map(p => <option key={p.id} value={p.id}>{(p.brand || '').toUpperCase()} {(p.model || '').toUpperCase()}</option>)
                    : packages.map(p => <option key={p.id} value={p.id}>{(p.name || '').toUpperCase()}</option>)
                  }
                </select>
              </div>

              <div className="flex flex-col gap-1 shrink-0" style={{ width: '80px' }}>
                <label className="text-xs uppercase text-secondary font-semibold">Qty</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={selectedItemQty}
                  onChange={e => setSelectedItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="input-field text-sm w-full"
                  style={{ height: '36px', padding: '0 0.5rem', textAlign: 'center' }}
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0" style={{ width: '140px' }}>
                <label className="text-xs uppercase text-secondary font-semibold">Unit Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter ₹..."
                  value={selectedItemPrice}
                  onChange={e => setSelectedItemPrice(e.target.value)}
                  className="input-field text-sm w-full font-semibold"
                  style={{ height: '36px', padding: '0 0.5rem' }}
                />
              </div>

              <Button 
                variant="secondary" 
                onClick={handleAddItem} 
                disabled={!selectedItemId || !selectedItemPrice.trim() || Number(selectedItemPrice) <= 0}
                style={{ height: '36px', padding: '0 1.25rem', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                + Add Item
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: isReadOnly ? '33.33%' : 'calc((100% - 70px) / 3)' }} />
                <col style={{ width: isReadOnly ? '33.33%' : 'calc((100% - 70px) / 3)' }} />
                <col style={{ width: isReadOnly ? '33.33%' : 'calc((100% - 70px) / 3)' }} />
                {!isReadOnly && <col style={{ width: '70px' }} />}
              </colgroup>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                <tr className="border-b border-border-color text-left">
                  <th className="p-2" style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Item</th>
                  <th className="p-2" style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty</th>
                  <th className="p-2" style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Price</th>
                  {!isReadOnly && <th className="p-2" style={{ width: '70px', textAlign: 'center', padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {formData.items?.length === 0 ? (
                  <tr><td colSpan={isReadOnly ? 3 : 4} className="text-center p-6 text-muted">No items added yet.</td></tr>
                ) : (
                  formData.items?.map((item, idx) => (
                    <tr key={idx} className="border-b border-border-color last:border-0">
                      <td className="p-2 align-middle" style={{ verticalAlign: 'middle', padding: '10px 14px' }}>
                        <div className="font-semibold truncate uppercase">{item.name}</div>
                        {item.description && (
                          <div
                            className="text-xs text-secondary truncate"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="p-2 align-middle" style={{ verticalAlign: 'middle', textAlign: 'left', padding: '10px 14px' }}>
                        {isReadOnly ? item.quantity : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  handleRemoveItem(idx);
                                } else {
                                  handleUpdateItem(idx, 'quantity', item.quantity - 1);
                                }
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              value={item.quantity}
                              onChange={e => {
                                const raw = parseInt(e.target.value, 10);
                                if (isNaN(raw) || raw <= 0) {
                                  handleRemoveItem(idx);
                                } else {
                                  const val = Math.min(raw, 100000);
                                  handleUpdateItem(idx, 'quantity', val);
                                }
                              }}
                              className="input-field text-center text-sm"
                              style={{
                                width: '64px',
                                minWidth: '64px',
                                maxWidth: '64px',
                                height: '28px',
                                padding: '0 0.25rem',
                                textAlign: 'center',
                                MozAppearance: 'textfield',
                                WebkitAppearance: 'none'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(idx, 'quantity', Math.min((item.quantity || 1) + 1, 100000))}
                              disabled={item.quantity >= 100000}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                fontWeight: 'bold',
                                fontSize: '15px',
                                cursor: item.quantity >= 100000 ? 'not-allowed' : 'pointer',
                                opacity: item.quantity >= 100000 ? 0.4 : 1,
                                flexShrink: 0
                              }}
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2 align-middle" style={{ verticalAlign: 'middle', textAlign: 'left', padding: '10px 14px' }}>
                        {isReadOnly ? formatCurrency((item.unit_price || 0) / 100) : (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ marginRight: '4px', color: '#64748b', fontSize: '14px' }}>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price ? item.unit_price / 100 : ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  const newPrice = isNaN(val) ? 0 : Math.round(val * 100);
                                  handleUpdateItem(idx, 'unit_price', newPrice);
                                }}
                                className={`input-field text-sm font-semibold ${(!item.unit_price || Number(item.unit_price) <= 0) ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : ''}`}
                                style={{
                                  width: '100px',
                                  padding: '4px 8px',
                                  height: '32px',
                                  minHeight: '32px'
                                }}
                                placeholder="0.00"
                              />
                            </div>
                            {(!item.unit_price || Number(item.unit_price) <= 0) && (
                              <span className="text-xs text-red-500 font-semibold mt-1 block">
                                ⚠️ Price must be &gt; ₹0
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {!isReadOnly && (
                        <td
                          className="p-2 text-center align-middle"
                          style={{
                            width: '70px',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                            padding: '10px 8px'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Delete item"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-border-color">
            <Button variant="secondary" onClick={() => setActiveTab('technical')}>&lt; Back</Button>
            <Button
              variant="primary"
              onClick={() => handleGoToNextTab('package', 'pricing')}
            >
              Next: Pricing & Tax &gt;
            </Button>
          </div>
        </Card>
      )
    }]),
    {
      id: 'pricing',
      label: isICCategory ? '3. Pricing & Tax' : '4. Pricing & Tax',
      content: (
        <Card className="mt-4 animate-fade-in">
          <h3 className="mb-4">Pricing Summary</h3>

          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Subtotal (₹)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  value={formData.subtotal ? formData.subtotal / 100 : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const subtotal = isNaN(val) ? 0 : Math.round(val * 100);
                    const prevSub = formData.subtotal || 0;
                    const taxPct = (isTaxManuallySet && taxInput !== '')
                      ? (parseFloat(taxInput) || 0)
                      : (prevSub > 0 && formData.total_tax !== undefined)
                        ? ((formData.total_tax / prevSub) * 100)
                        : (formData.total_tax === 0 ? 0 : 18);
                    
                    const isInclusive = !!formData.tax_inclusive;
                    let total_tax = 0;
                    if (isInclusive) {
                      total_tax = taxPct > 0 ? Math.round(subtotal - subtotal / (1 + taxPct / 100)) : 0;
                    } else {
                      total_tax = Math.round(subtotal * (taxPct / 100));
                    }
                    const discountValidation = validateDiscountInput(discountInput, subtotal, total_tax);
                    const effectiveDiscount = discountValidation.isValid ? discountValidation.discountPaise : 0;
                    const grand_total = isInclusive
                      ? subtotal - effectiveDiscount
                      : subtotal + total_tax - effectiveDiscount;
                    setFormData(prev => ({ ...prev, subtotal, total_tax, total_discount: effectiveDiscount, grand_total }));
                  }}
                  onKeyDown={e => handleNonNegativeKeyDown(e, true)}
                  onPaste={e => handleNonNegativePaste(e, true)}
                  onWheel={handleWheelPrevent}
                  disabled={isReadOnly}
                  placeholder="0.00"
                />
              </div>

              {/* Tax Type & Tax Rate (Aligned on the same line) */}
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center h-5">
                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Tax Type</label>
                  </div>
                  <select
                    className="input-field font-semibold bg-white cursor-pointer"
                    value={formData.tax_inclusive ? 'Inclusive' : 'Exclusive'}
                    onChange={e => handleTaxTypeChange(e.target.value as 'Exclusive' | 'Inclusive')}
                    disabled={isReadOnly}
                  >
                    <option value="Exclusive">Exclusive</option>
                    <option value="Inclusive">Inclusive</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center whitespace-nowrap gap-2 h-5">
                    <label htmlFor="global-tax-input" className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                      Total Tax (%)
                    </label>
                    {!!formData.subtotal && (
                      <span className="text-xs text-secondary font-medium whitespace-nowrap">
                        Amount: {formatCurrency((formData.total_tax || 0) / 100)}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input 
                      id="global-tax-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="input-field pr-8"
                      style={{ paddingRight: '28px' }}
                      value={taxInput}
                      onChange={handleTaxChange}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => handleNumericOnlyKeyDown(e, true)}
                      onPaste={handleNumericOnlyPaste}
                      onWheel={handleWheelPrevent}
                      disabled={isReadOnly}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                    >
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label htmlFor="global-discount-input" className="text-sm font-semibold">Global Discount (%)</label>
                  {!!formData.subtotal && !discountError && (
                    <span className="text-xs text-secondary font-medium">
                      Amount: {formatCurrency((formData.total_discount || 0) / 100)}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    id="global-discount-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    className={`input-field pr-8 ${discountError ? 'border-red-500 bg-red-50' : ''}`}
                    style={{ paddingRight: '28px' }}
                    value={discountInput}
                    onChange={handleDiscountChange}
                    onFocus={e => e.target.select()}
                    onKeyDown={e => handleNumericOnlyKeyDown(e, true)}
                    onPaste={handleNumericOnlyPaste}
                    onWheel={handleWheelPrevent}
                    disabled={isReadOnly}
                    aria-invalid={discountError ? 'true' : 'false'}
                    aria-describedby={discountError ? 'global-discount-error' : undefined}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.9rem'
                    }}
                  >
                    %
                  </span>
                </div>
                {discountError && (
                  <p id="global-discount-error" className="text-sm text-red-600 mt-1 font-medium" role="alert">
                    {discountError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">State Subsidy (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={formData.state_subsidy ? formData.state_subsidy / 100 : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const state_subsidy = isNaN(val) || val < 0 ? 0 : Math.round(val * 100);
                    setFormData(prev => ({ ...prev, state_subsidy }));
                  }}
                  onKeyDown={handleNonNegativeKeyDown}
                  onPaste={handleNonNegativePaste}
                  onWheel={handleWheelPrevent}
                  disabled={isReadOnly}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Central Government Subsidy (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={formData.central_subsidy ? formData.central_subsidy / 100 : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const central_subsidy = isNaN(val) || val < 0 ? 0 : Math.round(val * 100);
                    setFormData(prev => ({ ...prev, central_subsidy }));
                  }}
                  onKeyDown={handleNonNegativeKeyDown}
                  onPaste={handleNonNegativePaste}
                  onWheel={handleWheelPrevent}
                  disabled={isReadOnly}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Bank Account</label>
                <select
                  className="input-field"
                  value={formData.bank_account_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_account_id: e.target.value || null }))}
                  disabled={isReadOnly}
                >
                  <option value="">-- Select Bank Account --</option>
                  {bankAccounts.filter(acc => acc.status === 'Active').map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber} ({acc.accountName})
                    </option>
                  ))}
                </select>
              </div>

            </div>
            <div className="bg-secondary-bg p-6 rounded-md border border-border-color flex flex-col justify-center text-center">
              <div className="text-lg font-semibold mb-2">Grand Total</div>
              <div className={`text-5xl font-bold ${formData.grand_total !== undefined && formData.grand_total < 0 ? 'text-red-600' : 'text-primary-color'}`}>
                {formData.grand_total !== undefined && formData.grand_total < 0
                  ? `-${formatCurrency(Math.abs(formData.grand_total) / 100)}`
                  : formatCurrency((formData.grand_total || 0) / 100)}
              </div>
              <div className="text-xs text-secondary font-semibold uppercase tracking-wider mt-2">
                {formData.tax_inclusive ? 'Tax Inclusive' : 'Tax Exclusive'}
              </div>
              {!!formData.total_discount && !discountError && (
                <div className="mt-2 text-sm text-green-700 font-semibold">
                  (Includes {discountInput}% &bull; {formatCurrency(formData.total_discount / 100)} global discount)
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-6 pt-4 border-t border-border-color">
            <Button variant="secondary" onClick={() => setActiveTab(isICCategory ? 'technical' : 'package')}>&lt; Back</Button>
            <Button
              variant="primary"
              onClick={() => handleGoToNextTab('pricing', 'terms')}
            >
              Next: Terms & Condition &gt;
            </Button>
          </div>
        </Card>
      )
    },
    {
      id: 'terms',
      label: isICCategory ? '4. Terms & Condition' : '5. Terms & Condition',
      content: (
        <Card className="mt-4 animate-fade-in">
          <h3 className="mb-4">
            Commercial Terms & Conditions <span className="text-red-500">*</span>
          </h3>
          {(() => {
            const defaultTerms = [
              { key: "Prices", value: "Price quoted Ex-works" },
              { key: "GST", value: "5% included" },
              { key: "Installation", value: "Installation will be commenced by TO-GEN SOLAR AGRO after receipt of materials at the site and receipt of site clearance" },
              { key: "Packing & Forwarding", value: "Included, Single point delivery" },
              { key: "Entry Tax", value: "Inclusive" },
              { key: "Payment", value: "I. 80% of Final Price Offer in Advance.\nII. 10% to be paid after Material Supply of Solar Panels, Inverters and other BoS items.\nIII. 10% after Installation and Commissioning." },
              { key: "Delivery", value: "Within 7 Days from the date of receipt of the Purchase Order" },
              { key: "Net Meter", value: "Inclusive" },
              { key: "Warranty", value: "PV Modules: 12-years of Product, 30-years of Power Output\nInverter : 8 Years" },
              { key: "Quote Validity", value: "This offer is valid up to 7 Days from the date of submission" },
              { key: "Comprehensive Maintenance", value: "5 years, site visit Every quarter after commissioning of the system for maintenance purpose." }
            ];

            let terms = [...defaultTerms];
            try {
              if (formData.payment_terms) {
                const parsed = JSON.parse(formData.payment_terms);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  terms = parsed.map((t: any) => {
                    if (t.key && (t.key.toLowerCase().includes('validity') || t.key === 'Quote Validity')) {
                      if (typeof t.value === 'string' && t.value.includes('10 Days from the date of submission')) {
                        return {
                          ...t,
                          value: t.value.replace(/10 Days from the date of submission/g, `${formData.validity_days || 7} Days from the date of submission`)
                        };
                      }
                    }
                    if (t.key && (t.key.toLowerCase().includes('delivery') || t.key === 'Delivery')) {
                      if (typeof t.value === 'string' && t.value.includes('Within 10 Days from the date of receipt of the Purchase Order')) {
                        return {
                          ...t,
                          value: t.value.replace(/Within 10 Days from the date of receipt of the Purchase Order/g, 'Within 7 Days from the date of receipt of the Purchase Order')
                        };
                      }
                    }
                    return t;
                  });
                }
              }
            } catch (e) {
              // Ignore legacy format and just show the default fields.
            }

            return (
              <div className="flex flex-col gap-4">
                {terms.map((term: any, index: number) => (
                  <div key={index} className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700">{term.key}</label>
                    <textarea
                      className="input-field w-full min-h-[40px] resize-y"
                      value={term.value}
                      onChange={(e) => {
                        const newTerms = [...terms];
                        newTerms[index].value = e.target.value;
                        setFormData(p => ({ ...p, payment_terms: JSON.stringify(newTerms) }));
                      }}
                      disabled={isReadOnly}
                      placeholder={`Enter ${term.key} details...`}
                      rows={term.value.split('\n').length > 1 ? 3 : 1}
                    />
                  </div>
                ))}
              </div>
            );
          })()}

          <h3 className="mb-4 pt-4 mt-4 border-t border-border-color">Internal Notes</h3>
          <textarea
            className="input-field w-full min-h-[80px]"
            value={formData.notes_internal || ''}
            onChange={e => setFormData(p => ({ ...p, notes_internal: e.target.value }))}
            placeholder="Private notes (not shown to customer)..."
          />

          <div className="flex justify-between mt-6 pt-4 border-t border-border-color">
            <Button variant="secondary" onClick={() => setActiveTab('pricing')}>&lt; Back</Button>
            {hideSitePhotosTab ? (
              !isReadOnly && (
                <Button
                  variant="primary"
                  onClick={() => handleSave(false)}
                  disabled={saving || (!isNew && !isChanged)}
                  title={!isNew && !isChanged ? 'No changes to save' : 'Save quotation'}
                >
                  {saving ? 'Saving...' : 'Save Quotation'}
                </Button>
              )
            ) : (
              <Button variant="primary" onClick={() => handleGoToNextTab('terms', 'scope')}>Next: Project Images & Scope &gt;</Button>
            )}
          </div>
        </Card>
      )
    },
    ...(!hideSitePhotosTab ? [{
      id: 'scope',
      label: isICCategory ? '5. Project Images & Scope' : '6. Project Images & Scope',
      content: (
        <Card className="mt-4 animate-fade-in">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
            <div>
              <h3 className="m-0 text-base font-bold text-gray-900 flex items-center gap-2">
                <span>Customer & Project Images</span>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 600, border: '1px solid #bae6fd' }}>
                  PDF Image Section (Max 3 Images)
                </span>
              </h3>
              <p className="text-xs text-secondary mt-1">
                Upload customer/project photos (e.g. Rooftop, EB board, Inverter area). These images will be displayed in the Quotation PDF image section. If no images are uploaded, the image section will completely disappear from the PDF.
              </p>
            </div>
            <div>
              <Badge variant={sitePhotos.length > 0 ? 'success' : 'default'}>
                {sitePhotos.length} / 3 Images Uploaded
              </Badge>
            </div>
          </div>

          {/* Site Photos Limit Indicator */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
            backgroundColor: sitePhotos.length >= 3 ? '#f0fdf4' : 'var(--bg-surface-subtle)',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                {sitePhotos.length >= 3 ? (
                  <span style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Maximum 3 Project Images Attached (Limit Reached)
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={16} /> Project Images: {sitePhotos.length} of 3 uploaded (Optional • {3 - sitePhotos.length} slot{3 - sitePhotos.length > 1 ? 's' : ''} available)
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {sitePhotos.length} / 3 Photos
              </span>
            </div>

            {/* Visual Step Progress Bar */}
            <div style={{ width: '100%', backgroundColor: '#e2e8f0', height: '8px', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (sitePhotos.length / 3) * 100)}%`,
                  backgroundColor: sitePhotos.length >= 3 ? '#16a34a' : 'var(--primary-color)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
              <div style={{
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: sitePhotos.length >= 1 ? '#dcfce7' : '#ffffff',
                color: sitePhotos.length >= 1 ? '#166534' : 'var(--text-muted)',
                border: sitePhotos.length >= 1 ? '1px solid #bbf7d0' : '1px solid var(--border-color)'
              }}>
                1. Rooftop Area {sitePhotos.length >= 1 && '✓'}
              </div>
              <div style={{
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: sitePhotos.length >= 2 ? '#dcfce7' : '#ffffff',
                color: sitePhotos.length >= 2 ? '#166534' : 'var(--text-muted)',
                border: sitePhotos.length >= 2 ? '1px solid #bbf7d0' : '1px solid var(--border-color)'
              }}>
                2. EB Meter Board {sitePhotos.length >= 2 && '✓'}
              </div>
              <div style={{
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: sitePhotos.length >= 3 ? '#dcfce7' : '#ffffff',
                color: sitePhotos.length >= 3 ? '#166534' : 'var(--text-muted)',
                border: sitePhotos.length >= 3 ? '1px solid #bbf7d0' : '1px solid var(--border-color)'
              }}>
                3. Inverter Area {sitePhotos.length >= 3 && '✓'}
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!isReadOnly && (
            <div style={{ marginBottom: '20px' }}>
              <input
                id="site-photos-upload-input"
                type="file"
                multiple
                accept="image/*"
                disabled={sitePhotos.length >= 3}
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleSitePhotosUpload(e.target.files);
                  }
                  e.target.value = '';
                }}
              />
              <label
                htmlFor={sitePhotos.length >= 3 ? undefined : "site-photos-upload-input"}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: sitePhotos.length >= 3 ? '#f8fafc' : 'var(--bg-surface-subtle)',
                  cursor: sitePhotos.length >= 3 ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  opacity: sitePhotos.length >= 3 ? 0.75 : 1
                }}
                onMouseEnter={e => {
                  if (sitePhotos.length < 3) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--primary-light)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = sitePhotos.length >= 3 ? '#f8fafc' : 'var(--bg-surface-subtle)';
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  color: sitePhotos.length >= 3 ? '#16a34a' : 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {sitePhotos.length >= 3 ? <CheckCircle2 size={22} /> : <Camera size={22} />}
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {sitePhotos.length >= 3 ? 'Maximum 3 Photos Attached (Limit Reached)' : 'Click to select Site Photos or Drag & Drop here'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {sitePhotos.length >= 3 
                    ? 'Customer choice limit reached (3 / 3). Remove an existing photo below to replace.' 
                    : `Customer choice: upload up to ${3 - sitePhotos.length} more photo(s) • JPG, PNG, WEBP`}
                </span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', backgroundColor: '#ffffff', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>Rooftop View</span>
                  <span style={{ fontSize: '0.6875rem', backgroundColor: '#ffffff', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>EB Meter Box</span>
                  <span style={{ fontSize: '0.6875rem', backgroundColor: '#ffffff', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>Shadow Obstacles</span>
                  <span style={{ fontSize: '0.6875rem', backgroundColor: '#ffffff', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>Inverter Location</span>
                </div>
              </label>
            </div>
          )}

          {/* Uploaded Photos Grid */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Uploaded Site Photos ({sitePhotos.length})
              </h4>
              {sitePhotos.length > 0 && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleClearAllPhotos}
                  style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  Clear All Photos
                </button>
              )}
            </div>

            {sitePhotos.length === 0 ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1.5px dashed var(--border-color)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--text-muted)',
                fontSize: '0.8125rem'
              }}>
                No project images uploaded yet (Optional). Any images uploaded here will appear in the Quotation PDF. If no images are added, the PDF image section will not appear.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px'
              }}>
                {sitePhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ position: 'relative', height: '160px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <img
                        src={photo.dataUrl}
                        alt={photo.caption || photo.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(2px)',
                        color: '#ffffff',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}>
                        Photo #{index + 1}
                      </div>
                      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewModalImage({ url: photo.dataUrl, title: photo.caption || `Site Photo #${index + 1}` })}
                          style={{ width: '28px', height: '28px', borderRadius: '9999px', backgroundColor: 'rgba(0,0,0,0.65)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}
                          title="View full size"
                        >
                          <Eye size={13} />
                        </button>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSitePhoto(photo.id)}
                            style={{ width: '28px', height: '28px', borderRadius: '9999px', backgroundColor: '#dc2626', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}
                            title="Delete photo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Caption</span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{photo.size}</span>
                      </div>
                      <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setSitePhotos(prev => prev.map(p => p.id === photo.id ? { ...p, caption: val } : p));
                        }}
                        placeholder="Add caption e.g. Roof South Area..."
                        disabled={isReadOnly}
                        className="input-field"
                        style={{ fontSize: '0.8125rem', padding: '6px 10px', height: '34px', boxSizing: 'border-box', width: '100%' }}
                      />
                      <div style={{ marginTop: '6px', fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {photo.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Scope Responsibilities Checklist */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            marginBottom: '20px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              Customer Scope Responsibilities
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
              Standard site provisions and civil clearances to be arranged by the customer:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {[
                { key: 'roofAccess', label: 'Safe, unobstructed rooftop / terrace ladder access' },
                { key: 'waterSupply', label: 'Continuous water supply point on terrace for PV module cleaning' },
                { key: 'powerPoint', label: 'AC distribution point / meter location accessible within 20m' },
                { key: 'shadowFree', label: 'Shadow-free area guaranteed for designated structure footprint' },
                { key: 'internetAvailable', label: 'Broadband / Wi-Fi network available for inverter telemetry' },
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: (scopeChecklist as any)[item.key] ? '#f0fdf4' : '#ffffff',
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(scopeChecklist as any)[item.key]}
                    onChange={e => setScopeChecklist(p => ({ ...p, [item.key]: e.target.checked }))}
                    disabled={isReadOnly}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Customer Scope Special Remarks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Customer Scope Notes & Special Arrangements
            </label>
            <textarea
              className="input-field w-full min-h-[90px]"
              value={customerScopeNotes}
              onChange={e => setCustomerScopeNotes(e.target.value)}
              disabled={isReadOnly}
              placeholder="e.g. Customer will provide temporary power during civil works; tree trimming to be completed before installation..."
            />
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-border-color">
            <Button variant="secondary" onClick={() => setActiveTab('terms')}>&lt; Back</Button>
            {!isReadOnly && (
              <Button
                variant="primary"
                onClick={() => handleSave(false)}
                disabled={saving || (!isNew && !isChanged)}
                title={!isNew && !isChanged ? 'No changes to save' : 'Save quotation'}
              >
                Save Quotation
              </Button>
            )}
          </div>
        </Card>
      )
    }] : [])
  ];

  const linkedCustomerId = searchParams.get('customerId') || formData.customer_id;
  const matchedCustomer = customers.find(c => c.id === Number(linkedCustomerId));

  const handleBack = () => {
    if (linkedCustomerId && Number(linkedCustomerId) > 0) {
      navigate(`/customers/${linkedCustomerId}`);
    } else {
      navigate('/quotations');
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Quotation',
      description: `Are you sure you want to delete quotation ${formData.reference || ''}? This action cannot be undone.`,
      confirmLabel: 'Delete Quotation',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await window.desktop.quotations.delete(Number(id));
      if (res.success) {
        if (linkedCustomerId && Number(linkedCustomerId) > 0) {
          navigate(`/customers/${linkedCustomerId}`);
        } else {
          navigate('/quotations');
        }
      } else {
        await showAlert({
          type: 'error',
          title: 'Deletion Failed',
          description: res.error?.message || 'Failed to delete quotation',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err.message || String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-24">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 pr-[10px]">
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div className="flex gap-2 text-sm text-muted mb-2 flex-wrap">
            {matchedCustomer ? (
              <>
                <a href="#/customers" className="hover:text-primary-color">Customers</a>
                <span>/</span>
                <a href={`#/customers/${matchedCustomer.id}`} className="hover:text-primary-color">{matchedCustomer.name}</a>
                <span>/</span>
              </>
            ) : (
              <>
                <a href="#/quotations" className="hover:text-primary-color">Quotations</a>
                <span>/</span>
              </>
            )}
            <span className="text-secondary">{isNew ? 'New Quotation' : `${formData.reference}`}</span>
          </div>
          <h1 className="text-3xl font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ margin: 0 }}>
            {isNew ? 'Create Quotation' : `${formData.reference}`}
          </h1>
          {(!isNew && formData.status !== 'Draft') ? (
            <p className="text-secondary mt-1">Status: {formData.status}</p>
          ) : isNew ? (
            <p className="text-secondary mt-1">
              {isManualCustomer && manualCustomer.name.trim()
                ? `Quotation for ${manualCustomer.name.trim()}`
                : (matchedCustomer ? `Quotation for ${matchedCustomer.name}` : '')}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 items-center flex-wrap xl:justify-end shrink-0">
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          {!isNew && (
            <Button
              variant="secondary"
              disabled={!isProposalPdfReady || downloadingPdf}
              onClick={async () => {
                if (!isProposalPdfReady) {
                  await showAlert({
                    type: 'warning',
                    title: 'Proposal PDF Incomplete',
                    description: `Cannot generate Proposal PDF. Please complete the following required details:\n\n• ${missingProposalRequirements.join('\n• ')}`,
                  });
                  return;
                }
                setDownloadingPdf(true);
                try {
                  const fullRes = await window.desktop.quotations.get(Number(id));
                  const fullQuote: Quotation = {
                    ...(fullRes.success ? fullRes.data : {}),
                    ...(formData as Quotation),
                    technicalDetails: {
                      ...(fullRes.success ? fullRes.data?.technicalDetails : {}),
                      ...formData.technicalDetails,
                    },
                    sitePhotos: hideSitePhotosTab
                      ? []
                      : (sitePhotos.length > 0
                          ? sitePhotos.slice(0, 3).map((p, idx) => ({
                              photo_order: idx + 1,
                              name: p.name,
                              size: p.size,
                              data_url: p.dataUrl,
                              caption: p.caption,
                              uploaded_at: p.uploadedAt,
                            }))
                          : (fullRes.success && fullRes.data?.sitePhotos ? fullRes.data.sitePhotos : [])),
                    customerName: isManualCustomer ? manualCustomer.name : (selectedCustomer?.name || (fullRes.success ? fullRes.data?.customerName : undefined)),
                    customerPhone: isManualCustomer ? manualCustomer.phone : (selectedCustomer?.phone || (fullRes.success ? fullRes.data?.customerPhone : undefined)),
                    customerEmail: isManualCustomer ? manualCustomer.email : (selectedCustomer?.email || (fullRes.success ? fullRes.data?.customerEmail : undefined)),
                    siteAddress: isManualCustomer 
                      ? [manualCustomer.address, manualCustomer.city].filter(Boolean).join(', ')
                      : (sites.find(s => s.id === formData.site_id)?.address || selectedCustomer?.address || (fullRes.success ? fullRes.data?.siteAddress : '')),
                  };
                  await generateQuotationPDF(fullQuote);
                } catch (err: any) {
                  showAlert({
                    type: 'error',
                    title: 'Quotation PDF Error',
                    description: err.message || 'Failed to generate quotation PDF',
                  });
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              title={
                isProposalPdfReady
                  ? 'Download Official Quotation Proposal PDF'
                  : `Proposal PDF requires filling all required details:\n${missingProposalRequirements.slice(0, 3).join(', ')}${missingProposalRequirements.length > 3 ? '...' : ''}`
              }
              className={`flex items-center gap-1.5 ${(!isProposalPdfReady || downloadingPdf) ? 'opacity-50 cursor-not-allowed !bg-gray-100 !text-gray-400 !border-gray-300' : ''}`}
            >
              {downloadingPdf ? (
                <div className="liquid-spinner"></div>
              ) : (
                <FileText className="w-4 h-4 text-primary" />
              )}
              Proposal PDF
            </Button>
          )}
          {!isNew && (
            <Button
              variant="primary"
              onClick={() => handleSave(false)}
              disabled={saving || !isChanged}
              title={!isChanged ? 'No changes to save' : 'Save changes to quotation'}
            >
              {saving ? 'Saving...' : (isChanged ? `Save ${changeCount} ${changeCount === 1 ? 'Change' : 'Changes'}` : 'Save Changes')}
            </Button>
          )}
          {formData.status === 'Issued' ? (
            <Button
              variant="secondary"
              disabled
              className="!bg-white !text-primary !border-primary opacity-80 cursor-default"
              title="This quotation is already issued"
            >
              Issued
            </Button>
          ) : (
            <Button
              variant={isNew ? 'primary' : 'secondary'}
              onClick={() => handleSave(true)}
              disabled={saving}
              title="Issue this quotation"
            >
              Issue
            </Button>
          )}
          {!isNew && (
            <Button variant="danger" onClick={handleDelete} disabled={saving}>Delete</Button>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 p-4 bg-red-50 rounded border border-red-200">{error}</div>}

      <Tabs
        items={editorTabs}
        activeId={activeTab}
        onChange={handleTabChange}
      />
      {/* Lightbox Image Preview Modal (Fixed Consistent Size Popup) */}
      {previewModalImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              width: '840px',
              maxWidth: '92vw',
              height: '620px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxSizing: 'border-box',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header Bar - Fixed Height */}
            <div style={{
              height: '56px',
              minHeight: '56px',
              maxHeight: '56px',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 20px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: '#f8fafc',
              boxSizing: 'border-box',
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f2b48', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '720px' }}>
                {previewModalImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9999px',
                  backgroundColor: '#e2e8f0',
                  color: '#1e293b',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Image Body - Fixed Frame with perfectly contained image */}
            <div style={{
              flex: 1,
              width: '100%',
              height: 'calc(100% - 56px)',
              padding: '20px',
              boxSizing: 'border-box',
              backgroundColor: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
