import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import type { Lead } from '@shared/types/lead.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { DataTable } from '../../components/common/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { leadApi } from './lead.api';
import { formatDateDMY } from '../../utils/formatters';

const STATUS_CONFIG: { label: string; value: string; dotColor: string }[] = [
  { label: 'All Statuses', value: 'ALL', dotColor: '#0b75b9' },
  { label: 'New', value: 'New', dotColor: '#2563eb' },
  { label: 'Contacted', value: 'Contacted', dotColor: '#d97706' },
  { label: 'Qualified', value: 'Qualified', dotColor: '#16a34a' },
  { label: 'Converted', value: 'Converted', dotColor: '#9333ea' },
  { label: 'Lost', value: 'Lost', dotColor: '#dc2626' },
];

export default function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const { showConfirm, showAlert } = useAlert();
  const navigate = useNavigate();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await leadApi.list();
      setLeads(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (l: Lead, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Lead',
      description: `Are you sure you want to permanently delete lead "${l.name}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.leads.delete(l.id);
      if (res.success) {
        await loadLeads();
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


  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesStatus = statusFilter === 'ALL' || l.status.toLowerCase() === statusFilter.toLowerCase();
      if (!matchesStatus) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        l.name.toLowerCase().includes(term) ||
        l.phone.includes(term) ||
        (l.email && l.email.toLowerCase().includes(term)) ||
        (l.source && l.source.toLowerCase().includes(term)) ||
        l.status.toLowerCase().includes(term)
      );
    });
  }, [leads, statusFilter, searchTerm]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'New': return '#2563eb';
      case 'Contacted': return '#d97706';
      case 'Qualified': return '#16a34a';
      case 'Converted': return '#9333ea';
      case 'Lost': return '#dc2626';
      default: return '#4b5563';
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as keyof Lead, width: '70px' },
    { header: 'Name', accessor: 'name' as keyof Lead },
    { header: 'Phone', accessor: 'phone' as keyof Lead },
    { header: 'Email', accessor: (l: Lead) => l.email || '-' },
    { 
      header: 'Status', 
      accessor: (l: Lead) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setStatusFilter(prev => prev === l.status ? 'ALL' : l.status);
          }}
          className="text-xs font-semibold"
          style={{ 
            background: 'transparent',
            backgroundColor: 'transparent',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer', 
            whiteSpace: 'nowrap',
            display: 'inline-block',
            color: getStatusColor(l.status),
            transition: 'opacity 0.15s ease'
          }}
          title={`Click to filter by status "${l.status}"`}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {l.status}
        </button>
      ) 
    },
    { header: 'Source', accessor: (l: Lead) => l.source || '-' },
    { header: 'Added', accessor: (l: Lead) => formatDateDMY(l.createdAt) },
    {
      header: 'Actions',
      accessor: (l: Lead) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px' }}>
          <Button
            variant="outline"
            onClick={() => navigate(`/leads/${l.id}`)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#0b75b9',
              borderColor: '#0b75b9',
              backgroundColor: '#ffffff'
            }}
            title="View Lead Details"
          >
            View
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/leads/${l.id}/edit`)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#16a34a',
              borderColor: '#16a34a',
              backgroundColor: '#ffffff'
            }}
            title="Edit Lead"
          >
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={(e) => handleDelete(l, e)}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              color: '#dc2626',
              borderColor: '#fecaca',
              backgroundColor: '#ffffff'
            }}
            title="Delete Lead"
          >
            Delete
          </Button>
        </div>
      ),
      width: '260px'
    }
  ];

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Leads" 
        description="Manage your prospective customers and sales pipeline."
        action={
          <Button variant="primary" onClick={() => navigate('/leads/new')}>
            + New Lead
          </Button>
        }
      />

      {error && <Alert type="error" message={error} className="mb-6" />}

      {/* Quick Status Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {STATUS_CONFIG.map(st => {
          const isActive = statusFilter === st.value;
          return (
            <button
              key={st.value}
              type="button"
              onClick={() => setStatusFilter(st.value)}
              style={{
                padding: '0.45rem 0.85rem',
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
                backgroundColor: st.dotColor,
                display: 'inline-block'
              }} />
              <span>{st.label === 'All Statuses' ? 'All' : st.label}</span>
            </button>
          );
        })}
      </div>

      <DataTable 
        columns={columns}
        data={filteredLeads}
        keyExtractor={(row) => row.id.toString()}
        searchPlaceholder="Search leads by name, phone, email, source..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#55728f', fontWeight: 600 }}>
              <Filter size={13} style={{ color: '#0b75b9' }} />
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: statusFilter !== 'ALL' ? '1.5px solid #0b75b9' : '1px solid #d4e5f5',
                backgroundColor: statusFilter !== 'ALL' ? '#f0f7fe' : '#ffffff',
                color: statusFilter !== 'ALL' ? '#0b75b9' : 'var(--text-primary)',
                fontWeight: statusFilter !== 'ALL' ? 600 : 400,
                fontSize: '0.825rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Converted">Converted</option>
              <option value="Lost">Lost</option>
            </select>
            {statusFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #fee2e2',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Clear status filter"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        }
        emptyState={
          <EmptyState 
            icon="🎯"
            title="No leads found"
            description={
              statusFilter !== 'ALL' || searchTerm
                ? `No leads match ${statusFilter !== 'ALL' ? `status "${statusFilter}"` : ''}${statusFilter !== 'ALL' && searchTerm ? ' and ' : ''}${searchTerm ? `search "${searchTerm}"` : ''}.`
                : "You haven't added any leads yet."
            }
            action={
              (statusFilter !== 'ALL' || searchTerm) ? (
                <Button variant="secondary" onClick={() => { setStatusFilter('ALL'); setSearchTerm(''); }}>
                  Reset Filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/leads/new')}>
                  Add First Lead
                </Button>
              )
            }
          />
        }
      />
    </div>
  );
}



