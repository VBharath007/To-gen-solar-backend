import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreateCustomerDto } from '@shared/types/customer.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { validateName, validatePhone, validateEmail, validatePincode, sanitizeNameInput, sanitizePhoneInput } from '../../utils/validation';

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<Partial<CreateCustomerDto>>({
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
    business_category: '',
    notes: ''
  });
  const [originalData, setOriginalData] = useState<Partial<CreateCustomerDto> | null>(null);
  
  const [fieldErrors, setFieldErrors] = useState<{
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
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    if (isEditing) {
      loadCustomer();
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

  const loadCustomer = async () => {
    try {
      const res = await window.desktop.customers.get(Number(id));
      if (res.success) {
        const loaded: Partial<CreateCustomerDto> = {
          name: res.data.name || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
          address: res.data.address || '',
          city: res.data.city || '',
          state: res.data.state || '',
          pincode: res.data.pincode || '',
          gstin: res.data.gstin || '',
          pan: res.data.pan || '',
          customer_type: res.data.customer_type || 'Individual',
          company_name: res.data.company_name || '',
          alternate_phone: res.data.alternate_phone || '',
          business_category: res.data.business_category || '',
          notes: res.data.notes || ''
        };
        setFormData(loaded);
        setOriginalData(loaded);
      } else {
        setError(res.error?.message || 'Failed to load customer');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => {
    if (!isEditing) {
      return Boolean(
        formData.name?.trim() || 
        formData.phone?.trim() || 
        formData.business_category?.trim() ||
        formData.address?.trim() || 
        formData.city?.trim() || 
        formData.state?.trim() || 
        formData.pincode?.trim()
      );
    }
    if (!originalData) return false;

    return (
      (formData.name || '') !== (originalData.name || '') ||
      (formData.phone || '') !== (originalData.phone || '') ||
      (formData.email || '') !== (originalData.email || '') ||
      (formData.address || '') !== (originalData.address || '') ||
      (formData.city || '') !== (originalData.city || '') ||
      (formData.state || '') !== (originalData.state || '') ||
      (formData.pincode || '') !== (originalData.pincode || '') ||
      (formData.gstin || '') !== (originalData.gstin || '') ||
      (formData.pan || '') !== (originalData.pan || '') ||
      (formData.customer_type || 'Individual') !== (originalData.customer_type || 'Individual') ||
      (formData.company_name || '') !== (originalData.company_name || '') ||
      (formData.alternate_phone || '') !== (originalData.alternate_phone || '') ||
      (formData.business_category || '') !== (originalData.business_category || '') ||
      (formData.notes || '') !== (originalData.notes || '')
    );
  }, [isEditing, originalData, formData]);

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    const nameRes = validateName(formData.name, 'Full Name', true);
    if (!nameRes.isValid) errs.name = nameRes.error!;

    if (formData.customer_type === 'Business') {
      const compNoSpace = (formData.company_name || '').replace(/\s+/g, '');
      if (!formData.company_name?.trim()) {
        errs.company_name = 'Company Name is required for business customers.';
      } else if (compNoSpace.length < 3) {
        errs.company_name = 'Company Name must contain at least 3 characters (excluding spaces).';
      }
    }

    const phoneRes = validatePhone(formData.phone, true, 'Phone number');
    if (!phoneRes.isValid) errs.phone = phoneRes.error!;

    if (formData.alternate_phone) {
      const altRes = validatePhone(formData.alternate_phone, false, 'Alternate phone');
      if (!altRes.isValid) errs.alternate_phone = altRes.error!;
    }

    if (formData.email) {
      const emailRes = validateEmail(formData.email, false);
      if (!emailRes.isValid) errs.email = emailRes.error!;
    }

    // Billing Address (required, min 3 chars)
    if (!formData.address?.trim()) {
      errs.address = 'Billing Address is required.';
    } else if (formData.address.trim().length < 3) {
      errs.address = 'Billing Address must be at least 3 characters.';
    }

    // City (required, min 2 chars)
    if (!formData.city?.trim()) {
      errs.city = 'City is required.';
    } else if (formData.city.trim().length < 2) {
      errs.city = 'City must be at least 2 characters.';
    }

    // State (required, min 2 chars)
    if (!formData.state?.trim()) {
      errs.state = 'State is required.';
    } else if (formData.state.trim().length < 2) {
      errs.state = 'State must be at least 2 characters.';
    }

    // Pincode (required, 6 digits)
    const pinRes = validatePincode(formData.pincode, true);
    if (!pinRes.isValid) errs.pincode = pinRes.error!;

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      const msg = 'Please fix the highlighted errors before saving the customer.';
      setError(msg);
      await showAlert({
        type: 'error',
        title: 'Validation Error',
        description: 'Please correct the highlighted fields before saving.',
      });
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Customer Changes',
        description: `Are you sure you want to save the updated changes for "${formData.name || 'this customer'}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      let res;
      if (isEditing) {
        res = await window.desktop.customers.update({ id: Number(id), ...formData });
      } else {
        res = await window.desktop.customers.create(formData as CreateCustomerDto);
      }

      if (res.success) {
        navigate(isEditing ? `/customers/${id}` : '/customers');
      } else {
        const errorMsg = res.error?.message || 'Failed to save customer';
        setError(errorMsg);
        if (errorMsg.includes('phone') || errorMsg.includes('registered') || errorMsg.includes('exists')) {
          setFieldErrors(prev => ({ ...prev, phone: errorMsg }));
        }
        await showAlert({
          type: 'error',
          title: (errorMsg.includes('registered') || errorMsg.includes('exists')) ? 'Duplicate Phone Number' : 'Validation Error',
          description: errorMsg,
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred';
      setError(errorMsg);
      if (errorMsg.includes('phone') || errorMsg.includes('registered') || errorMsg.includes('exists')) {
        setFieldErrors(prev => ({ ...prev, phone: errorMsg }));
      }
      await showAlert({
        type: 'error',
        title: 'Error',
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
      title: 'Delete Customer',
      description: `Are you sure you want to permanently delete "${formData.name || 'this customer'}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.customers.delete(Number(id));
      if (res.success) {
        navigate('/customers');
      } else {
        await showAlert({
          type: 'error',
          title: 'Cannot Delete Customer',
          description: 'Failed to delete customer. They may have associated installation sites or quotations.'
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
        title={isEditing ? 'Edit Customer' : 'Add New Customer'} 
        breadcrumbs={[
          { label: 'Customers', to: '/customers' },
          { label: isEditing ? 'Edit' : 'New' }
        ]}
        action={isEditing ? (
          <Button variant="danger" onClick={handleDelete} className="shadow-sm">Delete Customer</Button>
        ) : undefined}
      />

      <Card>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && <Alert type="error" message={error} />}
          
          <div className="form-section">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Customer Type</label>
                <select 
                  className="w-full"
                  value={formData.customer_type || 'Individual'} 
                  onChange={e => setFormData({...formData, customer_type: e.target.value as any})}
                >
                  <option value="Individual">Individual</option>
                  <option value="Business">Business</option>
                  <option value="Government">Government</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Business Category</label>
                <select 
                  className="w-full"
                  value={formData.business_category || ''} 
                  onChange={e => setFormData({...formData, business_category: e.target.value || undefined})}
                >
                  <option value="">None / Standard</option>
                  {categories.map(c => (
                    <option key={c.id || c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <Input 
                label="Full Name (Primary Contact)" 
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
                placeholder="e.g. Suresh Kumar"
              />
              
              {formData.customer_type === 'Business' && (
                <Input 
                  label="Company Name" 
                  required
                  value={formData.company_name || ''} 
                  error={fieldErrors.company_name}
                  onChange={e => {
                    setFormData({...formData, company_name: e.target.value});
                    if (fieldErrors.company_name && e.target.value.trim()) {
                      setFieldErrors(p => ({ ...p, company_name: undefined }));
                    }
                  }}
                  placeholder="e.g. SunTech Enterprises"
                />
              )}
            </div>
          </div>

          <div className="form-section">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Input 
                label="Alternate Phone" 
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={formData.alternate_phone || ''} 
                error={fieldErrors.alternate_phone}
                onChange={e => {
                  const val = sanitizePhoneInput(e.target.value);
                  setFormData({...formData, alternate_phone: val});
                  if (fieldErrors.alternate_phone) {
                    const res = validatePhone(val, false, 'Alternate phone');
                    setFieldErrors(p => ({ ...p, alternate_phone: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  if (formData.alternate_phone) {
                    const res = validatePhone(formData.alternate_phone, false, 'Alternate phone');
                    setFieldErrors(p => ({ ...p, alternate_phone: res.isValid ? undefined : res.error! }));
                  }
                }}
                placeholder="Optional 10-digit number"
              />
              <Input 
                type="email"
                label="Email Address" 
                value={formData.email || ''} 
                error={fieldErrors.email}
                onChange={e => {
                  setFormData({...formData, email: e.target.value});
                  if (fieldErrors.email) {
                    const res = validateEmail(e.target.value, false);
                    setFieldErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  if (formData.email) {
                    const res = validateEmail(formData.email, false);
                    setFieldErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                  }
                }}
                className="md:col-span-2"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">Billing & Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Billing Address" 
                required
                value={formData.address || ''} 
                error={fieldErrors.address}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, address: val});
                  if (fieldErrors.address) {
                    if (!val.trim()) {
                      setFieldErrors(p => ({ ...p, address: 'Billing Address is required.' }));
                    } else if (val.trim().length < 3) {
                      setFieldErrors(p => ({ ...p, address: 'Billing Address must be at least 3 characters.' }));
                    } else {
                      setFieldErrors(p => ({ ...p, address: undefined }));
                    }
                  }
                }}
                onBlur={() => {
                  if (!formData.address?.trim()) {
                    setFieldErrors(p => ({ ...p, address: 'Billing Address is required.' }));
                  } else if (formData.address.trim().length < 3) {
                    setFieldErrors(p => ({ ...p, address: 'Billing Address must be at least 3 characters.' }));
                  } else {
                    setFieldErrors(p => ({ ...p, address: undefined }));
                  }
                }}
                placeholder="e.g. 12/4, North Street, Anna Nagar"
                className="md:col-span-2"
              />
              <Input 
                label="City" 
                required
                value={formData.city || ''} 
                error={fieldErrors.city}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, city: val});
                  if (fieldErrors.city) {
                    if (!val.trim()) {
                      setFieldErrors(p => ({ ...p, city: 'City is required.' }));
                    } else if (val.trim().length < 2) {
                      setFieldErrors(p => ({ ...p, city: 'City must be at least 2 characters.' }));
                    } else {
                      setFieldErrors(p => ({ ...p, city: undefined }));
                    }
                  }
                }}
                onBlur={() => {
                  if (!formData.city?.trim()) {
                    setFieldErrors(p => ({ ...p, city: 'City is required.' }));
                  } else if (formData.city.trim().length < 2) {
                    setFieldErrors(p => ({ ...p, city: 'City must be at least 2 characters.' }));
                  } else {
                    setFieldErrors(p => ({ ...p, city: undefined }));
                  }
                }}
                placeholder="e.g. Madurai"
              />
              <Input 
                label="State" 
                required
                value={formData.state || ''} 
                error={fieldErrors.state}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, state: val});
                  if (fieldErrors.state) {
                    if (!val.trim()) {
                      setFieldErrors(p => ({ ...p, state: 'State is required.' }));
                    } else if (val.trim().length < 2) {
                      setFieldErrors(p => ({ ...p, state: 'State must be at least 2 characters.' }));
                    } else {
                      setFieldErrors(p => ({ ...p, state: undefined }));
                    }
                  }
                }}
                onBlur={() => {
                  if (!formData.state?.trim()) {
                    setFieldErrors(p => ({ ...p, state: 'State is required.' }));
                  } else if (formData.state.trim().length < 2) {
                    setFieldErrors(p => ({ ...p, state: 'State must be at least 2 characters.' }));
                  } else {
                    setFieldErrors(p => ({ ...p, state: undefined }));
                  }
                }}
                placeholder="e.g. Tamil Nadu"
              />
              <Input 
                label="Pincode" 
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={formData.pincode || ''} 
                error={fieldErrors.pincode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData({...formData, pincode: val});
                  if (fieldErrors.pincode) {
                    const res = validatePincode(val, true);
                    setFieldErrors(p => ({ ...p, pincode: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validatePincode(formData.pincode, true);
                  setFieldErrors(p => ({ ...p, pincode: res.isValid ? undefined : res.error! }));
                }}
                placeholder="6-digit pincode"
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">Tax Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="GSTIN" 
                value={formData.gstin || ''} 
                onChange={e => setFormData({...formData, gstin: e.target.value})} 
              />
              <Input 
                label="PAN" 
                value={formData.pan || ''} 
                onChange={e => setFormData({...formData, pan: e.target.value})} 
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label>Internal Notes</label>
              <textarea 
                rows={4} 
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                className="w-full"
                placeholder="Add any internal remarks or notes about this customer..."
              />
            </div>
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
              {saving ? 'Saving...' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
