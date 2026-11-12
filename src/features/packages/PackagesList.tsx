import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAlert } from '../../context/AlertContext';
import type { Package } from '@shared/types/package.types';

export default function PackagesList() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.packages.list(true);
      if (res.success) {
        setPackages(res.data);
      } else {
        setError(res.error?.message || 'Failed to load packages');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (pkg: Package, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const willArchive = !pkg.is_archived;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: willArchive ? 'Archive Package' : 'Restore Package',
      description: willArchive
        ? `Are you sure you want to archive package "${pkg.name}"? It will be hidden from new quotations.`
        : `Do you want to restore package "${pkg.name}" back to active packages?`,
      confirmLabel: willArchive ? 'Archive' : 'Restore to Active',
      cancelLabel: 'Cancel',
      isDestructive: willArchive,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.packages.archive(pkg.id, willArchive);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: willArchive ? 'Package Archived' : 'Package Restored',
          description: willArchive
            ? `Package "${pkg.name}" has been archived.`
            : `Package "${pkg.name}" is now active.`,
        });
        await fetchPackages();
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

  const handleDelete = async (pkg: Package, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Package',
      description: `Are you sure you want to permanently delete package "${pkg.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Package',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    setDeletingId(pkg.id);
    try {
      const res = await window.desktop.packages.delete(pkg.id);
      if (res.success) {
        setPackages(prev => prev.filter(p => p.id !== pkg.id));
        await showAlert({
          type: 'success',
          title: 'Package Deleted',
          description: `Package "${pkg.name}" has been deleted successfully.`,
        });
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete package',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Delete Failed',
        description: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const counts = useMemo(() => {
    const active = packages.filter(p => !p.is_archived).length;
    const archived = packages.filter(p => p.is_archived).length;
    return { active, archived };
  }, [packages]);

  const filteredPackages = useMemo(() => {
    if (statusFilter === 'ARCHIVED') return packages.filter(p => p.is_archived);
    // 'ALL' only shows active packages, NEVER archived packages
    return packages.filter(p => !p.is_archived);
  }, [packages, statusFilter]);

  const columns: Column<Package>[] = [
    { header: 'Package Name', accessor: (p) => <div className="font-semibold uppercase">{p.name}</div>, width: '30%' },
    { header: 'DC Capacity', accessor: (p) => `${p.dc_capacity_kw} kW`, width: '20%' },
    { header: 'AC Capacity', accessor: (p) => `${p.ac_capacity_kw} kW`, width: '20%' },
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
      width: '15%'
    },
    { 
      header: 'Actions', 
      accessor: (p) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/packages/${p.id}/edit`)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            Edit
          </Button>
          {p.is_archived ? (
            <Button
              variant="outline"
              onClick={(e) => handleToggleArchive(p, e)}
              style={{
                color: '#16a34a',
                borderColor: '#bbf7d0',
                backgroundColor: '#f0fdf4',
                padding: '0.35rem 0.75rem',
                fontSize: '0.825rem',
              }}
              title="Restore to Active Packages"
            >
              Restore
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={(e) => handleToggleArchive(p, e)}
              style={{
                color: '#64748b',
                borderColor: '#e2e8f0',
                padding: '0.35rem 0.75rem',
                fontSize: '0.825rem',
              }}
              title="Archive this package"
            >
              Archive
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={(e) => handleDelete(p, e)}
            disabled={deletingId === p.id}
            style={{ 
              borderColor: '#fee2e2', 
              color: '#dc2626', 
              backgroundColor: '#ffffff',
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem' 
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#fee2e2';
            }}
          >
            {deletingId === p.id ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      ),
      width: '220px'
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Standard Packages" 
        description="Manage your standard system packages and component groupings."
        action={<Button variant="primary" onClick={() => navigate('/packages/new')}>+ Create Package</Button>}
      />

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Quick Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {[
          { label: 'All Packages', value: 'ALL' as const, count: counts.active, dotColor: '#0b75b9' },
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
        <div className="p-8 text-center text-secondary">Loading packages...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={filteredPackages}
          keyExtractor={row => row.id}
          searchPlaceholder="Search packages by name..."
          emptyState={
            <EmptyState
              title={statusFilter === 'ARCHIVED' ? 'No archived packages' : 'No packages found'}
              description={
                statusFilter === 'ARCHIVED' 
                  ? 'Packages you archive will appear here safely preserved for past records.'
                  : 'Manage your standard system packages and component groupings.'
              }
              action={
                statusFilter !== 'ARCHIVED' ? (
                  <Button variant="primary" onClick={() => navigate('/packages/new')}>
                    + Create Package
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
