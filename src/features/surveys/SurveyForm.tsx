import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import type { CreateSiteSurveyDto } from '@shared/types/survey.types';

export default function SurveyForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayDate(), []);

  const [formData, setFormData] = useState<Partial<CreateSiteSurveyDto>>({
    customer_id: 0,
    site_id: 0,
    survey_date: getTodayDate(),
    status: 'Scheduled',
    cancellation_reason: '',
    roof_type: '',
    roof_area_sqft: undefined,
    electrical_phase: undefined,
    notes: '',
  });
  const [originalData, setOriginalData] = useState<any | null>(null);

  // Dynamic min and max dates based on survey status
  const { minDate, maxDate } = useMemo(() => {
    if (formData.status === 'Scheduled') {
      const minAllowed = isEditing && originalData?.survey_date
        ? originalData.survey_date.split('T')[0]
        : todayStr;
      return { minDate: minAllowed, maxDate: undefined };
    }
    if (formData.status === 'Completed') {
      return { minDate: undefined, maxDate: todayStr };
    }
    return { minDate: undefined, maxDate: undefined };
  }, [formData.status, todayStr, isEditing, originalData]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // New site inline modal
  const [showAddSite, setShowAddSite] = useState<boolean>(false);
  const [newSiteAddress, setNewSiteAddress] = useState<string>('');
  const [newSiteCity, setNewSiteCity] = useState<string>('');
  const [isAddingSite, setIsAddingSite] = useState<boolean>(false);

  useEffect(() => {
    loadDependencies();
    if (isEditing && id) {
      loadSurvey(Number(id));
    }
  }, [id, isEditing]);

  const loadDependencies = async () => {
    try {
      const custRes = await window.desktop.customers.list();
      if (custRes.success) setCustomers(custRes.data);
    } catch (err) {
      console.error('[SurveyForm] Error loading customers:', err);
    }
  };

  const fetchSites = async (customerId: number) => {
    try {
      const sitesRes = await window.desktop.installationSites.listByCustomer(customerId);
      if (sitesRes.success) {
        setSites(sitesRes.data);
        if (sitesRes.data.length > 0) {
          setFormData((prev) => ({ ...prev, site_id: sitesRes.data[0].id }));
        } else {
          setFormData((prev) => ({ ...prev, site_id: 0 }));
        }
      }
    } catch (err) {
      console.error('[SurveyForm] Error fetching sites:', err);
    }
  };

  const loadSurvey = async (surveyId: number) => {
    try {
      const res = await window.desktop.surveys.get(surveyId);
      if (res.success) {
        const initial = {
          customer_id: res.data.customer_id,
          site_id: res.data.site_id,
          survey_date: res.data.survey_date?.split('T')[0] || res.data.survey_date,
          status: res.data.status,
          cancellation_reason: res.data.cancellation_reason || '',
          roof_type: res.data.roof_type || '',
          roof_area_sqft: res.data.roof_area_sqft || undefined,
          electrical_phase: res.data.electrical_phase || undefined,
          notes: res.data.notes || '',
        };
        setFormData(initial);
        setOriginalData(initial);
        fetchSites(res.data.customer_id);
      } else {
        setError(res.error?.message || 'Failed to load survey');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => {
    if (!isEditing) {
      return Boolean(formData.customer_id && formData.customer_id > 0);
    }
    if (!originalData) return false;

    return (
      Number(formData.customer_id ?? 0) !== Number(originalData.customer_id ?? 0) ||
      Number(formData.site_id ?? 0) !== Number(originalData.site_id ?? 0) ||
      (formData.survey_date || '') !== (originalData.survey_date || '') ||
      (formData.status || '') !== (originalData.status || '') ||
      (formData.cancellation_reason || '') !== (originalData.cancellation_reason || '') ||
      (formData.roof_type || '') !== (originalData.roof_type || '') ||
      Number(formData.roof_area_sqft ?? 0) !== Number(originalData.roof_area_sqft ?? 0) ||
      (formData.electrical_phase || '') !== (originalData.electrical_phase || '') ||
      (formData.notes || '') !== (originalData.notes || '')
    );
  }, [isEditing, originalData, formData]);

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = Number(e.target.value);
    const foundCust = customers.find((c) => c.id === custId) || null;
    setSelectedCustomer(foundCust);
    setError(null);

    setFormData((prev) => ({ ...prev, customer_id: custId, site_id: 0 }));
    if (custId > 0) {
      fetchSites(custId);
    } else {
      setSites([]);
    }
  };

  const handleWheelPrevent = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLElement).blur();
  };

  const handleNonNegativeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleNonNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData?.getData('text') || '';
    if (paste.includes('-') || paste.includes('+')) {
      e.preventDefault();
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (name === 'site_id') {
      setFormData((prev) => ({ ...prev, site_id: Number(value) }));
    } else if (type === 'number') {
      const parsed = value ? parseFloat(value) : undefined;
      setFormData((prev) => ({ ...prev, [name]: parsed !== undefined ? Math.max(0, parsed) : undefined }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const [quickSiteErrors, setQuickSiteErrors] = useState<{ address?: string; city?: string }>({});

  // Quick add site handler
  const handleQuickAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { address?: string; city?: string } = {};
    const addrNoSpace = newSiteAddress.replace(/\s+/g, '');
    if (!newSiteAddress.trim()) {
      errs.address = 'Site address is required.';
    } else if (addrNoSpace.length < 3) {
      errs.address = 'Site address must contain at least 3 characters (excluding spaces).';
    }

    const cityNoSpace = newSiteCity.replace(/\s+/g, '');
    if (!newSiteCity.trim()) {
      errs.city = 'City is required.';
    } else if (cityNoSpace.length < 3) {
      errs.city = 'City must contain at least 3 characters (excluding spaces).';
    }

    setQuickSiteErrors(errs);
    if (Object.keys(errs).length > 0 || !formData.customer_id) {
      return;
    }
    setIsAddingSite(true);
    try {
      const res = await window.desktop.installationSites.create({
        customerId: Number(formData.customer_id),
        address: newSiteAddress.trim(),
        city: newSiteCity.trim(),
        siteNotes: 'Added during survey scheduling',
      });
      if (res.success) {
        await fetchSites(Number(formData.customer_id));
        setFormData((prev) => ({ ...prev, site_id: res.data.id }));
        setShowAddSite(false);
        setNewSiteAddress('');
        setNewSiteCity('');
        setQuickSiteErrors({});
      } else {
        setError(res.error.message || 'Failed to create site address');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAddingSite(false);
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as 'Scheduled' | 'Completed' | 'Cancelled';
    const currentDate = formData.survey_date?.split('T')[0] || '';
    const minAllowed = isEditing && originalData?.survey_date
      ? originalData.survey_date.split('T')[0]
      : todayStr;

    let updatedDate = currentDate;
    // If switching to Scheduled but date was before the allowed baseline date, adjust
    if (newStatus === 'Scheduled' && currentDate && currentDate < minAllowed) {
      updatedDate = minAllowed;
    }
    // If switching to Completed but date was in future, adjust to today
    if (newStatus === 'Completed' && currentDate && currentDate > todayStr) {
      updatedDate = todayStr;
    }

    setFormData(prev => ({
      ...prev,
      status: newStatus,
      survey_date: updatedDate,
    }));

    if (fieldErrors.survey_date) {
      setFieldErrors(prev => ({ ...prev, survey_date: undefined }));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, survey_date: val }));

    if (fieldErrors.survey_date) {
      setFieldErrors(prev => ({ ...prev, survey_date: undefined }));
    }
  };

  const [fieldErrors, setFieldErrors] = useState<{ 
    customer_id?: string; 
    site_id?: string; 
    survey_date?: string; 
    cancellation_reason?: string;
    roof_area_sqft?: string; 
  }>({});

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    if (!formData.customer_id || Number(formData.customer_id) <= 0) {
      errs.customer_id = 'Please select a customer.';
    }

    if (!formData.site_id || Number(formData.site_id) <= 0) {
      errs.site_id = 'Please select an installation site.';
    }

    const currentDate = formData.survey_date?.split('T')[0] || '';
    const minAllowed = isEditing && originalData?.survey_date
      ? originalData.survey_date.split('T')[0]
      : todayStr;

    if (!currentDate) {
      errs.survey_date = 'Survey date is required.';
    } else if (formData.status === 'Scheduled' && currentDate < minAllowed) {
      errs.survey_date = isEditing
        ? `Scheduled survey date cannot be earlier than the original survey date (${originalData.survey_date.split('T')[0]}).`
        : 'Scheduled survey date cannot be in the past. Please select today or a future date.';
    } else if (formData.status === 'Completed' && currentDate > todayStr) {
      errs.survey_date = 'Completed survey date cannot be in the future. Please select today or a past date.';
    }

    if (formData.status === 'Cancelled' && (!formData.cancellation_reason || !formData.cancellation_reason.trim())) {
      errs.cancellation_reason = 'Please enter a cancellation reason.';
    }

    if (formData.roof_area_sqft !== undefined && (isNaN(Number(formData.roof_area_sqft)) || Number(formData.roof_area_sqft) < 0)) {
      errs.roof_area_sqft = 'Roof area cannot be negative.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Survey Changes',
        description: 'Are you sure you want to save the updated changes for this site survey?',
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);

    try {
      let res;
      if (isEditing && id) {
        res = await window.desktop.surveys.update({
          id: Number(id),
          customer_id: Number(formData.customer_id),
          site_id: Number(formData.site_id) || undefined,
          survey_date: formData.survey_date,
          status: formData.status,
          cancellation_reason: formData.status === 'Cancelled' ? formData.cancellation_reason?.trim() : null,
          roof_type: formData.roof_type,
          roof_area_sqft: formData.roof_area_sqft,
          electrical_phase: formData.electrical_phase,
          notes: formData.notes,
        });
      } else {
        res = await window.desktop.surveys.create({
          customer_id: Number(formData.customer_id),
          site_id: Number(formData.site_id) || 0,
          survey_date: formData.survey_date || new Date().toISOString().split('T')[0],
          status: formData.status || 'Scheduled',
          cancellation_reason: formData.status === 'Cancelled' ? formData.cancellation_reason?.trim() : null,
          roof_type: formData.roof_type || undefined,
          roof_area_sqft: formData.roof_area_sqft ? Number(formData.roof_area_sqft) : undefined,
          electrical_phase: formData.electrical_phase || undefined,
          notes: formData.notes || undefined,
        });
      }

      if (res.success) {
        navigate('/surveys');
      } else {
        setError(res.error?.message || 'Failed to save survey. Please check your inputs.');
      }
    } catch (err) {
      setError((err as Error).message || String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading survey details...</div>;
  }

  const hasNoSites = formData.customer_id && formData.customer_id > 0 && sites.length === 0;

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '3rem' }}>
      <PageHeader
        title={isEditing ? 'Edit Site Survey' : 'Schedule Survey'}
        breadcrumbs={[{ label: 'Surveys', to: '/surveys' }, { label: isEditing ? 'Edit' : 'New' }]}
      />

      <Card>
        {error && <Alert type="error" message={error} className="mb-4" />}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Customer & Site row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Customer <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                name="customer_id"
                value={formData.customer_id || ''}
                onChange={(e) => {
                  handleCustomerChange(e);
                  if (fieldErrors.customer_id) setFieldErrors(p => ({ ...p, customer_id: undefined }));
                }}
                disabled={isEditing}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fieldErrors.customer_id ? '1.5px solid var(--danger-color)' : (formData.customer_id ? '1.5px solid #cbd5e1' : '1.5px solid #0b75b9'),
                  backgroundColor: fieldErrors.customer_id ? '#fff8f8' : '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="" disabled>
                  Select Customer...
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.customer_id && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.customer_id}
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Installation Site <span style={{ color: '#dc2626' }}>*</span>
                </label>
               
              </div>

              {hasNoSites ? (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '13px',
                    lineHeight: 1.4,
                  }}
                >
                  ✓ Customer's primary address will be automatically used:
                  <div style={{ fontWeight: 600, marginTop: '2px', color: '#1e293b' }}>
                    {selectedCustomer?.address || 'Primary Site'}, {selectedCustomer?.city || 'Local'}
                  </div>
                </div>
              ) : (
                <>
                  <select
                    name="site_id"
                    value={formData.site_id || ''}
                    onChange={(e) => {
                      handleChange(e);
                      if (fieldErrors.site_id) setFieldErrors(p => ({ ...p, site_id: undefined }));
                    }}
                    disabled={isEditing || !formData.customer_id}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: fieldErrors.site_id ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                      backgroundColor: fieldErrors.site_id ? '#fff8f8' : (formData.customer_id ? '#ffffff' : '#f8fafc'),
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="" disabled>
                      Select Site...
                    </option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.address}, {s.city}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.site_id && (
                    <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.site_id}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Survey Date & Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Survey Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                name="survey_date"
                value={formData.survey_date?.split('T')[0] || ''}
                min={minDate}
                max={maxDate}
                onChange={handleDateChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fieldErrors.survey_date ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: fieldErrors.survey_date ? '#fff8f8' : '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {fieldErrors.survey_date && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.survey_date}
                </span>
              )}
              {formData.status === 'Scheduled' && (
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  📅 Scheduled status allows today or future dates only.
                </span>
              )}
              {formData.status === 'Completed' && (
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  📅 Completed status allows today or past dates only.
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Status <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                name="status"
                value={formData.status || 'Scheduled'}
                onChange={handleStatusChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Cancellation Reason (Required when status is Cancelled) */}
          {formData.status === 'Cancelled' && (
            <div style={{
              marginTop: '12px',
              padding: '14px 16px',
              backgroundColor: '#fef2f2',
              borderRadius: '10px',
              border: '1.5px solid #fecaca',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '6px' }}>
                Cancellation Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                name="cancellation_reason"
                rows={3}
                value={formData.cancellation_reason || ''}
                onChange={handleChange}
                placeholder="Please enter the reason why this site survey is cancelled..."
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1.5px solid ${fieldErrors.cancellation_reason ? '#dc2626' : '#cbd5e1'}`,
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              {fieldErrors.cancellation_reason && (
                <span style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                  {fieldErrors.cancellation_reason}
                </span>
              )}
            </div>
          )}

          {/* Technical Survey Details */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
              Roof & Electrical Details (Optional)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Roof Type
                </label>
                <select
                  name="roof_type"
                  value={formData.roof_type || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="RCC Flat">RCC Flat</option>
                  <option value="Sheet">Sheet</option>
                  <option value="Sloped Tile">Sloped Tile</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Roof Area (sq.ft)
                </label>
                <input
                  type="number"
                  min="0"
                  name="roof_area_sqft"
                  value={formData.roof_area_sqft !== undefined ? formData.roof_area_sqft : ''}
                  onChange={handleChange}
                  onWheel={handleWheelPrevent}
                  onKeyDown={handleNonNegativeKeyDown}
                  onPaste={handleNonNegativePaste}
                  placeholder="e.g. 1200"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Electrical Phase
                </label>
                <select
                  name="electrical_phase"
                  value={formData.electrical_phase || ''}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                >
                  <option value="">Unknown</option>
                  <option value="Single">Single Phase</option>
                  <option value="Three">Three Phase</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Survey Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Enter site observations, shading obstructions, cable routing, etc."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '16px',
              marginTop: '8px',
            }}
          >
            <Button variant="secondary" type="button" onClick={() => navigate('/surveys')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !isChanged} title={!isChanged ? 'Make changes to save' : undefined}>
              {saving ? 'Saving...' : 'Save Survey'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Quick Add Installation Site Modal */}
      {showAddSite && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ padding: '16px 24px', backgroundColor: '#0b75b9', color: '#ffffff' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Add Installation Site</h3>
            </div>
            <form noValidate onSubmit={handleQuickAddSite} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Site Address <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newSiteAddress}
                  onChange={(e) => {
                    setNewSiteAddress(e.target.value);
                    if (quickSiteErrors.address) {
                      const noSpace = e.target.value.replace(/\s+/g, '');
                      setQuickSiteErrors(p => ({
                        ...p,
                        address: !e.target.value.trim() ? 'Site address is required.' : noSpace.length < 3 ? 'Site address must contain at least 3 characters (excluding spaces).' : undefined
                      }));
                    }
                  }}
                  placeholder="e.g. 12, West Street, Industrial Area"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: quickSiteErrors.address ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                    backgroundColor: quickSiteErrors.address ? '#fff8f8' : '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {quickSiteErrors.address && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{quickSiteErrors.address}</div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  City <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newSiteCity}
                  onChange={(e) => {
                    setNewSiteCity(e.target.value);
                    if (quickSiteErrors.city) {
                      const noSpace = e.target.value.replace(/\s+/g, '');
                      setQuickSiteErrors(p => ({
                        ...p,
                        city: !e.target.value.trim() ? 'City is required.' : noSpace.length < 3 ? 'City must contain at least 3 characters (excluding spaces).' : undefined
                      }));
                    }
                  }}
                  placeholder="e.g. Coimbatore"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: quickSiteErrors.city ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                    backgroundColor: quickSiteErrors.city ? '#fff8f8' : '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {quickSiteErrors.city && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{quickSiteErrors.city}</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSite(false);
                    setQuickSiteErrors({});
                  }}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSite}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#2e8b38', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  {isAddingSite ? 'Saving...' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
