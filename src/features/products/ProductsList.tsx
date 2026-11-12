import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAlert } from '../../context/AlertContext';
import type { Product } from '@shared/types/product.types';

export default function ProductsList() {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlert();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.products.list(true); // Include archived products
      if (res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      } else {
        setProducts([]);
        if (!res.success) setError(res.error?.message || 'Failed to load products');
      }
    } catch (err) {
      setError(String(err));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (p: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const willArchive = !p.is_archived;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: willArchive ? 'Archive Product' : 'Restore Product',
      description: willArchive
        ? `Are you sure you want to archive "${p.brand} - ${p.model}"? It will be hidden from new packages and quotations.`
        : `Do you want to restore "${p.brand} - ${p.model}" back to active inventory?`,
      confirmLabel: willArchive ? 'Archive' : 'Restore to Active',
      cancelLabel: 'Cancel',
      isDestructive: willArchive,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.products.archive(p.id, willArchive);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: willArchive ? 'Product Archived' : 'Product Restored',
          description: willArchive
            ? `"${p.brand} - ${p.model}" has been moved to Archived.`
            : `"${p.brand} - ${p.model}" is now active in inventory.`,
        });
        await fetchProducts();
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

  const handleDelete = async (p: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Product',
      description: `Are you sure you want to permanently delete "${p.brand} - ${p.model}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.products.delete(p.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Product Deleted',
          description: `Product "${p.brand} - ${p.model}" has been deleted successfully.`,
        });
        await fetchProducts();
      } else {
        await showAlert({
          type: 'error',
          title: 'Cannot Delete Product',
          description: res.error?.message || 'Failed to delete product. It may be used in existing quotations or packages.'
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

  const counts = useMemo(() => {
    const active = products.filter(p => !p.is_archived).length;
    const archived = products.filter(p => Boolean(p.is_archived)).length;
    return { active, archived };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = statusFilter === 'ARCHIVED' 
      ? products.filter(p => Boolean(p.is_archived))
      : products.filter(p => !p.is_archived);

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.brand?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.specs?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, statusFilter, searchTerm]);

  const columns: Column<Product>[] = [
    { 
      header: 'Brand & Model', 
      accessor: (p) => (
        <div>
          <div className="font-semibold uppercase">{p.brand}</div>
          <div className="text-sm text-secondary uppercase">{p.model}</div>
        </div>
      ),
      width: '24%'
    },
    { header: 'Category', accessor: 'category', width: '16%' },
    { header: 'Specs', accessor: (p) => <div className="text-sm">{p.specs || '-'}</div>, width: '18%' },
    { header: 'Unit', accessor: 'unit', width: '12%' },
    { 
      header: 'Status', 
      accessor: (p) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            gap: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: !p.is_archived ? '#16a34a' : '#64748b',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: !p.is_archived ? '#16a34a' : '#94a3b8',
              display: 'inline-block',
            }}
          />
          {!p.is_archived ? 'Active' : 'Archived'}
        </span>
      ),
      width: '12%'
    },
    { 
      header: 'Actions', 
      accessor: (p) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            onClick={() => navigate(`/products/${p.id}/edit`)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#16a34a',
              borderColor: '#16a34a',
              backgroundColor: '#ffffff'
            }}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={(e) => handleToggleArchive(p, e)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#64748b',
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff'
            }}
          >
            {p.is_archived ? 'Restore' : 'Archive'}
          </Button>
          <Button
            variant="outline"
            onClick={(e) => handleDelete(p, e)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#dc2626',
              borderColor: '#fecaca',
              backgroundColor: '#ffffff'
            }}
          >
            Delete
          </Button>
        </div>
      ),
      width: '220px'
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Products Inventory" 
        description="Manage your individual solar components, panels, inverters and balances of system."
        action={<Button variant="primary" onClick={() => navigate('/products/new')}> Add Product</Button>}
      />

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Quick Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {[
          { label: 'All Products', value: 'ALL' as const, count: counts.active, dotColor: '#0b75b9' },
          { label: 'Archived', value: 'ARCHIVED' as const, count: counts.archived, dotColor: '#64748b' },
        ].map(tab => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: isActive ? '1.5px solid #0b75b9' : '1px solid #dbe7f3',
                backgroundColor: isActive ? '#f0f7fe' : '#ffffff',
                color: isActive ? '#0b75b9' : '#506e8c',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 1px 4px rgba(11, 117, 185, 0.12)' : 'none'
              }}
            >
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: tab.dotColor,
                display: 'inline-block'
              }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-8 text-center text-secondary">Loading products...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={filteredProducts}
          keyExtractor={row => row.id}
          searchPlaceholder="Search products by brand, model or category..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          emptyState={
            <EmptyState
              title={statusFilter === 'ARCHIVED' ? 'No archived products' : 'No products found'}
              description={
                statusFilter === 'ARCHIVED' 
                  ? 'Products you archive in the catalog will appear here safely preserved for past records.'
                  : 'Manage your individual solar components, panels, inverters and balances of system.'
              }
              action={
                statusFilter !== 'ARCHIVED' ? (
                  <Button variant="primary" onClick={() => navigate('/products/new')}>
                    + Add Product
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
    </div>
  );
}
