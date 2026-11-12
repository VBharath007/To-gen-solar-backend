import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import type { CreateProductDto } from '@shared/types/product.types';

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<Partial<CreateProductDto> & { is_archived?: boolean }>({
    category: isEditing ? 'Solar Panel' : '',
    brand: '',
    model: '',
    specs: '',
    unit: isEditing ? 'Pieces' : '',
    price: undefined,
    tax_rate: undefined,
    is_archived: false
  });
  const [originalData, setOriginalData] = useState<any | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    category?: string;
    brand?: string;
    model?: string;
    specs?: string;
    unit?: string;
    price?: string;
  }>({});
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && id) {
      loadProduct(Number(id));
    }
  }, [id, isEditing]);

  const loadProduct = async (productId: number) => {
    try {
      const res = await window.desktop.products.get(productId);
      if (res.success) {
        const initial = {
          category: res.data.category || '',
          brand: res.data.brand || '',
          model: res.data.model || '',
          specs: res.data.specs || '',
          unit: res.data.unit || '',
          price: res.data.price != null ? res.data.price / 100 : undefined, // Convert paise to INR for form
          tax_rate: res.data.tax_rate ?? undefined,
          is_archived: Boolean(res.data.is_archived)
        };
        setFormData(initial);
        setOriginalData(initial);
      } else {
        setError(res.error?.message || 'Failed to load product');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const isChanged = useMemo(() => {
    if (!isEditing) {
      return Boolean(formData.brand?.trim() || formData.model?.trim() || formData.price !== undefined);
    }
    if (!originalData) return false;

    return (
      (formData.category || '') !== (originalData.category || '') ||
      (formData.brand || '') !== (originalData.brand || '') ||
      (formData.model || '') !== (originalData.model || '') ||
      (formData.specs || '') !== (originalData.specs || '') ||
      (formData.unit || '') !== (originalData.unit || '') ||
      Number(formData.price ?? 0) !== Number(originalData.price ?? 0) ||
      Boolean(formData.is_archived) !== Boolean(originalData.is_archived)
    );
  }, [isEditing, originalData, formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'brand' || name === 'model') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else if (type === 'number') {
      const val = value === '' ? undefined : Number(value);
      setFormData(prev => ({ ...prev, [name]: val }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    if (!formData.category?.trim()) {
      errs.category = 'Please select a product category.';
    }

    if (!formData.brand?.trim() || formData.brand.trim().length < 2) {
      errs.brand = 'Brand name is required (minimum 2 characters).';
    }

    if (!formData.model?.trim() || formData.model.trim().length < 2) {
      errs.model = 'Model is required (minimum 2 characters).';
    }

    if (!formData.specs?.trim()) {
      errs.specs = 'Specifications are required.';
    }

    if (!formData.unit?.trim()) {
      errs.unit = 'Please select a unit of measurement.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      const msg = 'Please fill in all mandatory fields (Category, Brand, Model, Specifications, Unit) correctly.';
      setError(msg);
      await showAlert({
        type: 'error',
        title: 'Missing Required Information',
        description: 'Please complete all required fields (Category, Brand, Model, Specifications, and Unit) before saving the product.',
      });
      return;
    }

    if (isEditing) {
      const confirmed = await showConfirm({
        type: 'confirmation',
        title: 'Save Product Changes',
        description: `Are you sure you want to save the updated changes for "${(formData.brand || '').toUpperCase()} ${(formData.model || '').toUpperCase()}"?`,
        confirmLabel: 'Save Changes',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        brand: (formData.brand || '').trim().toUpperCase(),
        model: (formData.model || '').trim().toUpperCase(),
        price: null // Amount is not required in product catalog, added manually in quotations
      };

      let res;
      if (isEditing && id) {
        res = await window.desktop.products.update({ id: Number(id), ...(payload as any) });
      } else {
        res = await window.desktop.products.create(payload as any);
      }

      if (res.success) {
        navigate('/products');
      } else {
        setError(res.error?.message || 'Failed to save product');
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
      title: 'Delete Product',
      description: `Are you sure you want to permanently delete this product? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.products.delete(Number(id));
      if (res.success) {
        navigate('/products');
      } else {
        setError(res.error?.message || 'Failed to delete product');
      }
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading product...</div>;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <PageHeader 
          title={isEditing ? "Edit Product" : "New Product"} 
          breadcrumbs={[{ label: 'Products', to: '/products' }, { label: isEditing ? 'Edit' : 'New' }]}
        />
        {isEditing && (
          <Button type="button" variant="danger" onClick={handleDelete} className="shadow-sm">
            Delete Product
          </Button>
        )}
      </div>

      <Card>
        {error && <Alert type="error" message={error} className="mb-4" />}
        
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Category <span className="text-danger">*</span>
              </label>
              <select 
                name="category" 
                value={formData.category || ''} 
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.category) {
                    setFieldErrors(p => ({ ...p, category: e.target.value.trim() ? undefined : 'Please select a product category.' }));
                  }
                }}
                onBlur={() => {
                  if (!formData.category?.trim()) {
                    setFieldErrors(p => ({ ...p, category: 'Please select a product category.' }));
                  }
                }}
                className={`input-field ${fieldErrors.category ? 'input-error' : ''}`} 
                required
              >
                <option value="">Select category...</option>
                <option value="Solar Panel">Solar Panel</option>
                <option value="Inverter">Inverter</option>
                <option value="Battery">Battery</option>
                <option value="Structure">Structure</option>
                <option value="Cabling">Cabling</option>
                <option value="Accessories">Accessories</option>
                <option value="Labor">Labor/Service</option>
                <option value="Street Light">Street Light</option>
                <option value="Camera">Camera</option>
              </select>
              {fieldErrors.category && <span className="form-error">{fieldErrors.category}</span>}
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Brand <span className="text-danger">*</span>
              </label>
              <input 
                type="text" 
                name="brand" 
                value={formData.brand || ''} 
                onChange={handleChange} 
                style={{ textTransform: 'uppercase' }}
                onBlur={() => {
                  if (!formData.brand?.trim()) {
                    setFieldErrors(p => ({ ...p, brand: 'Brand name is required (minimum 2 characters).' }));
                  } else if (formData.brand.trim().length < 2) {
                    setFieldErrors(p => ({ ...p, brand: 'Brand name must be at least 2 characters.' }));
                  }
                }}
                className={`input-field uppercase ${fieldErrors.brand ? 'input-error' : ''}`} 
                required 
                placeholder="e.g. LUMINOUS" 
              />
              {fieldErrors.brand && <span className="form-error">{fieldErrors.brand}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">
              Model <span className="text-danger">*</span>
            </label>
            <input 
              type="text" 
              name="model" 
              value={formData.model || ''} 
              onChange={handleChange} 
              style={{ textTransform: 'uppercase' }}
              onBlur={() => {
                if (!formData.model?.trim()) {
                  setFieldErrors(p => ({ ...p, model: 'Model is required (minimum 2 characters).' }));
                } else if (formData.model.trim().length < 2) {
                  setFieldErrors(p => ({ ...p, model: 'Model must be at least 2 characters.' }));
                }
              }}
              className={`input-field uppercase ${fieldErrors.model ? 'input-error' : ''}`} 
              required 
              placeholder="e.g. LUM-330W-POLY" 
            />
            {fieldErrors.model && <span className="form-error">{fieldErrors.model}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">
              Specifications <span className="text-danger">*</span>
            </label>
            <textarea 
              name="specs" 
              value={formData.specs || ''} 
              onChange={e => {
                handleChange(e);
                if (fieldErrors.specs) {
                  setFieldErrors(p => ({ ...p, specs: e.target.value.trim() ? undefined : 'Specifications are required.' }));
                }
              }} 
              onBlur={() => {
                if (!formData.specs?.trim()) {
                  setFieldErrors(p => ({ ...p, specs: 'Specifications are required.' }));
                }
              }}
              className={`input-field min-h-[80px] ${fieldErrors.specs ? 'input-error' : ''}`} 
              placeholder="Technical details (e.g. 540W Mono PERC, 24V, IP65)..."
              required
            />
            {fieldErrors.specs && <span className="form-error">{fieldErrors.specs}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">
              Unit <span className="text-danger">*</span>
            </label>
            <select 
              name="unit" 
              value={formData.unit || ''} 
              onChange={e => {
                handleChange(e);
                if (fieldErrors.unit) {
                  setFieldErrors(p => ({ ...p, unit: e.target.value.trim() ? undefined : 'Please select a unit of measurement.' }));
                }
              }} 
              onBlur={() => {
                if (!formData.unit?.trim()) {
                  setFieldErrors(p => ({ ...p, unit: 'Please select a unit of measurement.' }));
                }
              }}
              className={`input-field ${fieldErrors.unit ? 'input-error' : ''}`} 
              required
            >
              <option value="">Select unit...</option>
              <option value="Pieces">Pieces</option>
              <option value="Meters">Meters</option>
              <option value="Watts">Watts</option>
              <option value="kW">kW</option>
              <option value="Lump Sum">Lump Sum</option>
            </select>
            {fieldErrors.unit && <span className="form-error">{fieldErrors.unit}</span>}
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="is_archived" name="is_archived" checked={formData.is_archived} onChange={handleChange} />
              <label htmlFor="is_archived" className="text-sm text-secondary">Archive this product (Hide from new packages)</label>
            </div>
          )}

          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t flex-wrap">
            <Button variant="secondary" type="button" onClick={() => navigate('/products')}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving || !isChanged} title={!isChanged ? 'Make changes to save' : undefined}>
              {saving ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
