export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'quotation' | 'invoice' | 'payment' | 'survey' | 'project';
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string;
  type: 'survey' | 'invoice_due';
}

export interface DashboardMetrics {
  pendingQuotations: number;
  activeProjects: number;
  outstandingBalance: number;
  pendingSurveys: number;
  recentActivity: ActivityItem[];
  upcomingTasks: TaskItem[];
}
