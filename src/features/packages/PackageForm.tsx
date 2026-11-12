import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import type { CreatePackageDto } from '@shared/types/package.types';
// import type { Product } from '@shared/types/product.types';

export default function PackageForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<Partial<CreatePackageDto> & { is_archived?: boolean }>({
    name: '',
    description: '',
    dc_capacity_kw: isEditing ? 0 : undefined,
    ac_capacity_kw: isEditing ? 0 : undefined,
    pricing_method: 'aggregate',
    fixed_price: undefined,
    items: [],
    is_archived: false
  });
  const [originalData, setOriginalData] = useState<any | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    dc_capacity_kw?: string;
    ac_capacity_kw?: string;
    pricing_method?: string;
    fixed_price?: string;
  }>({});
  // const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // For adding new item (commented out as BOM section is hidden)
  // const [selectedProductId, setSelectedProductId] = useState<number>(0);
  // const [selectedQuantity, setSelectedQuantity] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [id, isEditing]);

  const loadData = async () => {
    setLoading(true);
    try {
      // const prodRes = await window.desktop.products.list();
      // if (prodRes.success) setProducts(prodRes.data);

      if (isEditing && id) {
        const pkgRes = await window.desktop.packages.get(Number(id));
        if (pkgRes.success) {
          const initial = {
            name: pkgRes.data.name || '',
            description: pkgRes.data.description || '',
            dc_capacity_kw: pkgRes.data.dc_capacity_kw,
            ac_capacity_kw: pkgRes.data.ac_capacity_kw,
            pricing_method: pkgRes.data.pricing_method || 'aggregate',
            fixed_price: pkgRes.data.fixed_price != null ? pkgRes.data.fixed_price / 100 : undefined,
            items: pkgRes.data.items?.map((i: any) => ({ product_id: i.product_id, quantity: i.quantity })) || [],
            is_archived: Boolean(pkgRes.data.is_archived)
          };
          setFormData(initial);
          setOriginalData(initial);
        } else {
          setError(pkgRes.error?.message || 'Failed to load package');
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
      return Boolean(formData.name?.trim() || (formData.items && formData.items.length > 0));
    }
    if (!originalData) return false;

    const itemsChanged = JSON.stringify(formData.items || []) !== JSON.stringify(originalData.items || []);

    return (
      (formData.name || '') !== (originalData.name || '') ||
      (formData.description || '') !== (originalData.description || '') ||
      Number(formData.dc_capacity_kw ?? 0) !== Number(originalData.dc_capacity_kw ?? 0) ||
      Number(formData.ac_capacity_kw ?? 0) !== Number(originalData.ac_capacity_kw ?? 0) ||
      formData.pricing_method !== originalData.pricing_method ||
      Number(formData.fixed_price ?? 0) !== Number(originalData.fixed_price ?? 0) ||
      Boolean(formData.is_archived) !== Boolean(originalData.is_archived) ||
      itemsChanged
    );
  }, [isEditing, originalData, formData]);

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'name') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else if (type === 'number') {
      const parsed = value ? parseFloat(value) : undefined;
      setFormData(prev => ({ ...prev, [name]: parsed !== undefined ? Math.max(0, parsed) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    const nameNoSpace = (formData.name || '').replace(/\s+/g, '');
    if (!formData.name?.trim()) {
      errs.name = 'Package name is required.';
    } else if (nameNoSpace.length < 3) {
      errs.name = 'Package name must contain at least 3 characters (excluding spaces).';
    }

    // DC Capacity (mandatory)
    if (formData.dc_capacity_kw === undefined || formData.dc_capacity_kw === null || String(formData.dc_capacity_kw).trim() === '') {
      errs.dc_capacity_kw = 'DC capacity is required.';
    } else if (isNaN(formData.dc_capacity_kw) || formData.dc_capacity_kw <= 0) {
      errs.dc_capacity_kw = 'DC capacity must be greater than 0.';
    }

    // AC Capacity (mandatory)
    if (formData.ac_capacity_kw === undefined || formData.ac_capacity_kw === null || String(formData.ac_capacity_kw).trim() === '') {
      errs.ac_capacity_kw = 'AC capacity is required.';
    } else if (isNaN(formData.ac_capacity_kw) || formData.ac_capacity_kw <= 0) {
      errs.ac_capacity_kw = 'AC capacity must be greater than 0.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* Handlers commented out because Package Bill of Materials section is hidden
  const handleAddItem = () => {
    if (!selectedProductId || selectedQuantity <= 0) return;
    
    // Check if already exists - if so, add to existing count
    const existing = formData.items?.find(i => i.product_id === selectedProductId);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items?.map(i =>
          i.product_id === selectedProductId
            ? { ...i, quantity: Math.min(Number(i.quantity) + selectedQuantity, 100000) }
            : i
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...(prev.items || []), { product_id: selectedProductId, quantity: Math.min(Number(selectedQuantity), 100000) }]
      }));
    }
    
    setSelectedProductId(0);
    setSelectedQuantity(0);
  };

  const handleIncrementItem = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.map(i => (i.product_id === productId ? { ...i, quantity: Math.min(Number(i.quantity) + 1, 100000) } : i))
    }));
  };

  const handleDecrementItem = (productId: number) => {
    setFormData(prev => {
      const item = prev.items?.find(i => i.product_id === productId);
      if (!item) return prev;

      // If 1 or less, decreasing deletes the product from the package
      if (Number(item.quantity) <= 1) {
        return {
          ...prev,
          items: prev.items?.filter(i => i.product_id !== productId)
        };
      }

      return {
        ...prev,
        items: prev.items?.map(i =>
          i.product_id === productId
            ? { ...i, quantity: Number(i.quantity) - 1 }
            : i
        )
      };
    });
  };

  const handleRemoveItem = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter(i => i.product_id !== productId)
    }));
  };
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      const msg = 'Please fill in all mandatory fields (Package Name, DC Capacity, and AC Capacity) correctly.';
      setError(msg);
      await showAlert({
        type: 'error',
        title: 'Missing Required Information',
        description: 'Please complete all required fields (Package Name, DC Capacity, and AC Capacity) before saving the package.',
      });
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'save',
        title: 'Save Package Changes',
        description: `Are you sure you want to save the updated changes for "${(formData.name || 'this package').toUpperCase()}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
        isDestructive: false
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        name: (formData.name || '').trim().toUpperCase(),
        is_archived: formData.is_archived ? 1 : 0,
        items: formData.items || [],
        pricing_method: 'aggregate',
        fixed_price: undefined
      };

      let res;
      if (isEditing && id) {
        res = await window.desktop.packages.update({ id: Number(id), ...(payload as any) });
      } else {
        res = await window.desktop.packages.create(payload as any);
      }

      if (res.success) {
        navigate('/packages');
      } else {
        const errorMsg = res.error?.message || 'Failed to save package';
        setError(errorMsg);
        await showAlert({
          type: 'error',
          title: 'Save Failed',
          description: errorMsg,
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setError(errMsg);
      await showAlert({
        type: 'error',
        title: 'Save Failed',
        description: errMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Package',
      description: `Are you sure you want to permanently delete package "${formData.name || 'this package'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Package',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await window.desktop.packages.delete(Number(id));
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Package Deleted',
          description: `Package "${formData.name || ''}" has been deleted.`,
        });
        navigate('/packages');
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Could not delete package.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Delete Failed',
        description: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '3rem' }}>
      <PageHeader 
        title={isEditing ? "Edit Package" : "New Package"} 
        breadcrumbs={[{ label: 'Packages', to: '/packages' }, { label: isEditing ? 'Edit' : 'New' }]}
      />

      <Card>
        {error && <Alert type="error" message={error} className="mb-4" />}
        <form id="packageForm" noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row 1: Package Name */}
          <div className="flex flex-col gap-1">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Package Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input 
              type="text" 
              name="name" 
              value={formData.name || ''} 
              onChange={handleChange} 
              onBlur={() => {
                const nameNoSpace = (formData.name || '').replace(/\s+/g, '');
                if (!formData.name?.trim()) {
                  setFieldErrors(p => ({ ...p, name: 'Package name is required.' }));
                } else if (nameNoSpace.length < 3) {
                  setFieldErrors(p => ({ ...p, name: 'Package name must contain at least 3 characters (excluding spaces).' }));
                }
              }}
              className={`input-field uppercase ${fieldErrors.name ? 'input-error' : ''}`} 
              required 
              placeholder="e.g. 3KW GRID-TIE PREMIUM" 
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: fieldErrors.name ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                backgroundColor: fieldErrors.name ? '#fff8f8' : '#ffffff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                textTransform: 'uppercase'
              }}
            />
            {fieldErrors.name && <span className="form-error">{fieldErrors.name}</span>}
          </div>

          {/* Row 2: DC Capacity & AC Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="flex flex-col gap-1">
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                DC Capacity (kW) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                name="dc_capacity_kw" 
                value={formData.dc_capacity_kw !== undefined ? formData.dc_capacity_kw : ''} 
                onChange={handleChange} 
                onWheel={handleWheelPrevent}
                onKeyDown={handleNonNegativeKeyDown}
                onPaste={handleNonNegativePaste}
                onBlur={() => {
                  if (formData.dc_capacity_kw === undefined || formData.dc_capacity_kw === null || String(formData.dc_capacity_kw).trim() === '') {
                    setFieldErrors(p => ({ ...p, dc_capacity_kw: 'DC capacity is required.' }));
                  } else if (isNaN(formData.dc_capacity_kw) || formData.dc_capacity_kw <= 0) {
                    setFieldErrors(p => ({ ...p, dc_capacity_kw: 'DC capacity must be greater than 0.' }));
                  }
                }}
                className={`input-field ${fieldErrors.dc_capacity_kw ? 'input-error' : ''}`} 
                placeholder="e.g. 3.5"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fieldErrors.dc_capacity_kw ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: fieldErrors.dc_capacity_kw ? '#fff8f8' : '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {fieldErrors.dc_capacity_kw && <span className="form-error">{fieldErrors.dc_capacity_kw}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                AC Capacity (kW) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                name="ac_capacity_kw" 
                value={formData.ac_capacity_kw !== undefined ? formData.ac_capacity_kw : ''} 
                onChange={handleChange} 
                onWheel={handleWheelPrevent}
                onKeyDown={handleNonNegativeKeyDown}
                onPaste={handleNonNegativePaste}
                onBlur={() => {
                  if (formData.ac_capacity_kw === undefined || formData.ac_capacity_kw === null || String(formData.ac_capacity_kw).trim() === '') {
                    setFieldErrors(p => ({ ...p, ac_capacity_kw: 'AC capacity is required.' }));
                  } else if (isNaN(formData.ac_capacity_kw) || formData.ac_capacity_kw <= 0) {
                    setFieldErrors(p => ({ ...p, ac_capacity_kw: 'AC capacity must be greater than 0.' }));
                  }
                }}
                className={`input-field ${fieldErrors.ac_capacity_kw ? 'input-error' : ''}`} 
                placeholder="e.g. 3.0"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fieldErrors.ac_capacity_kw ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: fieldErrors.ac_capacity_kw ? '#fff8f8' : '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {fieldErrors.ac_capacity_kw && <span className="form-error">{fieldErrors.ac_capacity_kw}</span>}
            </div>
          </div>

          {/* Archive Toggle if Editing */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="is_archived" 
                name="is_archived" 
                checked={formData.is_archived} 
                onChange={handleChange}
                style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
              />
              <label 
                htmlFor="is_archived" 
                style={{ fontSize: '14px', fontWeight: 500, color: '#334155', margin: 0, cursor: 'pointer' }}
              >
                Archive this package
              </label>
            </div>
          )}

          {/* Row 4: Description (Full Width) */}
          <div className="flex flex-col gap-1">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Description <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <textarea 
              name="description" 
              rows={3}
              value={formData.description || ''} 
              onChange={handleChange} 
              placeholder="Add details or notes about this package..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '16px',
              marginTop: '8px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button variant="secondary" type="button" onClick={() => navigate('/packages')}>
                Cancel
              </Button>
              {isEditing && (
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  style={{ borderColor: '#fee2e2', color: '#dc2626', backgroundColor: '#ffffff' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  {deleting ? 'Deleting...' : 'Delete Package'}
                </Button>
              )}
            </div>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={saving || !isChanged} 
              title={!isChanged ? 'Make changes to save' : undefined}
            >
              {saving ? 'Saving...' : 'Save Package'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
