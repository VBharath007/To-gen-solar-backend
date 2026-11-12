import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Project } from '@shared/types/project.types';
import { ProjectAnalyticsItem } from './report.types';
import { enrichProjectAnalytics, calculateReportsSummary } from './report.analytics';
import { generateProjectsAnalyticsReportPDF } from '../../utils/reportPdfGenerator';
import { ProjectReportModal } from './ProjectReportModal';

export default function ReportsCenter() {
  const [projects, setProjects] = useState<ProjectAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProject, setViewingProject] = useState<ProjectAnalyticsItem | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');

  useEffect(() => {
    loadProjectsData();
  }, []);

  const loadProjectsData = async () => {
    setLoading(true);
    try {
      let rawProjects: Project[] = [];
      if (window.desktop?.projects?.list) {
        const res = await window.desktop.projects.list();
        if (res.success && res.data) {
          rawProjects = res.data;
        }
      }

      const enriched = enrichProjectAnalytics(rawProjects);
      setProjects(enriched);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchStage = stageFilter === 'ALL' || p.stage === stageFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        p.reference.toLowerCase().includes(q) ||
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.siteName && p.siteName.toLowerCase().includes(q)) ||
        (p.quotation_ref && p.quotation_ref.toLowerCase().includes(q));

      return matchStage && matchQuery;
    });
  }, [projects, stageFilter, searchQuery]);

  // Overall analytics summary
  const summary = useMemo(() => {
    return calculateReportsSummary(projects);
  }, [projects]);

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      await generateProjectsAnalyticsReportPDF(
        filteredProjects,
        summary,
        { stageFilter, searchQuery }
      );
    } catch (err) {
      console.error('Failed to export PDF report', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const collectionPercent = summary.totalRevenue > 0 
    ? Math.round((summary.collectedRevenue / summary.totalRevenue) * 100) 
    : 0;

  const pendingPercent = summary.totalRevenue > 0
    ? Math.round((summary.pendingRevenue / summary.totalRevenue) * 100)
    : 0;

  const pendingProjectsCount = projects.filter(p => p.balanceAmount > 0).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Project Performance & Analytics Report"
        description="Comprehensive audit of solar project lifecycles, installed capacity, stage velocity, and financial collections."
        action={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              style={{
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderColor: '#cde1f2',
                color: '#0b2546'
              }}
            >
              <span>🖨️</span> Print Summary
            </Button>
            <Button
              variant="primary"
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              style={{
                borderRadius: '8px',
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                gap: '8px',
                minWidth: '170px',
                justifyContent: 'center'
              }}
            >
              <span>📄</span> {isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}
            </Button>
          </div>
        }
      />

      {/* Top KPI Analytics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Projects */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #dbe7f3',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(11, 117, 185, 0.04)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#e1f0fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b75b9',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Active Projects</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0b75b9', lineHeight: 1.1 }}>
              {summary.totalProjects}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#2e8b38', fontWeight: 600, marginTop: '2px' }}>
              {summary.completedProjects} Completed • {summary.inProgressProjects} In Progress
            </div>
          </div>
        </div>

        {/* Realized Revenue */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #dbe7f3',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(11, 117, 185, 0.04)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#e1f0fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b75b9',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Realized Revenue</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0b75b9', lineHeight: 1.1 }}>
              {formatCurrency(summary.collectedRevenue)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#2e8b38', fontWeight: 600, marginTop: '2px' }}>
              {collectionPercent}% Collected of Total
            </div>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #dbe7f3',
          padding: '1.1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(11, 117, 185, 0.04)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d97706',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Outstanding Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>
              {formatCurrency(summary.pendingRevenue)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
              {pendingPercent}% Pending • {pendingProjectsCount} {pendingProjectsCount === 1 ? 'Project' : 'Projects'} with Due
            </div>
          </div>
        </div>
      </div>

      {/* Main Section: Data Table */}
      <div style={{ width: '100%' }}>
        {/* Table Container */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #dbe7f3',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(11, 117, 185, 0.04)'
        }}>
          {/* Table Search & Filter Bar */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid #edf4fb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '280px', flex: 1 }}>
              <span style={{ position: 'absolute', left: '0.75rem', color: '#0b75b9', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search projects, customers, sites, or quotes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 1rem 0.45rem 2.25rem',
                  borderRadius: '8px',
                  border: '1px solid #d4e5f5',
                  backgroundColor: '#ffffff',
                  color: '#0b2546',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Stage:</span>
                <select
                  value={stageFilter}
                  onChange={e => setStageFilter(e.target.value)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #d4e5f5',
                    backgroundColor: '#ffffff',
                    color: '#0b2546',
                    fontSize: '0.825rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Stages</option>
                  <option value="Completed">Completed</option>
                  <option value="Commissioning">Commissioning</option>
                  <option value="Installation">Installation</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Site Survey">Site Survey</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f4f9fd', borderBottom: '1px solid #dbe7f3' }}>
                <tr>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Project Ref
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '220px' }}>
                    Customer & Location
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '120px' }}>
                    Capacity (kW)
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '150px' }}>
                    Billed / Contract Value
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '140px' }}>
                    Collected Value
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '140px' }}>
                    Outstanding Balance
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'center', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '110px' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#506e8c' }}>
                      Loading project reports...
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#506e8c' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
                      <div style={{ fontWeight: 600, color: '#0b2546' }}>No projects with generated invoices match your criteria</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Only projects with generated invoices appear in reports. Try clearing filters.</div>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map(p => {
                    const isSelected = viewingProject?.id === p.id;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setViewingProject(p)}
                        style={{
                          borderBottom: '1px solid #edf4fb',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#f1f8fe' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fbfe';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* Ref */}
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <div style={{ color: '#1b6e38', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                            {p.reference}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#506e8c', whiteSpace: 'nowrap' }}>
                            Due: {p.target_date ? formatDate(p.target_date) : 'TBD'}
                          </div>
                        </td>

                        {/* Customer */}
                        <td style={{ padding: '0.85rem 1.15rem' }}>
                          <div style={{ fontWeight: 600, color: '#0b2546', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            {p.customerName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#506e8c', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', maxWidth: '320px' }}>
                            {p.siteName}
                          </div>
                        </td>

                        {/* Capacity */}
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            color: '#0b2546',
                            fontSize: '0.85rem',
                            backgroundColor: '#edf5fc',
                            padding: '3px 10px',
                            borderRadius: '6px'
                          }}>
                            {p.capacityKw} kW
                          </span>
                        </td>

                        {/* Billed / Contract Value */}
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#0b2546', fontSize: '0.875rem' }}>
                            {formatCurrency(p.contractValue)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#506e8c', marginTop: '2px' }}>
                            {p.invoiceCount} {p.invoiceCount === 1 ? 'Invoice' : 'Invoices'}
                          </div>
                        </td>

                        {/* Collected Value */}
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.875rem' }}>
                            {formatCurrency(p.paidAmount)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: p.paidAmount >= p.contractValue && p.contractValue > 0 ? '#15803d' : '#0b75b9', fontWeight: 600, marginTop: '2px' }}>
                            {p.contractValue > 0 ? `${Math.round((p.paidAmount / p.contractValue) * 100)}% Received` : '0%'}
                          </div>
                        </td>

                        {/* Outstanding Balance */}
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: p.balanceAmount > 0 ? '#d97706' : '#2e8b38', fontSize: '0.875rem' }}>
                            {formatCurrency(p.balanceAmount)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: p.balanceAmount > 0 ? '#b45309' : '#15803d', fontWeight: 600, marginTop: '2px' }}>
                            {p.balanceAmount > 0 ? 'Pending' : 'Cleared'}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.85rem 1.15rem', textAlign: 'center' }}>
                          <Button
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingProject(p);
                            }}
                            style={{
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.825rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="View Project Details"
                          >
                             View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #edf4fb',
            backgroundColor: '#ffffff',
            fontSize: '0.825rem',
            color: '#55728f'
          }}>
            <div>
              Showing {filteredProjects.length} of {projects.length} analyzed projects
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', background: '#ffffff', color: '#55728f', cursor: 'pointer' }}>‹</button>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#1b5e20', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>1</button>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', background: '#ffffff', color: '#55728f', cursor: 'pointer' }}>›</button>
            </div>
          </div>
        </div>

      </div>

      {/* Project Audit & Telemetry Modal */}
      <ProjectReportModal
        project={viewingProject}
        isOpen={!!viewingProject}
        onClose={() => setViewingProject(null)}
      />
    </div>
  );
}
