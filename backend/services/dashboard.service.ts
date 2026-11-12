import { getDb } from '../database/connection';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type { DashboardMetrics } from '@shared/types/dashboard.types';

export function getDashboardMetrics(): ApiResponse<DashboardMetrics> {
  try {
    const db = getDb();
    
    const pendingQuotations = (db.prepare(`SELECT COUNT(*) as c FROM quotations WHERE status IN ('Draft', 'Issued')`).get() as any).c;
    const activeProjects = (db.prepare(`SELECT COUNT(*) as c FROM projects WHERE stage != 'Completed'`).get() as any).c;
    const outstandingBalance = (db.prepare(`SELECT SUM(total_amount - amount_paid) as sum FROM invoices WHERE status != 'Paid'`).get() as any).sum || 0;
    const pendingSurveys = (db.prepare(`SELECT COUNT(*) as c FROM site_surveys WHERE status = 'Scheduled'`).get() as any).c;
    
    // Recent Activity (Top 5 items across various tables)
    const recentActivity: any[] = [];
    
    const recentQuots = db.prepare(`SELECT id, reference, status, updated_at FROM quotations ORDER BY updated_at DESC LIMIT 3`).all() as any[];
    recentQuots.forEach(q => recentActivity.push({ id: `quotation-${q.id}`, title: `Quotation ${q.reference}`, description: `Status changed to ${q.status}`, timestamp: q.updated_at, type: 'quotation' }));
    
    const recentInvoices = db.prepare(`SELECT id, reference, status, updated_at FROM invoices ORDER BY updated_at DESC LIMIT 3`).all() as any[];
    recentInvoices.forEach(i => recentActivity.push({ id: `invoice-${i.id}`, title: `Invoice ${i.reference}`, description: `Status changed to ${i.status}`, timestamp: i.updated_at, type: 'invoice' }));
    
    const recentPayments = db.prepare(`SELECT id, reference, amount, payment_date, updated_at FROM payments ORDER BY updated_at DESC LIMIT 3`).all() as any[];
    recentPayments.forEach(p => recentActivity.push({ id: `payment-${p.id}`, title: `Payment ${p.reference}`, description: `Received ${p.amount / 100} INR`, timestamp: p.updated_at, type: 'payment' }));
    
    // Sort combined activities by timestamp DESC and pick top 5
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const topRecentActivity = recentActivity.slice(0, 5);

    // Upcoming Tasks
    const upcomingTasks: any[] = [];
    
    // 1. Scheduled Surveys
    const scheduledSurveys = db.prepare(`
      SELECT s.id, s.survey_date, c.name 
      FROM site_surveys s 
      JOIN customers c ON s.customer_id = c.id 
      WHERE s.status = 'Scheduled' 
      ORDER BY s.survey_date ASC LIMIT 5
    `).all() as any[];
    scheduledSurveys.forEach(s => upcomingTasks.push({ id: `survey-${s.id}`, title: `Survey: ${s.name}`, dueDate: s.survey_date, type: 'survey' }));

    // 2. Unpaid Invoices Due soon
    const dueInvoices = db.prepare(`
      SELECT i.id, i.reference, i.due_date, c.name 
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status NOT IN ('Paid', 'Draft')
      ORDER BY i.due_date ASC LIMIT 5
    `).all() as any[];
    dueInvoices.forEach(i => upcomingTasks.push({ id: `invoice-${i.id}`, title: `Invoice Due: ${i.reference}`, dueDate: i.due_date, type: 'invoice_due' }));

    // Sort combined tasks by due date
    upcomingTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const topUpcomingTasks = upcomingTasks.slice(0, 5);

    return ok({
      pendingQuotations,
      activeProjects,
      outstandingBalance,
      pendingSurveys,
      recentActivity: topRecentActivity,
      upcomingTasks: topUpcomingTasks
    });
  } catch (error) {
    console.error('[DashboardService]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch metrics');
  }
}
