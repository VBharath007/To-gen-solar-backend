import { useEffect, useState } from 'react';
import { FileText, Calendar, Zap, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { DashboardMetrics } from '@shared/types/dashboard.types';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const res = await window.desktop.dashboard.getMetrics();
      if (res.success) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Welcome back!" 
        description="Here is an overview of your business today."
      />

      <div className="kpi-grid kpi-grid-4">
        {/* Card 1: Pending Quotations */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#e1f0fa',
              color: '#0b75b9',
            }}
          >
            <FileText />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Pending Quotations</div>
            <div className="kpi-card-value" style={{ color: '#0b75b9' }}>
              {loading ? '-' : metrics?.pendingQuotations || 0}
            </div>
            <div className="kpi-card-subtitle">
              Draft or Issued quotes
            </div>
          </div>
        </div>

        {/* Card 2: Pending Surveys */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#fef3c7',
              color: '#d97706',
            }}
          >
            <Calendar />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Pending Surveys</div>
            <div className="kpi-card-value" style={{ color: '#d97706' }}>
              {loading ? '-' : metrics?.pendingSurveys || 0}
            </div>
            <div className="kpi-card-subtitle">
              Scheduled site visits
            </div>
          </div>
        </div>

        {/* Card 3: Active Projects */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#e2f7e5',
              color: '#2e8b38',
            }}
          >
            <Zap />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Active Projects</div>
            <div className="kpi-card-value" style={{ color: '#1b5e20' }}>
              {loading ? '-' : metrics?.activeProjects || 0}
            </div>
            <div className="kpi-card-subtitle">
              Projects in progress
            </div>
          </div>
        </div>

        {/* Card 4: Outstanding Balance */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
            }}
          >
            <Wallet />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Outstanding Balance</div>
            <div 
              className="kpi-card-value currency"
              style={{ color: '#dc2626' }}
              title={loading ? '-' : formatCurrency((metrics?.outstandingBalance || 0) / 100)}
            >
              {loading ? '-' : formatCurrency((metrics?.outstandingBalance || 0) / 100)}
            </div>
            <div className="kpi-card-subtitle">
              Unpaid invoice total
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <Card title="Recent Activity">
          {!metrics?.recentActivity || metrics.recentActivity.length === 0 ? (
            <EmptyState 
              icon="📭"
              title="No recent activity"
              description="When available, recent updates will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {metrics.recentActivity.map(activity => (
                <div key={activity.id} className="flex gap-4 p-4 rounded-lg bg-secondary-bg border border-border-color items-center">
                  <div className="text-2xl shrink-0">
                    {activity.type === 'quotation' ? '📄' : activity.type === 'invoice' ? '🧾' : activity.type === 'payment' ? '💰' : '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{activity.title}</div>
                    <div className="text-xs text-secondary">{activity.description}</div>
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap pl-2">
                    {formatDate(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Upcoming Tasks">
          {!metrics?.upcomingTasks || metrics.upcomingTasks.length === 0 ? (
            <EmptyState 
              icon="📅"
              title="No tasks scheduled"
              description="Scheduled surveys and due invoices will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              {metrics.upcomingTasks.map(task => (
                <div key={task.id} className="flex gap-3 p-4 rounded-lg bg-secondary-bg border border-border-color items-center">
                  <div className="text-xl shrink-0">
                    {task.type === 'survey' ? '👷' : '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{task.title}</div>
                    <div className="text-xs text-secondary font-medium">Due: {formatDate(task.dueDate.split('T')[0])}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
