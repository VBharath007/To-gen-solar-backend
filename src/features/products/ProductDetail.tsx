import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Calendar, 
  Clock, 
  Layers, 
  Box, 
  ShieldCheck,
  Tag,
  Archive,
  RotateCcw
} from 'lucide-react';
import type { Product } from '@shared/types/product.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/formatters';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlert();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProduct(Number(id));
    }
  }, [id]);

  const loadProduct = async (productId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await window.desktop.products.get(productId);
      if (res.success) {
        setProduct(res.data);
      } else {
        setError(res.error?.message || 'Failed to load product details');
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!product) return;
    const willArchive = !product.is_archived;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: willArchive ? 'Archive Product' : 'Restore Product',
      description: willArchive
        ? `Are you sure you want to archive "${product.brand} - ${product.model}"? It will be hidden from new packages and proposals.`
        : `Do you want to restore "${product.brand} - ${product.model}" back to active inventory?`,
      confirmLabel: willArchive ? 'Archive' : 'Restore to Active',
      cancelLabel: 'Cancel',
      isDestructive: willArchive,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.products.archive(product.id, willArchive);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: willArchive ? 'Product Archived' : 'Product Restored',
          description: willArchive
            ? `"${product.brand} - ${product.model}" has been moved to Archived.`
            : `"${product.brand} - ${product.model}" is now active in inventory.`,
        });
        loadProduct(product.id);
      } else {
        await showAlert({
          type: 'error',
          title: 'Action Failed',
          description: res.error?.message || 'Failed to update archive status',
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Solar Panel': return '#0284c7';
      case 'Inverter': return '#7c3aed';
      case 'Battery': return '#16a34a';
      case 'Structure': return '#ea580c';
      case 'Cabling': return '#d97706';
      case 'Accessories': return '#475569';
      case 'Street Light': return '#f59e0b';
      case 'Camera': return '#db2777';
      default: return '#0f172a';
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in p-8 text-center text-secondary">
        <div style={{ display: 'inline-block', padding: '2rem' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem auto' }} />
          <p style={{ color: '#64748b' }}>Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="animate-fade-in p-6">
        <Button
          variant="outline"
          className="mb-4 flex items-center gap-2"
          onClick={() => navigate('/products')}
        >
          <ArrowLeft size={16} />
          Back to Products
        </Button>
        <Alert
          type="error"
          message={error || 'Product not found'}
          className="mb-4"
        />
      </div>
    );
  }



  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Navigation & Breadcrumbs */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => navigate('/products')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: '0.75rem',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
        >
          <ArrowLeft size={16} />
          <span>Back to Products</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '0.8rem',
              padding: '3px 9px',
              borderRadius: '6px',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              fontWeight: 600
            }}
          >
            Product #{product.id}
          </span>
          <span
            style={{
              fontSize: '0.8rem',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: '#f1f5f9',
              color: getCategoryColor(product.category),
              fontWeight: 600,
              border: '1px solid #e2e8f0'
            }}
          >
            {product.category}
          </span>
          <Badge variant={!product.is_archived ? 'success' : 'default'}>
            {product.is_archived ? 'Archived' : 'Active'}
          </Badge>
        </div>

        <PageHeader
          title={`${product.brand} - ${product.model}`}
          description={`Catalog component in ${product.category} • Measured per ${product.unit}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Button
                variant="outline"
                onClick={() => navigate('/products')}
              >
                Back to Products
              </Button>
              <Button
                variant="primary"
                className="flex items-center gap-2"
                onClick={() => navigate(`/products/${product.id}/edit`)}
              >
                <Pencil size={15} />
                <span>Edit Product</span>
              </Button>
              {product.is_archived ? (
                <Button
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={handleToggleArchive}
                  style={{ color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
                >
                  <RotateCcw size={15} />
                  <span>Restore to Active</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex items-center gap-2 text-secondary"
                  onClick={handleToggleArchive}
                >
                  <Archive size={15} />
                  <span>Archive</span>
                </Button>
              )}
            </div>
          }
        />

        {product.is_archived && (
          <Alert 
            type="warning" 
            message="This product is currently Archived. It is preserved for past quotations and records, but hidden from new solar package creation."
            className="mt-3"
          />
        )}
      </div>

      {/* Top Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* Category */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Layers size={15} style={{ color: getCategoryColor(product.category) }} />
            <span>Category</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
            {product.category}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
            Product Classification
          </div>
        </div>

        {/* Measurement Unit */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Box size={15} style={{ color: '#0284c7' }} />
            <span>Measurement Unit</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
            {product.unit}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
            Billing & Inventory Unit
          </div>
        </div>

        {/* Component Status */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Tag size={15} style={{ color: '#7c3aed' }} />
            <span>Catalog Status</span>
          </div>
          <div style={{ marginTop: '8px' }}>
            <Badge variant={!product.is_archived ? 'success' : 'default'} className="text-sm px-3 py-1">
              {!product.is_archived ? 'Active for Quotations' : 'Archived'}
            </Badge>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
            {!product.is_archived ? 'Available for new quotations' : 'Hidden from new quotations'}
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Equal, Perfectly Balanced Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Specifications & Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Product Identity */}
          <Card title="Product Specifications & Identity">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginTop: '0.5rem'
              }}
            >
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Brand / Manufacturer
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {product.brand}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Model Number
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {product.model}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Product Category
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                  {product.category}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Unit of Measurement
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                  {product.unit}
                </div>
              </div>

              {product.warranty_years != null && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Warranty
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                    {product.warranty_years} Years
                  </div>
                </div>
              )}

              {product.hsn_sac && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    HSN / SAC Code
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                    {product.hsn_sac}
                  </div>
                </div>
              )}

              {product.sku && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    SKU Code
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                    {product.sku}
                  </div>
                </div>
              )}

              {product.weight_kg != null && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Weight
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                    {product.weight_kg} kg
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Technical Specifications Area */}
          <Card title="Technical Specifications & Notes">
            {product.specs ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem 1.25rem',
                  fontSize: '0.925rem',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {product.specs}
              </div>
            ) : (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                  color: '#94a3b8',
                  fontSize: '0.875rem'
                }}
              >
                No technical specifications or notes recorded for this product.
                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    variant="outline"
                    className="text-xs"
                    onClick={() => navigate(`/products/${product.id}/edit`)}
                  >
                    + Add Specifications
                  </Button>
                </div>
              </div>
            )}
          </Card>

        </div>

        {/* Right Column: Pricing Breakdown & System Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          


          {/* Catalog Status & System Metadata Card */}
          <Card title="Catalog Status & Timeline">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: !product.is_archived ? '#dcfce7' : '#f1f5f9',
                    color: !product.is_archived ? '#15803d' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                    {!product.is_archived ? 'Active for Customer Quotations' : 'Archived Product'}
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>
                    {!product.is_archived 
                      ? 'This item is active in the master inventory and can be freely included in solar package bundles, proposals, and project bill of materials.' 
                      : 'This product has been archived. It is preserved for past records but hidden from new quotation creation.'}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Created On
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem', fontWeight: 500 }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    <span>{formatDateTime(product.created_at) || formatDate(product.created_at)}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Last Modified
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem', fontWeight: 500 }}>
                    <Clock size={14} style={{ color: '#64748b' }} />
                    <span>{formatDateTime(product.updated_at) || formatDate(product.updated_at)}</span>
                  </div>
                </div>
              </div>

            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
