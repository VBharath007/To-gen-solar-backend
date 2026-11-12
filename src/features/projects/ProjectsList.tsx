import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/formatters';
import type { Project } from '@shared/types/project.types';

type ProjectFilter = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'PENDING';

export default function ProjectsList() {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlert();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>('ALL');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.projects.list();
      if (res.success && Array.isArray(res.data)) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
    } catch (err) {
      setError(String(err));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (p: Project) => {
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Project',
      description: `Are you sure you want to delete project "${p.reference}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.projects.delete(p.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Project Deleted',
          description: `Project "${p.reference}" has been deleted successfully.`,
        });
        await fetchProjects();
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete project',
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

  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter(p => p.stage === 'In Progress' || !p.stage).length;
    const completed = projects.filter(p => p.stage === 'Complete').length;
    const pending = projects.filter(p => p.stage === 'Pending' || p.payment_status === 'Pending').length;
    return {
      total: String(total).padStart(2, '0'),
      inProgress: String(inProgress).padStart(2, '0'),
      completed: String(completed).padStart(2, '0'),
      pending: String(pending).padStart(2, '0')
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'IN_PROGRESS') {
      return projects.filter(p => p.stage === 'In Progress' || !p.stage);
    }
    if (activeFilter === 'COMPLETED') {
      return projects.filter(p => p.stage === 'Complete');
    }
    if (activeFilter === 'PENDING') {
      return projects.filter(p => p.stage === 'Pending' || p.payment_status === 'Pending');
    }
    return projects;
  }, [projects, activeFilter]);

  const getPaymentBadge = (status: string) => {
    if (status === 'Paid') {
      return <Badge variant="success">Paid</Badge>;
    }
    if (status === 'Partial') {
      return <Badge variant="info">Partial</Badge>;
    }
    return <Badge variant="warning">Pending</Badge>;
  };

  const columns: Column<Project>[] = [
    { 
      header: 'Project Ref', 
      accessor: (p) => (
        <span style={{ color: '#1b6e38', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {p.reference}
        </span>
      ) 
    },
    { 
      header: 'Customer & Site', 
      accessor: (p) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0b2546' }}>{p.customerName || '-'}</div>
          <div style={{ fontSize: '0.78rem', color: '#506e8c' }}>{p.siteName || '-'}</div>
        </div>
      ) 
    },
    { 
      header: 'Quotation Ref', 
      accessor: (p) => <span style={{ color: '#506e8c' }}>{p.quotation_ref || '-'}</span> 
    },
    { 
      header: 'Date', 
      accessor: (p) => <span style={{ color: '#506e8c' }}>{p.target_date ? formatDate(p.target_date) : '-'}</span> 
    },
    {
      header: 'Stage',
      accessor: (p) => {
        let variant = 'default';
        if (p.stage === 'Complete') variant = 'success';
        if (p.stage === 'Reject') variant = 'danger';
        if (p.stage === 'In Progress') variant = 'info';
        if (p.stage === 'Pending') variant = 'warning';
        return <Badge variant={variant as any}>{p.stage || 'In Progress'}</Badge>;
      }
    },
    { 
      header: 'Payment Status', 
      accessor: (p) => getPaymentBadge(p.payment_status) 
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/projects/${p.id}`)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            View
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate(`/projects/${p.id}/edit`)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            Edit
          </Button>
          <Button 
            variant="danger" 
            onClick={() => handleDelete(p)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            Delete
          </Button>
        </div>
      ),
      width: '260px'
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Installation Projects" 
        description="Track active solar installations, milestones, and project checklists."
        action={
          <Button 
            variant="primary" 
            onClick={() => navigate('/projects/new')}
            style={{ 
              borderRadius: '8px', 
              padding: '0.55rem 1.25rem', 
              fontSize: '0.875rem', 
              fontWeight: 600,
              gap: '8px'
            }}
          >
            <span>+</span> New Project
          </Button>
        }
      />

      {error && <div className="text-danger mb-4">{error}</div>}

      {/* 4 Stat Cards (Clickable Filters) */}
      <div className="kpi-grid kpi-grid-4">
        {/* Card 1: Total Projects */}
        <div 
          className="kpi-card"
          onClick={() => setActiveFilter('ALL')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'ALL' ? '2px solid #0b75b9' : '1px solid #dbe7f3',
            backgroundColor: activeFilter === 'ALL' ? '#f0f7fe' : '#ffffff',
            boxShadow: activeFilter === 'ALL' ? '0 4px 14px rgba(11, 117, 185, 0.14)' : undefined,
            transform: activeFilter === 'ALL' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease',
          }}
          title="Click to view all projects"
        >
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: activeFilter === 'ALL' ? '#0b75b9' : '#e1f0fa',
              color: activeFilter === 'ALL' ? '#ffffff' : '#0b75b9',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Total Projects</div>
            <div className="kpi-card-value" style={{ color: '#0b75b9' }}>{stats.total}</div>
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div 
          className="kpi-card"
          onClick={() => setActiveFilter(prev => prev === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'IN_PROGRESS' ? '2px solid #0b75b9' : '1px solid #dbe7f3',
            backgroundColor: activeFilter === 'IN_PROGRESS' ? '#f0f7fe' : '#ffffff',
            boxShadow: activeFilter === 'IN_PROGRESS' ? '0 4px 14px rgba(11, 117, 185, 0.16)' : undefined,
            transform: activeFilter === 'IN_PROGRESS' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease',
          }}
          title={activeFilter === 'IN_PROGRESS' ? 'Click to cancel filter' : 'Click to filter In Progress projects'}
        >
          {activeFilter === 'IN_PROGRESS' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilter('ALL');
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#0b75b9',
                color: '#ffffff',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Cancel filter"
            >
              ✕
            </span>
          )}
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: activeFilter === 'IN_PROGRESS' ? '#0b75b9' : '#e1f0fa',
              color: activeFilter === 'IN_PROGRESS' ? '#ffffff' : '#0b75b9',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">In Progress</div>
            <div className="kpi-card-value" style={{ color: '#0b75b9' }}>{stats.inProgress}</div>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div 
          className="kpi-card"
          onClick={() => setActiveFilter(prev => prev === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'COMPLETED' ? '2px solid #16a34a' : '1px solid #dbe7f3',
            backgroundColor: activeFilter === 'COMPLETED' ? '#f0fdf4' : '#ffffff',
            boxShadow: activeFilter === 'COMPLETED' ? '0 4px 14px rgba(22, 163, 74, 0.16)' : undefined,
            transform: activeFilter === 'COMPLETED' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease',
          }}
          title={activeFilter === 'COMPLETED' ? 'Click to cancel filter' : 'Click to filter Completed projects'}
        >
          {activeFilter === 'COMPLETED' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilter('ALL');
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Cancel filter"
            >
              ✕
            </span>
          )}
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: activeFilter === 'COMPLETED' ? '#16a34a' : '#e2f7e5',
              color: activeFilter === 'COMPLETED' ? '#ffffff' : '#2e8b38',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Completed</div>
            <div className="kpi-card-value" style={{ color: '#1b5e20' }}>{stats.completed}</div>
          </div>
        </div>

        {/* Card 4: Pending */}
        <div 
          className="kpi-card"
          onClick={() => setActiveFilter(prev => prev === 'PENDING' ? 'ALL' : 'PENDING')}
          style={{
            cursor: 'pointer',
            border: activeFilter === 'PENDING' ? '2px solid #d97706' : '1px solid #dbe7f3',
            backgroundColor: activeFilter === 'PENDING' ? '#fffbeb' : '#ffffff',
            boxShadow: activeFilter === 'PENDING' ? '0 4px 14px rgba(217, 119, 6, 0.16)' : undefined,
            transform: activeFilter === 'PENDING' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease',
          }}
          title={activeFilter === 'PENDING' ? 'Click to cancel filter' : 'Click to filter Pending projects'}
        >
          {activeFilter === 'PENDING' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilter('ALL');
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#d97706',
                color: '#ffffff',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Cancel filter"
            >
              ✕
            </span>
          )}
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: activeFilter === 'PENDING' ? '#d97706' : '#e1f0fa',
              color: activeFilter === 'PENDING' ? '#ffffff' : '#0b75b9',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Pending</div>
            <div className="kpi-card-value" style={{ color: '#0b75b9' }}>{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Active Filter Bar with Right Corner Cancel Button */}
      {activeFilter !== 'ALL' && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1.25rem',
          marginBottom: '0.75rem',
          padding: '0.65rem 1rem',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #dbe7f3',
          boxShadow: '0 2px 6px rgba(11, 117, 185, 0.05)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filter:</span>
            <Badge variant={activeFilter === 'COMPLETED' ? 'success' : activeFilter === 'PENDING' ? 'warning' : 'info'}>
              {activeFilter === 'IN_PROGRESS' ? 'In Progress' : activeFilter === 'COMPLETED' ? 'Completed' : 'Pending'}
            </Badge>
            <span style={{ color: '#475569', fontSize: '0.825rem', fontWeight: 500 }}>
              (Showing {filteredProjects.length} of {projects.length} projects)
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => setActiveFilter('ALL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.4rem 0.95rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#dc2626',
              borderColor: '#fca5a5',
              backgroundColor: '#fff5f5',
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Cancel filter and show all projects"
          >
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>✕</span> Cancel Filter
          </Button>
        </div>
      )}

      {/* Main Table: Projects List */}
      <div>
        {loading ? (
           <div className="p-8 text-center text-secondary">Loading projects...</div>
        ) : (
          <DataTable 
            columns={columns}
            data={filteredProjects}
            keyExtractor={row => row.id}
            searchPlaceholder="Search projects..."
            onRowClick={row => {
               navigate(`/projects/${row.id}`);
            }}
            emptyState={
              <EmptyState
                title={activeFilter !== 'ALL' ? `No ${activeFilter === 'IN_PROGRESS' ? 'In Progress' : activeFilter === 'COMPLETED' ? 'Completed' : 'Pending'} projects found` : "No installation projects found"}
                description={activeFilter !== 'ALL' ? "Try canceling the filter or clearing the search to view all projects." : "Create a new installation project to start tracking milestones, equipment, and stage progress."}
                action={
                  activeFilter !== 'ALL' ? (
                    <Button variant="outline" onClick={() => setActiveFilter('ALL')}>
                      ✕ Cancel Filter
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => navigate('/projects/new')}>
                      + New Project
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </div>

      {/* Quick Detail Preview (Commented out)
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #dbe7f3',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(11, 117, 185, 0.05)'
      }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1rem', 
          fontWeight: 700, 
          color: '#0b2546' 
        }}>
          Quick Detail Preview
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '84px',
            height: '56px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="44" height="40" viewBox="0 0 44 40" fill="none">
              <rect x="2" y="10" width="40" height="24" rx="2" fill="#0369a1" stroke="#38bdf8" strokeWidth="1" />
              <line x1="15" y1="10" x2="15" y2="34" stroke="#7dd3fc" strokeWidth="1" />
              <line x1="28" y1="10" x2="28" y2="34" stroke="#7dd3fc" strokeWidth="1" />
              <line x1="2" y1="22" x2="42" y2="22" stroke="#7dd3fc" strokeWidth="1" />
              <circle cx="34" cy="7" r="4" fill="#fbbf24" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0b2546' }}>
              TG-2024-003
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0b2546' }}>
              Sunrise Retail
            </div>
            <div style={{ fontSize: '0.7rem', color: '#506e8c', marginBottom: '4px' }}>
              Phoenix, AZ
            </div>
            <div>
              <Badge variant="success">
                Commissioning
              </Badge>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}>
              <span style={{ color: '#2e8b38' }}>☀️</span> System Capacity
            </span>
            <span style={{ fontWeight: 600, color: '#0b2546' }}>25 kW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}>
              <span style={{ color: '#2e8b38' }}>📅</span> Date
            </span>
            <span style={{ fontWeight: 600, color: '#0b2546' }}>
              Mar 28, 2025
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}>
              <span style={{ color: '#2e8b38' }}>👤</span> Customer
            </span>
            <span style={{ fontWeight: 600, color: '#0b2546' }}>
              Sunrise Retail
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}>
              <span style={{ color: '#2e8b38' }}>📍</span> Site Address
            </span>
            <span style={{ fontWeight: 600, color: '#0b2546', textAlign: 'right', maxWidth: '140px' }}>
              123 Solar Way Phoenix, AZ 85004
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #edf4fb', paddingTop: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0b2546', marginBottom: '0.75rem' }}>
            Project Milestones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.775rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#506e8c' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2e8b38', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                Site Survey
              </span>
              <span style={{ color: '#0b2546', fontWeight: 500 }}>Jan 10, 2025</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#506e8c' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2e8b38', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                Design & Approval
              </span>
              <span style={{ color: '#0b2546', fontWeight: 500 }}>Feb 05, 2025</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#506e8c' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#2e8b38', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                Installation
              </span>
              <span style={{ color: '#0b2546', fontWeight: 500 }}>Mar 01, 2025</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#506e8c' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #2e8b38', display: 'inline-block' }}></span>
                Commissioning
              </span>
              <span style={{ color: '#2e8b38', fontWeight: 700 }}>In Progress</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8fa3bb' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'inline-block' }}></span>
                Handover
              </span>
              <span style={{ color: '#8fa3bb' }}>Pending</span>
            </div>
          </div>
        </div>

        <Button 
          variant="secondary" 
          onClick={() => navigate('/projects')}
          style={{ 
            width: '100%', 
            borderColor: '#2e8b38', 
            color: '#2e8b38', 
            borderRadius: '8px', 
            fontWeight: 600,
            fontSize: '0.85rem',
            padding: '0.6rem 1rem',
            justifyContent: 'center'
          }}
        >
          View Full Project Details &gt;
        </Button>
      </div>
      */}
    </div>
  );
}
