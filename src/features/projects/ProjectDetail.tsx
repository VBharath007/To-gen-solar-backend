import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatters';
import { useAlert } from '../../context/AlertContext';
import type { Project } from '@shared/types/project.types';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProject(Number(id));
    }
  }, [id]);

  const loadProject = async (projectId: number) => {
    setLoading(true);
    try {
      const res = await window.desktop.projects.get(projectId);
      if (res.success) {
        setProject(res.data);
      } else {
        setError(res.error?.message || 'Failed to load project');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Project',
      description: 'Are you sure you want to delete this project? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.projects.delete(project.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Project Deleted',
          description: `Project "${project.reference}" has been deleted successfully.`,
        });
        navigate('/projects');
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete project',
        });
      }
    } catch (err) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: String(err),
      });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading project details...</div>;
  if (error || !project) return <div className="p-8 text-center text-red-500">{error || 'Project not found'}</div>;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <PageHeader 
        title={`Project: ${project.reference}`}
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Details' }]}
        action={
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={() => navigate(`/invoices/new?projectId=${project.id}`)}>+ Generate Invoice</Button>
            <Button variant="secondary" onClick={() => navigate(`/projects/${project.id}/edit`)}>Edit Project</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="flex flex-col gap-4">
          <Card title="Project Information">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Reference</label>
                <div className="font-medium text-lg">{project.reference}</div>
              </div>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Quotation Ref</label>
                <div>{project.quotation_ref || '-'}</div>
              </div>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Date</label>
                <div>{project.target_date ? formatDate(project.target_date) : '-'}</div>
              </div>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Progress Stage</label>
                <div className="mt-1">
                  <Badge variant={project.stage === 'Complete' ? 'success' : project.stage === 'Reject' ? 'danger' : project.stage === 'Pending' ? 'warning' : 'info'}>
                    {project.stage || 'In Progress'}
                  </Badge>
                </div>
                {project.stage === 'Reject' && (
                  <div className="text-xs text-danger mt-1 p-2 bg-red-50 rounded border border-red-100">
                    <strong>Reason:</strong> {localStorage.getItem(`project_reject_reason_${project.id}`) || 'No reason provided'}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Customer & Site Details">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Customer Name</label>
                <div className="font-medium">{project.customerName}</div>
                <Button 
                  variant="secondary" 
                  className="mt-2 text-xs" 
                  onClick={() => navigate(`/customers/${project.customer_id}`)}
                >
                  View Customer
                </Button>
              </div>
              <div>
                <label className="text-xs text-secondary uppercase font-semibold">Installation Site Name</label>
                <div className="font-medium">{project.siteName}</div>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Financial Status">
            <label className="text-xs text-secondary uppercase font-semibold">Payment Status</label>
            <div className="mt-1">
              <Badge variant={project.payment_status === 'Paid' ? 'success' : 'default'}>
                {project.payment_status}
              </Badge>
            </div>
          </Card>

          <Card title="System Data" className="mt-4">
            <div className="text-xs text-secondary">
              <div className="flex justify-between py-1">
                <span>Created</span>
                <span>{formatDate(project.created_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-border-color">
                <span>Last Updated</span>
                <span>{formatDate(project.updated_at)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
