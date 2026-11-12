import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreateLeadDto, LeadSource, LeadStatus } from '@shared/types/lead.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { leadApi } from './lead.api';
import { validateName, validatePhone, validateEmail, sanitizeNameInput, sanitizePhoneInput } from '../../utils/validation';

export default function LeadForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<Partial<CreateLeadDto>>({
    name: '',
    phone: '',
    email: '',
    source: undefined,
    status: 'New',
    business_category: undefined,
    notes: ''
  });
  const [originalData, setOriginalData] = useState<Partial<CreateLeadDto> | null>(null);
  
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
    business_category?: string;
    source?: string;
  }>({});
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    if (isEditing) {
      loadLead();
    }
  }, [id]);

  const loadCategories = async () => {
    try {
      const res = await window.desktop.categories.listActive();
      if (res.success) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadLead = async () => {
    try {
      const data = await leadApi.get(Number(id));
      const initial: Partial<CreateLeadDto> = {
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        source: data.source || undefined,
        status: data.status,
        business_category: data.business_category || undefined,
        notes: data.notes || ''
      };
      setFormData(initial);
      setOriginalData(initial);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => {
    if (!isEditing) {
      return Boolean(formData.name?.trim() || formData.phone?.trim() || formData.email?.trim());
    }
    if (!originalData) return false;

    return (
      (formData.name || '') !== (originalData.name || '') ||
      (formData.phone || '') !== (originalData.phone || '') ||
      (formData.email || '') !== (originalData.email || '') ||
      formData.source !== originalData.source ||
      formData.status !== originalData.status ||
      formData.business_category !== originalData.business_category ||
      (formData.notes || '') !== (originalData.notes || '')
    );
  }, [isEditing, originalData, formData]);

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    // 1. Full Name (mandatory, minimum 3 letters without space)
    const nameRes = validateName(formData.name, 'Full Name', true);
    if (!nameRes.isValid) errs.name = nameRes.error!;

    // 2. Phone Number (mandatory, strictly 10 digits)
    const phoneRes = validatePhone(formData.phone, true, 'Phone number');
    if (!phoneRes.isValid) errs.phone = phoneRes.error!;

    // 3. Email Address (optional)
    const emailRes = validateEmail(formData.email, false);
    if (!emailRes.isValid) errs.email = emailRes.error!;

    // 4. Status (mandatory)
    if (!formData.status) {
      errs.status = 'Please select a status.';
    }

    // 5. Business Category (mandatory)
    if (!formData.business_category) {
      errs.business_category = 'Please select a business category.';
    }

    // 6. Source (mandatory)
    if (!formData.source) {
      errs.source = 'Please select a lead source.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      const msg = 'Please fill in all mandatory fields (Name, Phone, Status, Business Category, Source) correctly.';
      setError(msg);
      await showAlert({
        type: 'error',
        title: 'Missing Required Information',
        description: 'Please complete all required fields (Full Name, Phone Number, Status, Business Category, and Lead Source) before saving the lead.',
      });
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Lead Changes',
        description: `Are you sure you want to save the updated changes for "${formData.name || 'this lead'}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await leadApi.update({ id: Number(id), ...formData });
      } else {
        await leadApi.create(formData as CreateLeadDto);
      }
      navigate('/leads');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save lead';
      setError(errorMsg);
      if (errorMsg.includes('phone') || errorMsg.includes('registered') || errorMsg.includes('exists')) {
        setFieldErrors(prev => ({ ...prev, phone: errorMsg }));
      }
      await showAlert({
        type: 'error',
        title: (errorMsg.includes('registered') || errorMsg.includes('exists')) ? 'Duplicate Phone Number' : 'Failed to Save Lead',
        description: errorMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !id) return;
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Lead',
      description: `Are you sure you want to permanently delete "${formData.name || 'this lead'}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.leads.delete(Number(id));
      if (res.success) {
        navigate('/leads');
      } else {
        await showAlert({
          type: 'error',
          title: 'Cannot Delete Lead',
          description: 'Failed to delete lead. It may have associated records.'
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || String(err),
      });
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pb-12">
      <PageHeader 
        title={isEditing ? 'Edit Lead' : 'Add New Lead'} 
        breadcrumbs={[
          { label: 'Leads', to: '/leads' },
          { label: isEditing ? 'Edit' : 'New' }
        ]}
        action={isEditing ? (
          <Button variant="danger" onClick={handleDelete} className="shadow-sm">Delete Lead</Button>
        ) : undefined}
      />

      <Card>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && <Alert type="error" message={error} />}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Full Name" 
              required 
              value={formData.name || ''} 
              error={fieldErrors.name}
              onChange={e => {
                const val = sanitizeNameInput(e.target.value);
                setFormData({...formData, name: val});
                if (fieldErrors.name) {
                  const res = validateName(val, 'Full Name', true);
                  setFieldErrors(p => ({ ...p, name: res.isValid ? undefined : res.error! }));
                }
              }}
              onBlur={() => {
                const res = validateName(formData.name, 'Full Name', true);
                setFieldErrors(p => ({ ...p, name: res.isValid ? undefined : res.error! }));
              }}
              placeholder="e.g. Ramesh Kumar"
            />
            <Input 
              label="Phone Number" 
              required 
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formData.phone || ''} 
              error={fieldErrors.phone}
              onChange={e => {
                const val = sanitizePhoneInput(e.target.value);
                setFormData({...formData, phone: val});
                if (fieldErrors.phone) {
                  const res = validatePhone(val, true, 'Phone number');
                  setFieldErrors(p => ({ ...p, phone: res.isValid ? undefined : res.error! }));
                }
              }}
              onBlur={() => {
                const res = validatePhone(formData.phone, true, 'Phone number');
                setFieldErrors(p => ({ ...p, phone: res.isValid ? undefined : res.error! }));
              }}
              placeholder="10-digit mobile number"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              type="email"
              label="Email Address" 
              value={formData.email || ''} 
              error={fieldErrors.email}
              onChange={e => {
                const val = e.target.value;
                setFormData({...formData, email: val});
                if (fieldErrors.email) {
                  const res = validateEmail(val, false);
                  setFieldErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                }
              }}
              onBlur={() => {
                if (formData.email) {
                  const res = validateEmail(formData.email, false);
                  setFieldErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                } else {
                  setFieldErrors(p => ({ ...p, email: undefined }));
                }
              }}
              placeholder="name@example.com"
            />
            <div className="form-group">
              <label>
                Status <span className="text-danger">*</span>
              </label>
              <select 
                className={`w-full ${fieldErrors.status ? 'input-error' : ''}`}
                value={formData.status || ''} 
                onChange={e => {
                  const val = e.target.value as LeadStatus;
                  setFormData({...formData, status: val});
                  if (fieldErrors.status) {
                    setFieldErrors(p => ({ ...p, status: val ? undefined : 'Please select a status.' }));
                  }
                }}
                onBlur={() => {
                  if (!formData.status) {
                    setFieldErrors(p => ({ ...p, status: 'Please select a status.' }));
                  }
                }}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Lost">Lost</option>
                <option value="Converted">Converted</option>
              </select>
              {fieldErrors.status && <div className="form-error">{fieldErrors.status}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>
                Business Category <span className="text-danger">*</span>
              </label>
              <select 
                className={`w-full ${fieldErrors.business_category ? 'input-error' : ''}`}
                value={formData.business_category || ''} 
                onChange={e => {
                  const val = e.target.value || undefined;
                  setFormData({...formData, business_category: val});
                  if (fieldErrors.business_category) {
                    setFieldErrors(p => ({ ...p, business_category: val ? undefined : 'Please select a business category.' }));
                  }
                }}
                onBlur={() => {
                  if (!formData.business_category) {
                    setFieldErrors(p => ({ ...p, business_category: 'Please select a business category.' }));
                  }
                }}
              >
                <option value="">Select a category...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.code}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.business_category && <div className="form-error">{fieldErrors.business_category}</div>}
            </div>
            
            <div className="form-group">
              <label>
                Source <span className="text-danger">*</span>
              </label>
              <select 
                className={`w-full ${fieldErrors.source ? 'input-error' : ''}`}
                value={formData.source || ''} 
                onChange={e => {
                  const val = (e.target.value || undefined) as LeadSource | undefined;
                  setFormData({...formData, source: val});
                  if (fieldErrors.source) {
                    setFieldErrors(p => ({ ...p, source: val ? undefined : 'Please select a lead source.' }));
                  }
                }}
                onBlur={() => {
                  if (!formData.source) {
                    setFieldErrors(p => ({ ...p, source: 'Please select a lead source.' }));
                  }
                }}
              >
                <option value="">Select a source...</option>
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Social Media">Social Media</option>
                <option value="Direct">Direct</option>
                <option value="Other">Other</option>
              </select>
              {fieldErrors.source && <div className="form-error">{fieldErrors.source}</div>}
            </div>
          </div>

          <div className="form-group">
            <label>
              Notes <span className="text-muted text-xs font-normal">(Optional)</span>
            </label>
            <textarea 
              className="w-full"
              rows={4} 
              value={formData.notes || ''} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              placeholder="Add any additional details or notes about the lead here..."
            />
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t flex-wrap">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              isLoading={saving}
              disabled={saving || !isChanged}
              title={!isChanged ? 'Make changes to save' : undefined}
            >
              {saving ? 'Saving...' : 'Save Lead'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
