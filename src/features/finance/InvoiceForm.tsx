import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency, formatNotesToPlainText } from '../../utils/formatters';
import type { CreateInvoiceDto, UpdateInvoiceDto, Invoice, InvoiceLine } from '@shared/types/finance.types';
import type { Project } from '@shared/types/project.types';
import { Landmark } from 'lucide-react';
import {
  getBankAccounts,
  getInvoiceBankAccountId,
  setInvoiceBankAccountId,
  BankAccount
} from '../../utils/bankAccountStorage';
import {
  getLineQuantityError,
  getLineUnitError,
  getLineRateError,
  getLineDiscountError,
  getLineTotalError,
  MAX_INVOICE_ITEMS,
  MAX_INVOICE_TOTAL
} from '../../utils/invoiceValidation';

const normalizeHsnSac = (code?: string): string => {
  return code ? code.trim() : '';
};

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMinDueDate = (issueDateStr?: string) => {
  if (!issueDateStr) return '';
  const parts = issueDateStr.split('-');
  if (parts.length !== 3) return '';
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('customerId');
  const queryProjectId = searchParams.get('projectId');
  const { showConfirm, showAlert } = useAlert();
  const isEditing = Boolean(id);

  const prefillProjectId = queryProjectId ? Number(queryProjectId) : (location.state as any)?.projectId;
  const prefillCustomerId = queryCustomerId ? Number(queryCustomerId) : (location.state as any)?.customerId;

  const today = getTodayStr();
  const defaultDueDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const [formData, setFormData] = useState<Partial<CreateInvoiceDto>>({
    project_id: prefillProjectId || 0,
    customer_id: prefillCustomerId || 0,
    invoice_type: 'Tax Invoice',
    issue_date: today,
    due_date: defaultDueDate,
    amount: 0,
    tax_amount: 0,
    total_amount: 0,
    status: 'Pending',
    notes: '',
    lines: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [originalData, setOriginalData] = useState<any | null>(null);
  const [linkedQuotationRef, setLinkedQuotationRef] = useState<string | null>(null);
  const [isLoadingQuotation, setIsLoadingQuotation] = useState<boolean>(false);
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);

  // Bank Account State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [originalBankAccountId, setOriginalBankAccountId] = useState<string>('');

  const selectedBankAccount = useMemo(() => {
    return bankAccounts.find(a => a.id === selectedBankAccountId) || bankAccounts[0];
  }, [bankAccounts, selectedBankAccountId]);

  const applyQuotation = async (
    quoteId: number | null,
    overrideProjectId?: number,
    overrideCustomerId?: number
  ) => {
    if (!quoteId) {
      setFormData(prev => ({
        ...prev,
        quotation_id: null,
        lines: []
      }));
      calculateTotals([]);
      setLinkedQuotationRef(null);
      return;
    }

    setIsLoadingQuotation(true);
    try {
      const qRes = await window.desktop.quotations.get(quoteId);
      if (qRes.success && qRes.data) {
        const quoteToLoad = qRes.data;
        const detectedRef = quoteToLoad.reference || `QR-${quoteId}`;

        let mappedLines: Partial<InvoiceLine>[] = [];

        const parseQuotationPrice = (val: any) => {
          if (!val) return 0;
          const numVal = Number(val) || 0;
          if (numVal <= 0) return 0;
          // If stored in paise (e.g. > 100,000 paise = > ₹1,000 in paise format), convert to Rupees.
          // If <= 100,000, it is already stored directly in Rupees.
          return numVal > 100000 ? (numVal / 100) : numVal;
        };

        const quoteSubtotal = parseQuotationPrice(quoteToLoad.subtotal);
        const quoteTax = parseQuotationPrice(quoteToLoad.total_tax);
        const quoteGrandTotal = parseQuotationPrice(quoteToLoad.grand_total);

        const isInclusive = !!quoteToLoad.tax_inclusive ||
          (quoteGrandTotal > 0 && (quoteSubtotal === quoteGrandTotal || quoteSubtotal === 0) && quoteTax > 0);

        let defaultTaxRate = 18;
        if (quoteToLoad.manual_tax_rate !== undefined && quoteToLoad.manual_tax_rate !== null && Number(quoteToLoad.manual_tax_rate) > 0) {
          defaultTaxRate = Number(quoteToLoad.manual_tax_rate);
        } else if (quoteToLoad.tax_rate !== undefined && quoteToLoad.tax_rate !== null && Number(quoteToLoad.tax_rate) > 0) {
          defaultTaxRate = Number(quoteToLoad.tax_rate);
        } else if (quoteTax > 0) {
          if (isInclusive && quoteGrandTotal > quoteTax) {
            defaultTaxRate = Math.round((quoteTax / (quoteGrandTotal - quoteTax)) * 100);
          } else if (quoteSubtotal > 0) {
            defaultTaxRate = Math.round((quoteTax / quoteSubtotal) * 100);
          }
        }
        if (defaultTaxRate <= 0) defaultTaxRate = 18;

        if (quoteToLoad.items && quoteToLoad.items.length > 0) {
          const itemsToLoad = quoteToLoad.items.slice(0, 500);
          mappedLines = itemsToLoad.map((item: any, idx: number) => {
            const rawQty = item.quantity;
            const parsedQty = Number(rawQty);
            const qty = !isNaN(parsedQty) ? parsedQty : 1;
            let rateRupees = parseQuotationPrice(item.unit_price);
            if (rateRupees <= 0 && item.total) {
              const itemTot = parseQuotationPrice(item.total);
              if (itemTot > 0 && qty > 0) {
                rateRupees = itemTot / qty;
              }
            }
            const discRupees = parseQuotationPrice(item.discount);
            const grossItem = qty * rateRupees;
            let discPct = 0;
            if (grossItem > 0 && discRupees > 0) {
              discPct = discRupees <= 60 ? discRupees : Math.min(60, Math.round((discRupees / grossItem) * 100 * 100) / 100);
            }
            const discAmt = (grossItem * discPct) / 100;
            const taxRate = item.tax_rate !== undefined && item.tax_rate !== null && Number(item.tax_rate) > 0
              ? Number(item.tax_rate)
              : defaultTaxRate;

            const taxType: 'Inclusive' | 'Exclusive' = isInclusive ? 'Inclusive' : 'Exclusive';
            let taxableVal = 0;
            let taxAmt = 0;
            let lineTot = 0;

            if (taxType === 'Inclusive') {
              lineTot = Math.max(0, grossItem - discAmt);
              taxableVal = Math.round((lineTot / (1 + taxRate / 100)) * 100) / 100;
              taxAmt = Math.max(0, Math.round((lineTot - taxableVal) * 100) / 100);
            } else {
              taxableVal = Math.max(0, grossItem - discAmt);
              taxAmt = Math.max(0, Math.round(((taxableVal * taxRate) / 100) * 100) / 100);
              lineTot = Math.max(0, Math.round((taxableVal + taxAmt) * 100) / 100);
            }

            const desc = item.name
              ? (item.description && item.description.trim() && item.description.trim() !== item.name.trim()
                ? `${item.name} - ${item.description}`
                : item.name)
              : (item.description || `Solar System Component ${idx + 1}`);

            return {
              sl_no: idx + 1,
              description: desc,
              hsn_sac: normalizeHsnSac(item.hsn_sac),
              quantity: qty,
              unit: (item as any).unit ? String((item as any).unit) : '1',
              unit_price: rateRupees,
              discount: discPct,
              tax_type: taxType,
              tax_rate: taxRate,
              taxable_value: taxableVal,
              tax_amount: taxAmt,
              line_total: lineTot
            };
          });
          if (quoteToLoad.items.length > 500) {
            setFieldErrors(p => ({ ...p, lines: 'Maximum 500 items are allowed in an invoice.' }));
          }
        } else if (quoteToLoad.grand_total > 0 || quoteToLoad.subtotal > 0) {
          // Quotation has grand_total (e.g. ₹85,000) but no itemized rows
          const unitPrice = isInclusive
            ? (quoteGrandTotal > 0 ? quoteGrandTotal : quoteSubtotal)
            : (quoteSubtotal > 0 ? quoteSubtotal : quoteGrandTotal);
          const grossItem = unitPrice;

          const rawDisc = quoteToLoad.total_discount || 0;
          const discRupees = parseQuotationPrice(rawDisc);
          let discPct = 0;
          if (grossItem > 0 && discRupees > 0) {
            discPct = discRupees <= 60 ? discRupees : Math.min(60, Math.round((discRupees / grossItem) * 100 * 100) / 100);
          }
          const discAmt = (grossItem * discPct) / 100;

          const taxType: 'Inclusive' | 'Exclusive' = isInclusive ? 'Inclusive' : 'Exclusive';
          let taxableVal = 0;
          let taxAmt = 0;
          let lineTot = 0;

          if (taxType === 'Inclusive') {
            lineTot = Math.max(0, grossItem - discAmt);
            taxableVal = Math.round((lineTot / (1 + defaultTaxRate / 100)) * 100) / 100;
            taxAmt = Math.max(0, Math.round((lineTot - taxableVal) * 100) / 100);
          } else {
            taxableVal = Math.max(0, grossItem - discAmt);
            taxAmt = Math.max(0, Math.round(((taxableVal * defaultTaxRate) / 100) * 100) / 100);
            lineTot = Math.max(0, Math.round((taxableVal + taxAmt) * 100) / 100);
          }

          mappedLines = [{
            sl_no: 1,
            description: `Solar Power System Installation (${quoteToLoad.reference || 'Quotation'})`,
            hsn_sac: 'HSN',
            quantity: 1,
            unit: '1',
            unit_price: unitPrice,
            discount: discPct,
            tax_type: taxType,
            tax_rate: defaultTaxRate,
            taxable_value: taxableVal,
            tax_amount: taxAmt,
            line_total: lineTot
          }];
        }

        setLinkedQuotationRef(detectedRef);
        if (quoteToLoad.bank_account_id && !isEditing) {
          setSelectedBankAccountId(quoteToLoad.bank_account_id);
        }

        // Auto-match project if not specified
        let targetProjId = overrideProjectId ?? formData.project_id ?? 0;
        if (!targetProjId && projects.length > 0) {
          const matchingP = projects.find(p =>
            p.quotation_id === quoteToLoad.id ||
            p.customer_id === quoteToLoad.customer_id
          );
          if (matchingP) targetProjId = matchingP.id;
        }

        const targetCustId = overrideCustomerId ?? quoteToLoad.customer_id ?? formData.customer_id ?? 0;

        setFormData(prev => ({
          ...prev,
          project_id: targetProjId,
          customer_id: targetCustId,
          quotation_id: quoteToLoad.id,
          tax_inclusive: isInclusive,
          notes: prev.notes || formatNotesToPlainText(quoteToLoad.payment_terms) || ''
        }));
        calculateTotals(mappedLines);
        if (fieldErrors.lines) setFieldErrors(p => ({ ...p, lines: undefined }));
        if (fieldErrors.project_id && targetProjId) setFieldErrors(p => ({ ...p, project_id: undefined }));
      }
    } catch (err) {
      console.warn('[InvoiceForm] Failed to load quotation:', err);
    } finally {
      setIsLoadingQuotation(false);
    }
  };

  const applyProjectQuotation = async (proj: Project | undefined) => {
    if (!proj || !proj.id) {
      setFormData(prev => ({
        ...prev,
        project_id: 0,
        customer_id: 0,
        quotation_id: null,
        lines: []
      }));
      calculateTotals([]);
      setLinkedQuotationRef(null);
      return;
    }

    const customerId = proj.customer_id;
    let quoteId: number | null = proj.quotation_id || null;

    if (!quoteId) {
      const detectedRef = proj.quotation_ref || proj.quotationReference;
      if (detectedRef && detectedRef.trim()) {
        const match = quotations.find((q: any) =>
          q.reference && q.reference.trim().toLowerCase() === detectedRef.trim().toLowerCase()
        );
        if (match) {
          quoteId = match.id;
        }
      }
    }

    if (quoteId) {
      await applyQuotation(quoteId, proj.id, customerId);
    } else {
      // Project has NO quotation -> lines remain empty as normal
      setLinkedQuotationRef(null);
      setFormData(prev => ({
        ...prev,
        project_id: proj.id,
        customer_id: customerId,
        quotation_id: null,
        lines: []
      }));
      calculateTotals([]);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  const loadDependencies = async () => {
    try {
      const accounts = getBankAccounts();
      setBankAccounts(accounts);
      const savedBankId = isEditing && id ? getInvoiceBankAccountId(id) : null;
      const defaultAccount = (savedBankId && accounts.find(a => a.id === savedBankId)) ||
        accounts.find(a => a.isPrimary && a.status === 'Active') ||
        accounts.find(a => a.status === 'Active') ||
        accounts[0];
      if (defaultAccount) {
        setSelectedBankAccountId(defaultAccount.id);
        setOriginalBankAccountId(defaultAccount.id);
      }

      const [projRes, quoteRes] = await Promise.all([
        window.desktop.projects.list(),
        window.desktop.quotations.list()
      ]);
      if (quoteRes.success && quoteRes.data) {
        setQuotations(quoteRes.data);
      }
      if (projRes.success) {
        setProjects(projRes.data);
        if (!isEditing && prefillProjectId) {
          const p = projRes.data.find(x => x.id === prefillProjectId);
          if (p) {
            await applyProjectQuotation(p);
          }
        }
      }

      if (isEditing && id) {
        const res = await window.desktop.invoices.get(Number(id));
        if (res.success && res.data) {
          setInvoice(res.data);
          if (res.data.quotation_reference) {
            setLinkedQuotationRef(res.data.quotation_reference);
          }
          const savedBankId = (res.data.bank_account_id as string | undefined) || getInvoiceBankAccountId(id);
          if (savedBankId) {
            setSelectedBankAccountId(savedBankId);
            setOriginalBankAccountId(savedBankId);
          }
          const initial = {
            project_id: res.data.project_id,
            customer_id: res.data.customer_id,
            quotation_id: res.data.quotation_id || null,
            invoice_type: res.data.invoice_type || 'Tax Invoice',
            issue_date: res.data.issue_date?.split('T')[0] || '',
            due_date: res.data.due_date?.split('T')[0] || '',
            amount: res.data.amount / 100,
            tax_amount: res.data.tax_amount / 100,
            total_amount: res.data.total_amount / 100,
            status: res.data.status,
            notes: formatNotesToPlainText(res.data.notes) || '',
            lines: res.data.lines?.map(l => {
              const rawDisc = Number(l.discount || 0);
              const unitMultiplier = Number(l.unit) || 1;
              const grossRupees = (Number(l.quantity) || 1) * unitMultiplier * (l.unit_price / 100);
              const discPct = rawDisc > 60 && grossRupees > 0
                ? Math.min(60, Math.round(((rawDisc / 100) / grossRupees) * 100 * 100) / 100)
                : Math.min(60, rawDisc);
              return {
                ...l,
                hsn_sac: normalizeHsnSac(l.hsn_sac),
                unit: l.unit !== undefined && l.unit !== null ? String(l.unit) : '1',
                unit_price: l.unit_price / 100,
                discount: discPct,
                tax_type: (l as any).tax_type || (res.data.tax_inclusive ? 'Inclusive' : 'Exclusive'),
                taxable_value: l.taxable_value / 100,
                tax_amount: l.tax_amount / 100,
                line_total: l.line_total / 100
              };
            }) || []
          };
          setFormData(initial);
          setOriginalData(initial);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => {
    if (!isEditing) {
      const hasProject = Boolean(formData.project_id && formData.project_id > 0);
      const hasLines = Boolean(formData.lines && formData.lines.length > 0 && formData.lines.some(l => l.description?.trim() && (l.unit_price || 0) > 0));
      return hasProject && hasLines;
    }

    if (!originalData) return false;

    if (selectedBankAccountId !== originalBankAccountId) return true;
    if ((formData.issue_date || '') !== (originalData.issue_date || '')) return true;
    if ((formData.invoice_type || 'Tax Invoice') !== (originalData.invoice_type || 'Tax Invoice')) return true;
    if ((formData.due_date || '') !== (originalData.due_date || '')) return true;
    if ((formData.status || '') !== (originalData.status || '')) return true;
    if ((formData.notes || '').trim() !== (originalData.notes || '').trim()) return true;
    if (Number(formData.total_amount || 0) !== Number(originalData.total_amount || 0)) return true;

    const currLines = formData.lines || [];
    const origLines = originalData.lines || [];
    if (currLines.length !== origLines.length) return true;

    for (let i = 0; i < currLines.length; i++) {
      const c = currLines[i];
      const o = origLines[i];
      if (!o) return true;
      if ((c.description || '').trim() !== (o.description || '').trim()) return true;
      if ((c.hsn_sac || '').trim() !== (o.hsn_sac || '').trim()) return true;
      if (Number(c.quantity || 0) !== Number(o.quantity || 0)) return true;
      if ((c.unit || '') !== (o.unit || '')) return true;
      if (Number(c.unit_price || 0) !== Number(o.unit_price || 0)) return true;
      if (Number(c.discount || 0) !== Number(o.discount || 0)) return true;
      if ((c.tax_type || 'Exclusive') !== (o.tax_type || 'Exclusive')) return true;
      if (Number(c.tax_rate || 0) !== Number(o.tax_rate || 0)) return true;
      if (Number(c.line_total || 0) !== Number(o.line_total || 0)) return true;
    }

    return false;
  }, [isEditing, originalData, formData, selectedBankAccountId, originalBankAccountId]);

  const [fieldErrors, setFieldErrors] = useState<{ project_id?: string; issue_date?: string; due_date?: string; lines?: string }>({});

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    if (!formData.project_id && !formData.customer_id) {
      errs.project_id = 'Please select a project or customer.';
    }

    const minIssueDate = isEditing && originalData?.issue_date ? originalData.issue_date : getTodayStr();
    if (!formData.issue_date) {
      errs.issue_date = 'Issue date is required.';
    } else if (formData.issue_date < minIssueDate) {
      errs.issue_date = isEditing
        ? `Issue date cannot be earlier than the original invoice date (${originalData.issue_date}).`
        : 'Issue date cannot be in the past.';
    }

    if (!formData.due_date) {
      errs.due_date = 'Due date is required.';
    } else if (formData.issue_date && formData.due_date <= formData.issue_date) {
      errs.due_date = 'Due date must be after the issue date (at least 1 day later).';
    }

    if (!formData.lines || formData.lines.length === 0) {
      errs.lines = 'Please add at least one line item.';
    } else if (formData.lines.length > MAX_INVOICE_ITEMS) {
      errs.lines = `Maximum ${MAX_INVOICE_ITEMS} items are allowed in an invoice.`;
    } else {
      const invalidLine = formData.lines.find(l => !l.description?.trim());
      if (invalidLine) {
        errs.lines = 'All line items must have a description.';
      } else {
        const qtyErrLine = formData.lines.find(l => getLineQuantityError(l.quantity) !== null);
        if (qtyErrLine) {
          errs.lines = getLineQuantityError(qtyErrLine.quantity)!;
        } else {
          const unitErrLine = formData.lines.find(l => getLineUnitError(l.unit) !== null);
          if (unitErrLine) {
            errs.lines = getLineUnitError(unitErrLine.unit)!;
          } else {
            const rateErrLine = formData.lines.find(l => getLineRateError(l.unit_price) !== null);
            if (rateErrLine) {
              errs.lines = getLineRateError(rateErrLine.unit_price)!;
            } else {
              const discErrLine = formData.lines.find(l => getLineDiscountError(l.discount) !== null);
              if (discErrLine) {
                errs.lines = getLineDiscountError(discErrLine.discount)!;
              } else {
                const lineTotErr = formData.lines.find(l => getLineTotalError(l.line_total) !== null);
                if (lineTotErr) {
                  errs.lines = getLineTotalError(lineTotErr.line_total)!;
                } else if (!formData.total_amount || formData.total_amount <= 0) {
                  errs.lines = 'Invoice grand total must be greater than zero (0 is not allowed).';
                } else if (formData.total_amount > MAX_INVOICE_TOTAL) {
                  errs.lines = 'Total invoice amount cannot exceed ₹100 Crore (100,00,00,000).';
                }
              }
            }
          }
        }
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProjectChange = async (e: any) => {
    const projId = Number(e.target.value);
    const proj = projects.find(p => p.id === projId);
    if (fieldErrors.project_id) setFieldErrors(p => ({ ...p, project_id: undefined }));
    await applyProjectQuotation(proj);
  };

  const handleQuotationChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const quoteId = val ? Number(val) : null;
    await applyQuotation(quoteId);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (name === 'issue_date') {
      const newIssueDate = value;
      const minDue = getMinDueDate(newIssueDate);
      setFormData(prev => {
        const shouldUpdateDue = !prev.due_date || prev.due_date <= newIssueDate;
        return {
          ...prev,
          issue_date: newIssueDate,
          due_date: shouldUpdateDue ? minDue : prev.due_date
        };
      });
      if (fieldErrors.issue_date) setFieldErrors(p => ({ ...p, issue_date: undefined }));
      if (fieldErrors.due_date) setFieldErrors(p => ({ ...p, due_date: undefined }));
      return;
    }

    if (type === 'number') {
      const val = value ? Math.max(0, Number(value)) : undefined;
      setFormData(prev => ({ ...prev, [name]: val }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(p => ({ ...p, [name]: undefined }));
    }
  };

  // Integer input handler (Qty, Unit): only digits 0-9 allowed, NO negative, NO symbols, NO float/decimals '.'
  const handleIntegerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'].includes(e.key)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleIntegerPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text').trim();
    if (!/^\d+$/.test(paste)) {
      e.preventDefault();
    }
  };

  // Float input handler (Rate, Tax %, Disc): digits 0-9 and single '.' allowed, NO negative, NO symbols
  const handleFloatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'].includes(e.key)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === '.') {
      if (e.currentTarget.value.includes('.')) {
        e.preventDefault();
      }
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleFloatPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text').trim();
    if (!/^\d*\.?\d*$/.test(paste) || paste === '.') {
      e.preventDefault();
    }
  };

  const handleWheelPrevent = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLElement).blur();
  };

  const handleUpdateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const newLines = [...(formData.lines || [])];
    newLines[index] = { ...newLines[index], [field]: value };
    calculateTotals(newLines as InvoiceLine[]);
    if (fieldErrors.lines) setFieldErrors(p => ({ ...p, lines: undefined }));
  };

  const handleAddLine = () => {
    if ((formData.lines?.length || 0) >= MAX_INVOICE_ITEMS) {
      setFieldErrors(p => ({ ...p, lines: `Maximum ${MAX_INVOICE_ITEMS} items are allowed in an invoice.` }));
      return;
    }
    const newLine: Partial<InvoiceLine> = {
      description: '',
      hsn_sac: 'HSN',
      quantity: 1,
      unit: '1',
      unit_price: 0,
      discount: 0,
      tax_type: 'Exclusive',
      tax_rate: 18,
      taxable_value: 0,
      tax_amount: 0,
      line_total: 0
    };
    calculateTotals([...(formData.lines || []), newLine as InvoiceLine]);
    if (fieldErrors.lines) setFieldErrors(p => ({ ...p, lines: undefined }));
  };

  const handleRemoveLine = (index: number) => {
    const newLines = [...(formData.lines || [])];
    newLines.splice(index, 1);
    calculateTotals(newLines as InvoiceLine[]);
    if (newLines.length <= 500 && fieldErrors.lines === 'Maximum 500 items are allowed in an invoice.') {
      setFieldErrors(p => ({ ...p, lines: undefined }));
    }
  };

  const calculateTotals = (
    lines: Partial<InvoiceLine>[],
    options?: { skipLineRecalcIdx?: number; preserveManualTotal?: boolean }
  ) => {
    let subtotal = 0;
    let totalTax = 0;

    const updatedLines = lines.map((line, idx) => {
      if (options?.skipLineRecalcIdx === idx) {
        subtotal += Number(line.taxable_value) || 0;
        totalTax += Number(line.tax_amount) || 0;
        return line;
      }

      const rawQty = line.quantity;
      const numQty = Number(rawQty);
      const qty = !isNaN(numQty) ? Math.max(0, numQty) : 0;
      const unitVal = parseFloat(String(line.unit || '1'));
      const unitMultiplier = !isNaN(unitVal) && unitVal > 0 ? unitVal : (line.unit === '0' ? 0 : 1);
      const price = Math.max(0, Number(line.unit_price) || 0);
      const gross = qty * unitMultiplier * price;
      // Discount percentage (max 60%)
      const discountPct = Math.min(60, Math.max(0, Number(line.discount) || 0));
      const discountAmount = (gross * discountPct) / 100;
      const taxRate = Math.max(0, Number(line.tax_rate) || 0);
      const isInclusive = line.tax_type === 'Inclusive';

      let taxableValue = 0;
      let taxAmount = 0;
      let lineTotal = 0;

      if (isInclusive) {
        const netGross = Math.max(0, gross - discountAmount);
        lineTotal = netGross;
        taxableValue = Math.round((netGross / (1 + taxRate / 100)) * 100) / 100;
        taxAmount = Math.max(0, Math.round((netGross - taxableValue) * 100) / 100);
      } else {
        taxableValue = Math.max(0, Math.round((gross - discountAmount) * 100) / 100);
        taxAmount = Math.max(0, Math.round(((taxableValue * taxRate) / 100) * 100) / 100);
        lineTotal = Math.max(0, Math.round((taxableValue + taxAmount) * 100) / 100);
      }

      subtotal += taxableValue;
      totalTax += taxAmount;

      return {
        ...line,
        quantity: rawQty as any,
        unit: line.unit !== undefined && line.unit !== null ? String(line.unit) : '1',
        unit_price: price,
        discount: Number(line.discount) || 0,
        tax_type: line.tax_type || 'Exclusive',
        tax_rate: taxRate,
        taxable_value: taxableValue,
        tax_amount: taxAmount,
        line_total: lineTotal
      };
    });

    setFormData(prev => ({
      ...prev,
      lines: updatedLines as InvoiceLine[],
      amount: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(totalTax * 100) / 100,
      total_amount: options?.preserveManualTotal && prev.total_amount !== undefined
        ? prev.total_amount
        : Math.round((subtotal + totalTax) * 100) / 100
    }));
  };

  const handleUpdateLineTotal = (index: number, rawVal: string) => {
    let val = rawVal.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    const newLines = [...(formData.lines || [])];
    const targetLine = { ...newLines[index] };

    if (val === '') {
      targetLine.line_total = '' as any;
      targetLine.unit_price = 0;
      targetLine.taxable_value = 0;
      targetLine.tax_amount = 0;
      newLines[index] = targetLine;
      calculateTotals(newLines as InvoiceLine[], { skipLineRecalcIdx: index });
      return;
    }

    const enteredTotal = parseFloat(val);
    if (isNaN(enteredTotal)) return;

    const isInclusive = targetLine.tax_type === 'Inclusive';
    const taxRate = Math.max(0, Number(targetLine.tax_rate) || 0);
    const rawQty = targetLine.quantity;
    const numQty = Number(rawQty);
    const qty = !isNaN(numQty) && numQty > 0 ? numQty : 1;
    const unitVal = parseFloat(String(targetLine.unit || '1'));
    const unitMultiplier = !isNaN(unitVal) && unitVal > 0 ? unitVal : 1;
    const discountPct = Math.min(60, Math.max(0, Number(targetLine.discount) || 0));
    const effectiveDiscountFactor = (100 - discountPct) / 100 > 0 ? (100 - discountPct) / 100 : 1;

    let taxableVal = 0;
    let taxAmt = 0;
    let calculatedRate = 0;

    if (isInclusive) {
      taxableVal = Math.round((enteredTotal / (1 + taxRate / 100)) * 100) / 100;
      taxAmt = Math.max(0, Math.round((enteredTotal - taxableVal) * 100) / 100);
      calculatedRate = Math.round((enteredTotal / (qty * unitMultiplier * effectiveDiscountFactor)) * 100) / 100;
    } else {
      taxableVal = Math.round((enteredTotal / (1 + taxRate / 100)) * 100) / 100;
      taxAmt = Math.max(0, Math.round((enteredTotal - taxableVal) * 100) / 100);
      calculatedRate = Math.round((taxableVal / (qty * unitMultiplier * effectiveDiscountFactor)) * 100) / 100;
    }

    targetLine.line_total = val.endsWith('.') ? (val as any) : enteredTotal;
    targetLine.unit_price = calculatedRate;
    targetLine.taxable_value = taxableVal;
    targetLine.tax_amount = taxAmt;
    newLines[index] = targetLine;

    calculateTotals(newLines as InvoiceLine[], { skipLineRecalcIdx: index });
    if (fieldErrors.lines) setFieldErrors(p => ({ ...p, lines: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!validateForm()) {
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Invoice Changes',
        description: `Are you sure you want to save the updated changes for invoice "${invoice?.reference || ''}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        ...formData,
        notes: formatNotesToPlainText(formData.notes) || '',
        bank_account_id: selectedBankAccountId || null,
        amount: Math.round((Number(formData.amount) || 0) * 100),
        tax_amount: Math.round((Number(formData.tax_amount) || 0) * 100),
        total_amount: Math.round((Number(formData.total_amount) || 0) * 100),
        lines: formData.lines?.map(l => ({
          ...l,
          unit_price: Math.round((Number(l.unit_price) || 0) * 100),
          discount: Number(l.discount || 0),
          tax_type: l.tax_type || 'Exclusive',
          taxable_value: Math.round((Number(l.taxable_value) || 0) * 100),
          tax_amount: Math.round((Number(l.tax_amount) || 0) * 100),
          line_total: Math.round((Number(l.line_total) || 0) * 100)
        }))
      };

      let res;
      if (isEditing && id) {
        res = await window.desktop.invoices.update({
          ...(payload as UpdateInvoiceDto),
          id: Number(id),
          bank_account_id: selectedBankAccountId || null
        });
        if (res.success && selectedBankAccountId) {
          setInvoiceBankAccountId(id, selectedBankAccountId);
          setInvoiceBankAccountId(Number(id), selectedBankAccountId);
          setOriginalBankAccountId(selectedBankAccountId);
        }
      } else {
        res = await window.desktop.invoices.create({
          ...(payload as CreateInvoiceDto),
          bank_account_id: selectedBankAccountId || null
        });
        if (res.success && res.data?.id && selectedBankAccountId) {
          setInvoiceBankAccountId(res.data.id, selectedBankAccountId);
          setInvoiceBankAccountId(String(res.data.id), selectedBankAccountId);
        }
      }

      if (res.success) {
        navigate('/invoices');
      } else {
        setError(res.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !id) return;
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Invoice',
      description: `Are you sure you want to permanently delete invoice "${invoice?.reference || ''}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.invoices.delete(Number(id));
      if (res.success) {
        navigate('/invoices');
      } else {
        setError(res.error?.message || 'Failed to delete invoice');
        await showAlert({
          type: 'error',
          title: 'Cannot Delete Invoice',
          description: res.error?.message || 'Failed to delete invoice. It may have associated payments.'
        });
      }
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-12">
      <PageHeader
        title={isEditing ? `Invoice ${invoice?.reference || ''}` : "New Invoice"}
        breadcrumbs={[{ label: 'Invoices', to: '/invoices' }, { label: isEditing ? 'Edit' : 'New' }]}
        action={isEditing ? (
          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={handleDelete} className="shadow-sm">Delete</Button>
            <Button variant="primary" onClick={() => navigate('/payments/new', { state: { invoiceId: invoice?.id } })}>+ Log Payment</Button>
          </div>
        ) : undefined}
      />

      <Card>
        {isEditing && invoice && (
          <div className="mb-6 p-4 rounded-lg bg-secondary-bg border border-border-color grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs uppercase text-secondary font-semibold">Total Invoiced</div>
              <div className="text-xl font-bold text-primary-color">{formatCurrency(invoice.total_amount / 100)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-secondary font-semibold">Amount Paid</div>
              <div className="text-xl font-bold text-success-color">{formatCurrency((invoice.amount_paid || 0) / 100)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-secondary font-semibold">Balance Due</div>
              <div className={`text-xl font-bold ${(invoice.total_amount - (invoice.amount_paid || 0)) > 0 ? 'text-danger' : 'text-success-color'}`}>
                {formatCurrency(Math.max(0, (invoice.total_amount - (invoice.amount_paid || 0)) / 100))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-secondary font-semibold">Status / Type</div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <Badge variant={
                  formData.status === 'Paid' ? 'success' :
                    (formData.status === 'Partial' || formData.status === 'Partially Paid' || formData.status === 'Pending') ? 'warning' :
                      'info'
                }>
                  {formData.status}
                </Badge>
                <Badge variant="default">
                  {formData.invoice_type || 'Tax Invoice'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {error && <Alert type="error" message={error} className="mb-4" />}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Select Project <span className="text-danger">*</span>
              </label>
              <select
                name="project_id"
                value={formData.project_id || 0}
                onChange={handleProjectChange}
                disabled={isEditing}
                className={`input-field ${fieldErrors.project_id ? 'input-error' : ''} ${isEditing ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                required
              >
                <option value={0} disabled>Select Project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.reference} - {p.customerName}</option>)}
              </select>
              {fieldErrors.project_id && <span className="form-error">{fieldErrors.project_id}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Quotation Number (Optional)
              </label>
              <select
                name="quotation_id"
                value={formData.quotation_id || ''}
                onChange={handleQuotationChange}
                disabled={isEditing}
                className={`input-field ${isEditing ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
              >
                <option value="">None / Manual Items</option>
                {quotations.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.reference} {q.customer_name ? `- ${q.customer_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Invoice Type <span className="text-danger">*</span>
              </label>
              <select
                name="invoice_type"
                value={formData.invoice_type || 'Tax Invoice'}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Advance Receipt">Advance Receipt</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
                <option value="Invoice">Invoice</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Status <span className="text-danger">*</span>
              </label>
              <select name="status" value={formData.status} onChange={handleChange} className="input-field" required>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Issue Date <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="issue_date"
                value={formData.issue_date || ''}
                onChange={handleChange}
                min={isEditing && originalData?.issue_date ? originalData.issue_date : getTodayStr()}
                className={`input-field ${fieldErrors.issue_date ? 'input-error' : ''}`}
                required
              />
              {fieldErrors.issue_date && <span className="form-error">{fieldErrors.issue_date}</span>}
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                📅 {isEditing && originalData?.issue_date ? `Allows original date (${originalData.issue_date}) or later.` : 'Allows today or future dates only.'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Due Date <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date || ''}
                onChange={handleChange}
                min={getMinDueDate(formData.issue_date)}
                className={`input-field ${fieldErrors.due_date ? 'input-error' : ''}`}
                required
              />
              {fieldErrors.due_date && <span className="form-error">{fieldErrors.due_date}</span>}
            </div>
          </div>

          {/* Payment Collection Bank Account Selection */}
          <div className="pt-4 border-t border-border-color">
            <div className="mb-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Landmark size={17} style={{ color: 'var(--primary-color)' }} />
                <span>Payment Collection Bank Account</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  Linked to Documents
                </span>
              </label>
              <p className="text-xs text-secondary m-0 mt-0.5">
                Select which company bank account will be linked to this invoice. When downloaded as PDF in the Document Center, these credentials will be printed automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-secondary">
                  Choose Bank Account <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  className="input-field font-medium"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} (•••• {acc.accountNumber.slice(-4)}) {acc.isPrimary ? '★ Primary' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBankAccount && (
                <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      {selectedBankAccount.bankName}
                      {selectedBankAccount.isPrimary && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          PRIMARY DEFAULT
                        </span>
                      )}
                    </span>
                    <span className="text-slate-500 font-medium">{selectedBankAccount.accountType} Account</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Account Holder</span>
                      <span className="font-medium text-slate-700 block">{selectedBankAccount.accountName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Account Number</span>
                      <span className="font-mono font-bold text-blue-700 block">{selectedBankAccount.accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">IFSC Code</span>
                      <span className="font-mono font-bold text-slate-700 block">{selectedBankAccount.ifscCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Branch</span>
                      <span className="font-medium text-slate-700 block">{selectedBankAccount.branchName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">UPI ID</span>
                      <span className="font-mono text-slate-700 block">{selectedBankAccount.upiId || 'Not linked'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border-color">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-medium m-0">
                  Line Items <span className="text-danger">*</span>
                </h3>
                {isLoadingQuotation && (
                  <span
                    className="text-xs bg-blue-100 text-blue-800 font-medium rounded-full animate-pulse inline-flex items-center"
                    style={{
                      padding: '4px 14px',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.25'
                    }}
                  >
                    Loading quotation items...
                  </span>
                )}
                {linkedQuotationRef && !isLoadingQuotation && (
                  <span
                    className="text-xs bg-emerald-50 text-emerald-800 font-semibold rounded-full border border-emerald-300 inline-flex items-center"
                    style={{
                      padding: '4px 14px',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.25',
                      gap: '6px'
                    }}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 inline-block" />
                    <span>Auto-filled from Quotation: {linkedQuotationRef}</span>
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddLine}
                disabled={(formData.lines?.length || 0) >= MAX_INVOICE_ITEMS}
                title={(formData.lines?.length || 0) >= MAX_INVOICE_ITEMS ? `Maximum ${MAX_INVOICE_ITEMS} items are allowed in an invoice.` : undefined}
              >
                + Add Line Item
              </Button>
            </div>
            {linkedQuotationRef && formData.lines && formData.lines.length > 0 && (
              <div className="mb-3 text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded px-3 py-1.5 flex items-center justify-between">
                <span>
                  ✓ Quotation items and rates have been loaded automatically. You can edit quantities, rates, discounts, or click <strong>+ Add Line Item</strong> to add extra items.
                </span>
              </div>
            )}
            {fieldErrors.lines && <div className="form-error mb-3">{fieldErrors.lines}</div>}

            <div className="flex flex-col gap-4">
              {formData.lines?.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-secondary font-medium">
                  No line items added yet. Click &quot;+ Add Line Item&quot; to begin.
                </div>
              ) : (
                formData.lines?.map((line, idx) => {
                  const qtyError = submitAttempted ? getLineQuantityError(line.quantity) : null;
                  const unitError = submitAttempted ? getLineUnitError(line.unit) : null;
                  const rateError = submitAttempted ? getLineRateError(line.unit_price) : null;
                  const discError = submitAttempted ? getLineDiscountError(line.discount) : null;
                  const totalError = submitAttempted ? getLineTotalError(line.line_total) : null;

                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-4 hover:border-slate-300 transition-colors"
                    >
                      {/* Item Header: Item number & Total & Delete */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center border border-emerald-200">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800 text-sm">Line Item #{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                            <span className="text-slate-500 font-medium mr-1.5 text-xs uppercase tracking-wide">Item Total:</span>
                            <span className={`font-bold ${totalError ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatCurrency(line.line_total || 0)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Remove this line item"
                          >
                            <span className="text-base leading-none">&times;</span> Remove
                          </button>
                        </div>
                      </div>

                      {/* Row 1: 2 fields (Description & HSN/SAC) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={line.description || ''}
                            placeholder="Enter item description or solar product/service details..."
                            onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                            className="input-field"
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">HSN / SAC</label>
                          <input
                            type="text"
                            value={line.hsn_sac || ''}
                            placeholder="e.g. 8541"
                            onChange={e => handleUpdateLine(idx, 'hsn_sac', e.target.value)}
                            className="input-field"
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                        </div>
                      </div>

                      {/* Row 2: 3 fields (Qty, Unit, Rate) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Quantity (Qty) <span className="text-red-500">*</span>
                            <span className="text-[11px] text-slate-400 font-normal ml-1">(Max 500)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="1"
                            value={line.quantity ?? ''}
                            title={qtyError || undefined}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              if (val === '') {
                                handleUpdateLine(idx, 'quantity', '' as any);
                                return;
                              }
                              const num = parseInt(val, 10);
                              handleUpdateLine(idx, 'quantity', isNaN(num) ? ('' as any) : num);
                            }}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleIntegerKeyDown}
                            onPaste={handleIntegerPaste}
                            className={`input-field font-semibold ${qtyError ? 'input-error border-red-500 bg-red-50' : ''}`}
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                          {qtyError && <span className="text-xs text-red-600 font-medium">{qtyError}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Unit <span className="text-red-500">*</span>
                            <span className="text-[11px] text-slate-400 font-normal ml-1">(Max 99,999)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={line.unit ?? '1'}
                            placeholder="1"
                            title={unitError || undefined}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              handleUpdateLine(idx, 'unit', val);
                            }}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleIntegerKeyDown}
                            onPaste={handleIntegerPaste}
                            className={`input-field font-semibold ${unitError ? 'input-error border-red-500 bg-red-50' : ''}`}
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                          {unitError && <span className="text-xs text-red-600 font-medium">{unitError}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Rate (₹) <span className="text-red-500">*</span>
                            <span className="text-[11px] text-slate-400 font-normal ml-1">(Max ₹10 Cr)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={line.unit_price === 0 ? '' : (line.unit_price ?? '')}
                            title={rateError || undefined}
                            onChange={e => {
                              let val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) {
                                val = `${parts[0]}.${parts.slice(1).join('')}`;
                              }
                              if (val === '') {
                                handleUpdateLine(idx, 'unit_price', 0);
                                return;
                              }
                              const num = parseFloat(val);
                              if (!isNaN(num)) {
                                handleUpdateLine(idx, 'unit_price', num);
                              }
                            }}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleFloatKeyDown}
                            onPaste={handleFloatPaste}
                            className={`input-field font-semibold ${rateError ? 'input-error border-red-500 bg-red-50' : ''}`}
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                          {rateError && <span className="text-xs text-red-600 font-medium">{rateError}</span>}
                        </div>
                      </div>

                      {/* Row 3: 4 fields (Disc %, Tax Type [Exclusive/Inclusive], Tax %, Line Total Incl. Tax [editable]) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Discount (%)
                            <span className="text-[11px] text-slate-400 font-normal ml-1">(Max 60%)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={line.discount === 0 ? '' : (line.discount ?? '')}
                            title={discError || undefined}
                            onChange={e => {
                              let val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) {
                                val = `${parts[0]}.${parts.slice(1).join('')}`;
                              }
                              if (val === '') {
                                handleUpdateLine(idx, 'discount', 0);
                                return;
                              }
                              const num = parseFloat(val);
                              if (!isNaN(num) && num >= 0) {
                                handleUpdateLine(idx, 'discount', num);
                              }
                            }}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleFloatKeyDown}
                            onPaste={handleFloatPaste}
                            className={`input-field font-semibold ${discError ? 'input-error border-red-500 bg-red-50' : ''}`}
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                          {discError && <span className="text-xs text-red-600 font-medium">{discError}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Tax Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={line.tax_type || 'Exclusive'}
                            onChange={e => handleUpdateLine(idx, 'tax_type', e.target.value as 'Exclusive' | 'Inclusive')}
                            className="input-field font-semibold bg-white cursor-pointer"
                            style={{ height: '42px', fontSize: '14px' }}
                          >
                            <option value="Exclusive">Exclusive</option>
                            <option value="Inclusive">Inclusive</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">Tax Rate (GST %)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="18"
                            value={line.tax_rate === 0 ? '' : (line.tax_rate ?? '')}
                            onChange={e => {
                              let val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) {
                                val = `${parts[0]}.${parts.slice(1).join('')}`;
                              }
                              if (val === '') {
                                handleUpdateLine(idx, 'tax_rate', 0);
                                return;
                              }
                              const num = parseFloat(val);
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                handleUpdateLine(idx, 'tax_rate', num);
                              }
                            }}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleFloatKeyDown}
                            onPaste={handleFloatPaste}
                            className="input-field font-semibold"
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">Total (Tax.incl)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={line.line_total === 0 ? '' : (line.line_total ?? '')}
                            title={totalError || undefined}
                            onChange={e => handleUpdateLineTotal(idx, e.target.value)}
                            onWheel={handleWheelPrevent}
                            onKeyDown={handleFloatKeyDown}
                            onPaste={handleFloatPaste}
                            className={`input-field font-bold text-emerald-700 ${totalError ? 'input-error border-red-500 bg-red-50 text-red-600' : ''}`}
                            style={{ height: '42px', fontSize: '14px' }}
                          />
                          {totalError && <span className="text-xs text-red-600 font-medium">{totalError}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">Notes / Terms</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleChange} className="input-field min-h-[120px]" placeholder="Terms and conditions..."></textarea>
            </div>

            <div className="bg-secondary-bg p-6 rounded-md border border-border-color">
              <div className="flex justify-between mb-2 text-sm text-secondary">
                <span>Taxable Amount</span>
                <span>{formatCurrency(formData.amount || 0)}</span>
              </div>
              <div className="flex justify-between mb-4 text-sm text-secondary">
                <span>Total Tax</span>
                <span>{formatCurrency(formData.tax_amount || 0)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border-color pt-4 font-bold text-lg text-primary-color">
                <span>Grand Total</span>
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={formData.total_amount === 0 ? '' : (formData.total_amount ?? '')}
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) {
                        val = `${parts[0]}.${parts.slice(1).join('')}`;
                      }
                      if (val === '') {
                        setFormData(prev => ({ ...prev, total_amount: '' as any }));
                        return;
                      }
                      const num = parseFloat(val);
                      if (!isNaN(num)) {
                        setFormData(prev => ({
                          ...prev,
                          total_amount: val.endsWith('.') ? (val as any) : num
                        }));
                      }
                    }}
                    onWheel={handleWheelPrevent}
                    onKeyDown={handleFloatKeyDown}
                    onPaste={handleFloatPaste}
                    className={`input-field font-bold pl-7 text-right text-base text-primary-color ${formData.total_amount !== undefined && Number(formData.total_amount) > MAX_INVOICE_TOTAL ? 'border-red-500 bg-red-50 text-red-600' : ''}`}
                    style={{ height: '40px' }}
                  />
                </div>
              </div>
              {formData.total_amount !== undefined &&
                formData.lines && formData.lines.length > 0 &&
                Math.abs(Number(formData.total_amount) - ((Number(formData.amount) || 0) + (Number(formData.tax_amount) || 0))) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, total_amount: Math.round(((Number(prev.amount) || 0) + (Number(prev.tax_amount) || 0)) * 100) / 100 }))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 underline block text-right mt-1 cursor-pointer"
                  >
                    Reset to calculated total ({formatCurrency((Number(formData.amount) || 0) + (Number(formData.tax_amount) || 0))})
                  </button>
              )}
              {submitAttempted && formData.total_amount !== undefined && Number(formData.total_amount) > MAX_INVOICE_TOTAL && (
                <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', textAlign: 'right', fontWeight: 600 }}>
                  Grand total exceeds ₹100 Crore limit.
                </div>
              )}
              {isEditing && invoice && (
                <>
                  <div className="flex justify-between border-t border-border-color pt-3 mt-3 text-sm">
                    <span className="text-secondary font-semibold">Amount Paid</span>
                    <span className="font-bold text-success-color">{formatCurrency((invoice.amount_paid || 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-base font-bold">
                    <span>Balance Due</span>
                    <span className={(Number(formData.total_amount || 0) - ((invoice.amount_paid || 0) / 100)) > 0 ? "text-danger" : "text-success-color"}>
                      {formatCurrency(Math.max(0, Number(formData.total_amount || 0) - ((invoice.amount_paid || 0) / 100)))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t flex-wrap">
            <Button variant="secondary" type="button" onClick={() => navigate('/invoices')}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving || !isChanged}
              title={!isChanged ? (isEditing ? 'Make changes to save' : 'Select a project and add line items to save') : undefined}
            >
              {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save Invoice')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
