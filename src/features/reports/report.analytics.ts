import type { Project } from '@shared/types/project.types';
import { ProjectAnalyticsItem, ReportsSummary } from './report.types';


export function enrichProjectAnalytics(projects: Project[]): ProjectAnalyticsItem[] {
  // CRITICAL REQUIREMENT: Only projects with at least 1 generated invoice are shown in reports!
  const baseList = (projects && projects.length > 0 ? projects : []).filter(
    p => Number((p as any).invoiceCount || 0) > 0
  );

  return baseList.map(p => {
    const capacityKw = Number((p as any).capacityKw) > 0 ? Number((p as any).capacityKw) : 3;
    
    // Dynamic actual values based on generated invoices & recorded payments
    const contractValue = Number((p as any).invoicedAmount ?? (p as any).contractValue ?? 0);
    const paidAmount = Number((p as any).collectedAmount ?? (p as any).paidAmount ?? 0);
    const balanceAmount = Math.max(0, contractValue - paidAmount);
    const invoiceCount = Number((p as any).invoiceCount ?? 0);

    let nextMilestone = 'Final Testing';
    let progressPercent = 30;

    switch (p.stage) {
      case 'Completed':
        progressPercent = 100;
        break;
      case 'Commissioning':
        progressPercent = 90;
        break;
      case 'Installation':
        progressPercent = 70;
        break;
      case 'Procurement':
        progressPercent = 45;
        break;
      case 'Site Survey':
      default:
        progressPercent = 20;
        break;
    }

    const estMonthlyKwh = Math.round(capacityKw * 4.2 * 30);
    const co2OffsetTons = parseFloat(((estMonthlyKwh * 12 * 0.82) / 1000).toFixed(1));

    return {
      ...p,
      capacityKw,
      estMonthlyKwh,
      co2OffsetTons,
      progressPercent,
      contractValue,
      paidAmount,
      balanceAmount,
      invoiceCount,
      nextMilestone
    };
  });
}

export function calculateReportsSummary(items: ProjectAnalyticsItem[]): ReportsSummary {
  const totalProjects = items.length;
  const completedProjects = items.filter(i => i.stage === 'Completed').length;
  const inProgressProjects = items.filter(i => i.stage === 'Installation' || i.stage === 'Commissioning').length;
  const pendingProjects = items.filter(i => i.stage === 'Site Survey' || i.stage === 'Procurement' || i.stage === 'Not started').length;

  const totalCapacityKw = items.reduce((acc, curr) => acc + curr.capacityKw, 0);
  const totalRevenue = items.reduce((acc, curr) => acc + curr.contractValue, 0);
  const collectedRevenue = items.reduce((acc, curr) => acc + curr.paidAmount, 0);
  const pendingRevenue = items.reduce((acc, curr) => acc + curr.balanceAmount, 0);

  // Stage Breakdown
  const stageMap: Record<string, number> = {};
  items.forEach(i => {
    stageMap[i.stage] = (stageMap[i.stage] || 0) + 1;
  });

  const stageOrder = ['Site Survey', 'Procurement', 'Installation', 'Commissioning', 'Completed'];
  const stageDistribution = stageOrder.map(st => {
    const count = stageMap[st] || 0;
    const percentage = totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0;
    return { stage: st, count, percentage };
  });

  // Payment Breakdown based on actual invoice collections
  const paidCount = items.filter(i => i.contractValue > 0 && i.paidAmount >= i.contractValue).length;
  const partialCount = items.filter(i => i.paidAmount > 0 && i.paidAmount < i.contractValue).length;
  const pendingPayCount = items.filter(i => i.paidAmount === 0).length;

  const paymentDistribution = [
    { status: 'Paid in Full', count: paidCount, amount: items.filter(i => i.contractValue > 0 && i.paidAmount >= i.contractValue).reduce((a, b) => a + b.contractValue, 0) },
    { status: 'Partial Milestones', count: partialCount, amount: items.filter(i => i.paidAmount > 0 && i.paidAmount < i.contractValue).reduce((a, b) => a + b.contractValue, 0) },
    { status: 'Payment Pending', count: pendingPayCount, amount: items.filter(i => i.paidAmount === 0).reduce((a, b) => a + b.contractValue, 0) },
  ];

  return {
    totalProjects,
    completedProjects,
    inProgressProjects,
    pendingProjects,
    totalCapacityKw,
    totalRevenue,
    collectedRevenue,
    pendingRevenue,
    stageDistribution,
    paymentDistribution
  };
}

export function exportProjectsToCSV(items: ProjectAnalyticsItem[]): void {
  const headers = [
    'Project Reference',
    'Customer Name',
    'Site Location',
    'System Capacity (kW)',
    'Installation Stage',
    'Date',
    'Progress (%)',
    'Billed / Contract Value (INR)',
    'Collected Amount (INR)',
    'Balance Due (INR)',
    'Invoice Count',
    'Monthly Generation (kWh)',
    'Annual CO2 Offset (Tons)'
  ];

  const rows = items.map(i => [
    i.reference,
    `"${i.customerName || ''}"`,
    `"${i.siteName || ''}"`,
    i.capacityKw,
    `"${i.stage}"`,
    i.target_date || 'N/A',
    `${i.progressPercent}%`,
    Number(i.contractValue || 0).toFixed(2),
    Number(i.paidAmount || 0).toFixed(2),
    Number(i.balanceAmount || 0).toFixed(2),
    i.invoiceCount,
    i.estMonthlyKwh,
    i.co2OffsetTons
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `ToGen_Solar_Projects_Analytics_Report_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
