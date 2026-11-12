import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import type { Customer } from '@shared/types/customer.types';
import type { InstallationSite } from '@shared/types/installation-site.types';
import type { CreateProjectDto } from '@shared/types/project.types';
import type { Quotation } from '@shared/types/quotation.types';

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('customerId');
  const { showConfirm } = useAlert();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<InstallationSite[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isQuotationDropdownOpen, setIsQuotationDropdownOpen] = useState(false);
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const quotationComboboxRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<CreateProjectDto>>({
    reference: '',
    customer_id: queryCustomerId ? Number(queryCustomerId) : 0,
    site_id: 0,
    quotation_ref: '',
    target_date: '',
    stage: 'In Progress',
    payment_status: 'Pending',
  });
  const [originalData, setOriginalData] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [initialRejectReason, setInitialRejectReason] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quotationComboboxRef.current && !quotationComboboxRef.current.contains(e.target as Node)) {
        setIsQuotationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      setLoading(true);
      try {
        const [custRes, quoRes] = await Promise.all([
          window.desktop.customers.list(),
          window.desktop.quotations.list()
        ]);
        const loadedCusts: Customer[] = custRes.success && Array.isArray(custRes.data) ? custRes.data : [];
        const loadedQuotes: Quotation[] = quoRes.success && Array.isArray(quoRes.data) ? quoRes.data : [];

        if (!isMounted) return;
        setCustomers(loadedCusts);
        setQuotations(loadedQuotes);

        if (isEditing && id) {
          const res = await window.desktop.projects.get(Number(id));
          if (!isMounted) return;
          if (res.success) {
            const initial = {
              reference: res.data.reference || '',
              customer_id: res.data.customer_id,
              site_id: res.data.site_id,
              quotation_ref: res.data.quotation_ref || '',
              target_date: res.data.target_date || '',
              stage: res.data.stage,
              payment_status: res.data.payment_status,
            };
            setFormData(initial);
            setOriginalData(initial);
            if (initial.stage === 'Reject') {
              const reason = localStorage.getItem(`project_reject_reason_${id}`) || '';
              setRejectReason(reason);
              setInitialRejectReason(reason);
            } else {
              setRejectReason('');
              setInitialRejectReason('');
            }
            await loadSitesForCustomer(
              res.data.customer_id,
              loadedCusts,
              loadedQuotes,
              res.data.site_id,
              res.data.siteName
            );
          } else {
            setError(res.error?.message || 'Failed to load project');
          }
        } else if (!isEditing && queryCustomerId) {
          const cId = Number(queryCustomerId);
          setFormData(prev => ({ ...prev, customer_id: cId }));
          await loadSitesForCustomer(cId, loadedCusts, loadedQuotes);
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [id, isEditing, queryCustomerId]);

  const isChanged = useMemo(() => {
    if (!isEditing) {
      return Boolean(
        formData.customer_id ||
        formData.target_date ||
        (formData.stage && formData.stage !== 'In Progress')
      );
    }
    if (!originalData) return false;

    const hasStageChanged = (formData.stage || 'In Progress') !== (originalData.stage || 'In Progress');
    const hasRejectReasonChanged =
      formData.stage === 'Reject' && rejectReason.trim() !== initialRejectReason.trim();

    return (
      (formData.reference || '') !== (originalData.reference || '') ||
      Number(formData.customer_id ?? 0) !== Number(originalData.customer_id ?? 0) ||
      Number(formData.site_id ?? 0) !== Number(originalData.site_id ?? 0) ||
      (formData.quotation_ref || '') !== (originalData.quotation_ref || '') ||
      (formData.target_date || '') !== (originalData.target_date || '') ||
      hasStageChanged ||
      hasRejectReasonChanged
    );
  }, [isEditing, originalData, formData, rejectReason, initialRejectReason]);

  const loadSitesForCustomer = async (
    customerId: number,
    custList?: Customer[],
    quoteList?: Quotation[],
    fallbackSiteId?: number,
    fallbackSiteName?: string
  ): Promise<any[]> => {
    try {
      const custSource = custList && custList.length > 0 ? custList : customers;
      const quoteSource = quoteList && quoteList.length > 0 ? quoteList : quotations;
      const selectedCust = custSource.find(c => c.id === customerId);
      const targetName = selectedCust?.name?.trim().toLowerCase();
      const matchingCusts = targetName
        ? custSource.filter(c => c.name && c.name.trim().toLowerCase() === targetName)
        : [selectedCust].filter(Boolean);

      const allSites: any[] = [];
      const seenSiteIds = new Set<number>();
      const seenAddresses = new Set<string>();

      await Promise.all(
        matchingCusts.map(async (cust) => {
          if (!cust) return;
          try {
            const res = await window.desktop.installationSites.listByCustomer(cust.id);
            if (res.success && Array.isArray(res.data)) {
              for (const s of res.data) {
                const addrKey = `${s.address?.trim().toLowerCase()}_${s.city?.trim().toLowerCase()}`;
                if (!seenSiteIds.has(s.id) && !seenAddresses.has(addrKey)) {
                  seenSiteIds.add(s.id);
                  seenAddresses.add(addrKey);
                  allSites.push({ ...s, customer_id: cust.id });
                }
              }
            }
          } catch (err) {
            console.error(err);
          }
        })
      );

      // If customer has direct customerId but was not caught in matchingCusts
      if (customerId && !allSites.some(s => s.customer_id === customerId)) {
        try {
          const res = await window.desktop.installationSites.listByCustomer(customerId);
          if (res.success && Array.isArray(res.data)) {
            for (const s of res.data) {
              const addrKey = `${s.address?.trim().toLowerCase()}_${s.city?.trim().toLowerCase()}`;
              if (!seenSiteIds.has(s.id) && !seenAddresses.has(addrKey)) {
                seenSiteIds.add(s.id);
                seenAddresses.add(addrKey);
                allSites.push({ ...s, customer_id: customerId });
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      // Also check if any quotation for this customer has a site that wasn't in installation_sites table
      const matchingCustIds = matchingCusts.map(c => c?.id).filter(Boolean);
      for (const q of quoteSource) {
        const qName = (q.customerName || (q as any).manual_customer_name || '').trim().toLowerCase();
        const matches = (targetName && qName === targetName) || (q.customer_id && matchingCustIds.includes(q.customer_id));
        if (matches && q.site_id && !seenSiteIds.has(q.site_id)) {
          seenSiteIds.add(q.site_id);
          allSites.push({
            id: q.site_id,
            customerId: q.customer_id || customerId,
            customer_id: q.customer_id || customerId,
            address: q.siteAddress || 'Site Address',
            city: '',
          } as any);
        }
      }

      // Ensure the project's existing site is ALWAYS present in the options (for edit mode)
      if (fallbackSiteId && !seenSiteIds.has(fallbackSiteId)) {
        seenSiteIds.add(fallbackSiteId);
        allSites.unshift({
          id: fallbackSiteId,
          customerId,
          customer_id: customerId,
          address: fallbackSiteName || 'Installation Site',
          city: '',
        } as any);
      }

      setSites(allSites);
      return allSites;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const [fieldErrors, setFieldErrors] = useState<{ reference?: string; customer_id?: string; site_id?: string; target_date?: string; reject_reason?: string }>({});

  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    if (!formData.customer_id || formData.customer_id <= 0) {
      errs.customer_id = 'Please select a customer.';
    }

    if (!formData.site_id || formData.site_id <= 0) {
      errs.site_id = 'Please select an installation site.';
    }

    if (formData.target_date) {
      const minAllowed = isEditing && originalData?.target_date ? originalData.target_date : todayStr;
      if (formData.target_date < minAllowed) {
        errs.target_date = isEditing
          ? `Date cannot be earlier than the original date (${originalData.target_date}).`
          : 'Date cannot be in the past. Please select today or a future date.';
      }
    }

    if (formData.stage === 'Reject' && !rejectReason.trim()) {
      errs.reject_reason = 'Please enter a reason for rejection.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCustomerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = Number(e.target.value);
    setFormData(prev => ({ ...prev, customer_id: customerId, site_id: 0, quotation_ref: '' }));
    if (fieldErrors.customer_id) setFieldErrors(p => ({ ...p, customer_id: undefined }));
    if (customerId) {
      const loadedSites = await loadSitesForCustomer(customerId);
      const selectedCust = customers.find(c => c.id === customerId);
      const targetName = selectedCust?.name?.trim().toLowerCase();

      // If only 1 site exists, auto-select it and its matching quotation!
      const matchingCustIds = targetName
        ? customers.filter(c => c.name && c.name.trim().toLowerCase() === targetName).map(c => c.id)
        : [customerId];

      if (loadedSites && loadedSites.length === 1) {
        const onlySite = loadedSites[0];
        const custQuotes = quotations.filter(q => {
          const qName = (q.customerName || (q as any).manual_customer_name || '').trim().toLowerCase();
          return (targetName && qName === targetName) || (q.customer_id && matchingCustIds.includes(q.customer_id));
        });

        let matchedQuote = custQuotes.find(q => {
          if (onlySite.id && q.site_id === onlySite.id) return true;
          if (onlySite.address && q.siteAddress) {
            const qAddr = q.siteAddress.toLowerCase().trim();
            const sAddr = onlySite.address.toLowerCase().trim();
            if (qAddr && sAddr && (qAddr.includes(sAddr) || sAddr.includes(qAddr))) return true;
          }
          return false;
        });

        if (!matchedQuote && custQuotes.length === 1) {
          matchedQuote = custQuotes[0];
        }

        setFormData(prev => ({
          ...prev,
          site_id: onlySite.id,
          quotation_ref: matchedQuote ? matchedQuote.reference : ''
        }));
      }
    } else {
      setSites([]);
    }
  };

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = Number(e.target.value);
    const selectedSite = sites.find(s => s.id === siteId);

    const selectedCust = customers.find(c => c.id === formData.customer_id);
    const targetName = selectedCust?.name?.trim().toLowerCase();
    const matchingCustIds = targetName
      ? customers.filter(c => c.name && c.name.trim().toLowerCase() === targetName).map(c => c.id)
      : (formData.customer_id ? [formData.customer_id] : []);

    const custQuotes = quotations.filter(q => {
      const qName = (q.customerName || (q as any).manual_customer_name || '').trim().toLowerCase();
      return (targetName && qName === targetName) || (q.customer_id && matchingCustIds.includes(q.customer_id));
    });

    // Auto-select quotation reference based on selected site / address
    let matchedQuote = custQuotes.find(q => {
      if (siteId && q.site_id === siteId) return true;
      if (selectedSite && q.siteAddress && selectedSite.address) {
        const qAddr = q.siteAddress.toLowerCase().trim();
        const sAddr = selectedSite.address.toLowerCase().trim();
        if (qAddr && sAddr && (qAddr.includes(sAddr) || sAddr.includes(qAddr))) return true;
      }
      return false;
    });

    // If no quote matched the specific site, but this customer has only 1 quotation in total, use that
    if (!matchedQuote && custQuotes.length === 1) {
      matchedQuote = custQuotes[0];
    }

    setFormData(prev => ({
      ...prev,
      site_id: siteId,
      quotation_ref: matchedQuote ? matchedQuote.reference : '',
      customer_id: (selectedSite && ((selectedSite as any).customer_id || selectedSite.customerId) && ((selectedSite as any).customer_id || selectedSite.customerId) !== prev.customer_id)
        ? ((selectedSite as any).customer_id || selectedSite.customerId)
        : prev.customer_id
    }));

    if (fieldErrors.site_id) {
      setFieldErrors(p => ({ ...p, site_id: undefined }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(p => ({ ...p, [name]: undefined }));
    }
  };

  const filteredQuotations = useMemo(() => {
    const q = quotationSearchQuery.toLowerCase().trim();
    let list = [...quotations];

    // Filter to ONLY show quotations belonging to the selected customer name
    if (formData.customer_id) {
      const selectedCust = customers.find(c => c.id === formData.customer_id);
      const targetName = selectedCust?.name?.trim().toLowerCase();
      const matchingCustIds = targetName
        ? customers.filter(c => c.name && c.name.trim().toLowerCase() === targetName).map(c => c.id)
        : [formData.customer_id];

      list = list.filter(item => {
        const itemCustId = item.customer_id;
        const itemName = (item.customerName || (item as any).manual_customer_name || '').trim().toLowerCase();
        const matchesId = itemCustId && matchingCustIds.includes(itemCustId);
        const matchesName = targetName && itemName === targetName;
        return matchesId || matchesName;
      });

      // Sort matching site's quotation to the very top
      if (formData.site_id) {
        list.sort((a, b) => {
          const aMatch = a.site_id === formData.site_id ? 1 : 0;
          const bMatch = b.site_id === formData.site_id ? 1 : 0;
          return bMatch - aMatch;
        });
      }
    }

    if (q) {
      list = list.filter(item => 
        (item.reference && item.reference.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        ((item as any).manual_customer_name && (item as any).manual_customer_name.toLowerCase().includes(q)) ||
        (item.siteAddress && item.siteAddress.toLowerCase().includes(q))
      );
    }
    return list;
  }, [quotations, quotationSearchQuery, formData.customer_id, formData.site_id, customers]);

  const handleSelectQuotation = (quote: Quotation) => {
    setFormData(prev => {
      const updated: any = { ...prev, quotation_ref: quote.reference };
      // If customer is not yet selected and quotation has a customer_id, auto-select customer and load sites
      if (!prev.customer_id && quote.customer_id) {
        updated.customer_id = quote.customer_id;
        loadSitesForCustomer(quote.customer_id);
      }
      if ((!prev.site_id || prev.site_id === 0) && quote.site_id) {
        updated.site_id = quote.site_id;
      }
      return updated;
    });
    setIsQuotationDropdownOpen(false);
    setQuotationSearchQuery('');
  };

  const handleClearQuotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, quotation_ref: '' }));
    setQuotationSearchQuery('');
    setIsQuotationDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Project Changes',
        description: `Are you sure you want to save the updated changes for project "${formData.reference || ''}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      let res;
      const payload = {
        ...formData,
        customer_id: Number(formData.customer_id),
        site_id: Number(formData.site_id),
        stage: formData.stage || 'In Progress',
      };
      if (isEditing && id) {
        res = await window.desktop.projects.update({ id: Number(id), ...payload });
      } else {
        res = await window.desktop.projects.create(payload as CreateProjectDto);
      }

      if (res.success) {
        const projectIdToUse = id || res.data?.id;
        if (projectIdToUse) {
          if (formData.stage === 'Reject') {
            localStorage.setItem(`project_reject_reason_${projectIdToUse}`, rejectReason);
          } else {
            localStorage.removeItem(`project_reject_reason_${projectIdToUse}`);
          }
        }
        navigate('/projects');
      } else {
        setError(res.error?.message || 'Failed to save project');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader 
        title={isEditing ? "Edit Project" : "New Project"} 
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: isEditing ? 'Edit' : 'New' }]}
      />

      <Card>
        {error && <Alert type="error" message={error} className="mb-4" />}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group">
            <label>
              Project Number
            </label>
            <input 
              readOnly
              disabled
              name="reference"
              value={isEditing ? (formData.reference || '') : 'Auto-generated upon save (e.g. PRJ202601)'}
              className="input-field bg-slate-50 cursor-not-allowed text-secondary"
            />
          </div>

          <div className="form-group">
            <label>
              Customer <span className="text-danger">*</span>
            </label>
            <select 
              required
              name="customer_id"
              value={formData.customer_id || 0}
              onChange={handleCustomerChange}
              className={`input-field ${fieldErrors.customer_id ? 'input-error' : ''}`}
            >
              <option value={0} disabled>Select Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` (${c.phone})` : (c.city ? ` (${c.city})` : '')}
                </option>
              ))}
            </select>
            {fieldErrors.customer_id && <span className="form-error">{fieldErrors.customer_id}</span>}
          </div>

          <div className="form-group">
            <label>
              Installation Site <span className="text-danger">*</span>
            </label>
            <select 
              required
              name="site_id"
              value={formData.site_id || 0}
              onChange={handleSiteChange}
              className={`input-field ${fieldErrors.site_id ? 'input-error' : ''}`}
              disabled={!formData.customer_id}
            >
              <option value={0} disabled>Select Site</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.address}{s.city ? `, ${s.city}` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.site_id && <span className="form-error">{fieldErrors.site_id}</span>}
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ position: 'relative' }} ref={quotationComboboxRef}>
              <label>Quotation Reference</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type="text"
                  name="quotation_ref"
                  placeholder="Click to select quotation..."
                  value={isQuotationDropdownOpen ? quotationSearchQuery : (formData.quotation_ref || '')}
                  onChange={e => {
                    setQuotationSearchQuery(e.target.value);
                    if (!isQuotationDropdownOpen) setIsQuotationDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setIsQuotationDropdownOpen(true);
                    setQuotationSearchQuery('');
                  }}
                  onClick={() => setIsQuotationDropdownOpen(true)}
                  className="input-field"
                  style={{ width: '100%', paddingRight: formData.quotation_ref ? '56px' : '32px', cursor: 'pointer' }}
                  autoComplete="off"
                />
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 3 }}>
                  {formData.quotation_ref ? (
                    <button
                      type="button"
                      onClick={handleClearQuotation}
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
                        cursor: 'pointer',
                        border: 'none'
                      }}
                      title="Clear quotation"
                    >
                      ✕
                    </button>
                  ) : null}
                  <span 
                    onClick={() => setIsQuotationDropdownOpen(prev => !prev)}
                    style={{ cursor: 'pointer', color: '#64748b', fontSize: '10px' }}
                  >
                    ▼
                  </span>
                </div>

                {isQuotationDropdownOpen && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 50,
                      padding: '4px 0'
                    }}
                  >
                    {filteredQuotations.length === 0 ? (
                      <div style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>
                        No quotations available
                      </div>
                    ) : (
                      filteredQuotations.map(quote => {
                        const isSelected = formData.quotation_ref === quote.reference;
                        const isForCurrentCust = formData.customer_id && quote.customer_id === formData.customer_id;
                        return (
                          <div
                            key={quote.id}
                            onClick={() => handleSelectQuotation(quote)}
                            style={{
                              padding: '0.65rem 0.85rem',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#f0f7fe' : '#ffffff',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc';
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff';
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0b75b9' }}>
                                  {quote.reference}
                                </span>
                                {isForCurrentCust && (
                                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 600 }}>
                                    Current Customer
                                  </span>
                                )}
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 500 }}>
                                  {quote.status}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {quote.customerName || (quote as any).manual_customer_name || 'Direct Customer'}
                              </span>
                            </div>
                            {isSelected && (
                              <span style={{ color: '#0b75b9', fontWeight: 'bold', fontSize: '0.9rem' }}>✓</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Date</label>
              <input 
                type="date"
                name="target_date"
                value={formData.target_date || ''}
                min={isEditing && originalData?.target_date ? originalData.target_date : todayStr}
                onChange={(e) => {
                  handleChange(e);
                  if (fieldErrors.target_date) setFieldErrors(p => ({ ...p, target_date: undefined }));
                }}
                className={`input-field ${fieldErrors.target_date ? 'input-error' : ''}`}
              />
              {fieldErrors.target_date && <span className="form-error">{fieldErrors.target_date}</span>}
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                📅 {isEditing && originalData?.target_date ? `Date allows original date (${originalData.target_date}) or later.` : 'Date allows today or future dates only.'}
              </span>
            </div>
            
            <div className="form-group">
              <label>Progress Stage</label>
              <select 
                name="stage"
                value={formData.stage || 'In Progress'}
                onChange={handleChange}
                className="input-field"
              >
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Reject">Reject</option>
                <option value="Complete">Complete</option>
              </select>
            </div>
            {formData.stage === 'Reject' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Reason for Rejection <span className="text-danger">*</span></label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (fieldErrors.reject_reason && e.target.value.trim()) {
                      setFieldErrors(p => ({ ...p, reject_reason: undefined }));
                    }
                  }}
                  className={`input-field ${fieldErrors.reject_reason ? 'input-error' : ''}`}
                  rows={2}
                  placeholder="Enter the reason for rejection..."
                  required
                />
                {fieldErrors.reject_reason && <span className="form-error">{fieldErrors.reject_reason}</span>}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Payment Status</label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <Badge variant={formData.payment_status === 'Paid' ? 'success' : formData.payment_status === 'Partial' ? 'info' : 'warning'}>
                {formData.payment_status || 'Pending'}
              </Badge>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                ⚡ Auto-updated dynamically from project invoices and payment receipts.
              </span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t flex-wrap">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !isChanged} title={!isChanged ? 'Make changes to save' : undefined}>
              {saving ? 'Saving...' : 'Save Project'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
