import type { Project } from '@shared/types/project.types';

export interface ProjectAnalyticsItem extends Project {
  capacityKw: number;
  estMonthlyKwh: number;
  co2OffsetTons: number;
  progressPercent: number;
  contractValue: number;
  paidAmount: number;
  balanceAmount: number;
  invoiceCount: number;
  nextMilestone: string;
}

export interface ReportsSummary {
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  pendingProjects: number;
  totalCapacityKw: number;
  totalRevenue: number;
  collectedRevenue: number;
  pendingRevenue: number;
  stageDistribution: { stage: string; count: number; percentage: number }[];
  paymentDistribution: { status: string; count: number; amount: number }[];
}

export type ReportTimeframe = 'ALL' | 'THIS_MONTH' | 'THIS_QUARTER' | 'YTD';
