import { ProjectAnalyticsItem, ReportsSummary } from '../features/reports/report.types';
import { formatCurrency, formatDate } from './formatters';

interface FilterMeta {
  stageFilter?: string;
  searchQuery?: string;
}

export async function generateProjectsAnalyticsReportHtml(
  items: ProjectAnalyticsItem[],
  summary: ReportsSummary,
  filterMeta?: FilterMeta
): Promise<string> {
  const stageFilterText = filterMeta?.stageFilter && filterMeta.stageFilter !== 'ALL' ? filterMeta.stageFilter : 'All Stages';
  const searchFilterText = filterMeta?.searchQuery ? `"${filterMeta.searchQuery}"` : 'None';
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const generatedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const collectionPercent = summary.totalRevenue > 0
    ? Math.round((summary.collectedRevenue / summary.totalRevenue) * 100)
    : 0;

  const totalMonthlyKwh = items.reduce((acc, curr) => acc + (curr.estMonthlyKwh || 0), 0);
  const totalCo2Tons = items.reduce((acc, curr) => acc + (curr.co2OffsetTons || 0), 0);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 850px; background: #ffffff; color: #0b2546; padding: 36px 40px; box-sizing: border-box; line-height: 1.45;">
      
      <!-- Report Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0b75b9; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #0b75b9 0%, #034875 100%); display: flex; align-items: center; justify-content: center; color: #ffffff;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: 800; color: #0b75b9; letter-spacing: -0.5px; margin: 0;">ToGen Solar CRM</div>
            <div style="font-size: 13px; font-weight: 600; color: #506e8c; text-transform: uppercase; letter-spacing: 0.8px;">Project Performance & Analytics Audit Report</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
            Official Audit Document
          </div>
          <div style="font-size: 12px; color: #506e8c;">Generated: <strong style="color: #0b2546;">${generatedDate} ${generatedTime}</strong></div>
          <div style="font-size: 11px; color: #64748b;">Ref: REP-${Date.now().toString().slice(-6)}</div>
        </div>
      </div>

      <!-- Scope & Filter Meta Box -->
      <div style="display: flex; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 18px; margin-bottom: 24px; font-size: 12px;">
        <div style="flex: 1;"><span style="color: #64748b;">Stage Scope:</span> <strong style="color: #0b2546;">${stageFilterText}</strong></div>
        <div style="flex: 1;"><span style="color: #64748b;">Keyword Query:</span> <strong style="color: #0b2546;">${searchFilterText}</strong></div>
        <div style="flex: 1; text-align: right;"><span style="color: #64748b;">Records Analyzed:</span> <strong style="color: #0b75b9; font-size: 13px;">${items.length} Projects</strong></div>
      </div>

      <!-- Executive KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px;">
        
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #0b75b9; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Projects</div>
          <div style="font-size: 24px; font-weight: 800; color: #0b2546; margin: 4px 0;">${summary.totalProjects}</div>
          <div style="font-size: 11px; color: #16a34a; font-weight: 600;">✓ ${summary.completedProjects} Completed</div>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #f59e0b; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">System Capacity</div>
          <div style="font-size: 24px; font-weight: 800; color: #0b2546; margin: 4px 0;">${summary.totalCapacityKw} <span style="font-size: 14px; font-weight: 600; color: #64748b;">kW</span></div>
          <div style="font-size: 11px; color: #506e8c;">Avg: ${summary.totalProjects > 0 ? (summary.totalCapacityKw / summary.totalProjects).toFixed(1) : 0} kW / site</div>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #10b981; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Contract Value</div>
          <div style="font-size: 18px; font-weight: 800; color: #0b2546; margin: 4px 0;">${formatCurrency(summary.totalRevenue)}</div>
          <div style="font-size: 11px; color: #16a34a; font-weight: 600;">₹ Realized: ${collectionPercent}%</div>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #6366f1; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Collections Realized</div>
          <div style="font-size: 18px; font-weight: 800; color: #16a34a; margin: 4px 0;">${formatCurrency(summary.collectedRevenue)}</div>
          <div style="font-size: 11px; color: #d97706;">Pending: ${formatCurrency(summary.pendingRevenue)}</div>
        </div>

      </div>

      <!-- Stage Velocity & Environmental Yield Snapshot -->
      <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 16px; margin-bottom: 26px;">
        
        <!-- Stage Breakdown -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
          <div style="font-size: 12px; font-weight: 700; color: #0b2546; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
            Project Stage Distribution & Velocity
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${summary.stageDistribution.map(st => `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                  <span style="font-weight: 600; color: #334155;">${st.stage}</span>
                  <span style="color: #64748b; font-weight: 600;">${st.count} projects (${st.percentage}%)</span>
                </div>
                <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                  <div style="width: ${st.percentage}%; height: 100%; background: ${st.stage === 'Completed' ? '#10b981' : st.stage === 'Commissioning' || st.stage === 'Installation' ? '#0b75b9' : '#f59e0b'};"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Clean Energy Yield -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              Clean Energy & Environmental Yield
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-size: 11px; color: #15803d;">Est. Clean Yield Per Month:</div>
              <div style="font-size: 19px; font-weight: 800; color: #166534;">${totalMonthlyKwh.toLocaleString()} <span style="font-size: 13px;">kWh / mo</span></div>
            </div>
            <div>
              <div style="font-size: 11px; color: #15803d;">Annual Carbon Offset:</div>
              <div style="font-size: 19px; font-weight: 800; color: #166534;">${totalCo2Tons.toFixed(1)} <span style="font-size: 13px;">Metric Tons / yr</span></div>
            </div>
          </div>
          <div style="font-size: 10px; color: #15803d; border-top: 1px dashed #86efac; padding-top: 6px; margin-top: 6px;">
            🌱 Equivalent to planting ~${Math.round(totalCo2Tons * 45)} trees annually.
          </div>
        </div>

      </div>

      <!-- Project Audit Table -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: #0b2546; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
          <span>Individual Project Audits & Telemetry</span>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">Sorted by Schedule / Reference</span>
        </div>

        <table style="table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; box-sizing: border-box;">
          <thead>
            <tr style="background: #0b75b9; color: #ffffff;">
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; width: 13%; font-weight: 700; white-space: nowrap;">Ref</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; width: 29%; font-weight: 700;">Customer & Location</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; text-align: center; width: 10%; font-weight: 700; white-space: nowrap;">Cap</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; text-align: right; width: 15%; font-weight: 700; white-space: nowrap;">Contract Value</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; text-align: right; width: 13%; font-weight: 700; white-space: nowrap;">Collected</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; text-align: center; width: 10%; font-weight: 700; white-space: nowrap;">Payment</th>
              <th style="padding: 9px 8px; border: 1px solid #0b75b9; text-align: center; width: 10%; font-weight: 700; white-space: nowrap;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((p, idx) => {
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const payColor = p.payment_status === 'Paid' ? '#166534' : p.payment_status === 'Partial' ? '#0369a1' : '#b45309';

              return `
                <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0b75b9; vertical-align: middle; white-space: nowrap;">${p.reference}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.4;">
                    <div style="font-weight: 700; color: #0b2546; word-break: break-word; overflow-wrap: break-word;">${p.customerName || 'N/A'}</div>
                    <div style="color: #64748b; font-size: 10px; word-break: break-word; overflow-wrap: break-word;">${p.siteName || ''}</div>
                  </td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; vertical-align: middle; white-space: nowrap;">${p.capacityKw} kW</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600; vertical-align: middle; white-space: nowrap;">${formatCurrency(p.contractValue)}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #16a34a; vertical-align: middle; white-space: nowrap;">${formatCurrency(p.paidAmount)}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle; white-space: nowrap;">
                    <span style="font-weight: 700; color: ${payColor};">${p.payment_status}</span>
                  </td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #475569; vertical-align: middle; white-space: nowrap;">
                    ${p.target_date ? formatDate(p.target_date) : 'TBD'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Report Sign-off & Audit Footer -->
      <div style="border-top: 2px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
        <div>
          <div>Generated by <strong>ToGen Solar CRM Analytics Engine</strong></div>
          <div style="font-size: 10px;">Confidential Document • Internal Operational Review & Field Management</div>
        </div>
        <div style="text-align: right;">
          <div>ToGen Solar Inc. • Renewable Energy Systems</div>
          <div style="font-size: 10px;">Certified Project Performance Record</div>
        </div>
      </div>

    </div>
  `;

  return html;
}

export async function generateProjectsAnalyticsReportPDF(items: any[], summary: any, filterMeta?: any, filename?: string): Promise<void> {
  const html = await generateProjectsAnalyticsReportHtml(items, summary, filterMeta);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;background:#ffffff;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    await new Promise(r => setTimeout(r, 120));

    const canvas = await html2canvas(wrap, {
      scale: 3.0,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    pdf.save(filename || `ToGen_Solar_Project_Analytics_Report_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}

export async function generateSingleProjectReportPDF(
  project: ProjectAnalyticsItem,
  filename?: string
): Promise<void> {
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 850px; background: #ffffff; color: #0b2546; padding: 40px; box-sizing: border-box; line-height: 1.5;">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0b75b9; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #0b75b9 0%, #034875 100%); display: flex; align-items: center; justify-content: center; color: #ffffff;">
            ⚡
          </div>
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #0b75b9; margin: 0;">ToGen Solar CRM</div>
            <div style="font-size: 13px; font-weight: 600; color: #506e8c; text-transform: uppercase;">Individual Project Dossier & Audit Report</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-block; margin-bottom: 4px;">
            PROJECT AUDIT
          </div>
          <div style="font-size: 12px; color: #506e8c;">Date: <strong style="color: #0b2546;">${generatedDate}</strong></div>
          <div style="font-size: 13px; font-weight: 800; color: #0b75b9;">${project.reference}</div>
        </div>
      </div>

      <!-- Project Snapshot Banner -->
      <div style="background: linear-gradient(135deg, #0b75b9 0%, #064e7d 100%); color: #ffffff; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Project Reference & Customer</div>
          <div style="font-size: 22px; font-weight: 800; margin: 4px 0;">${project.customerName || 'Valued Customer'}</div>
          <div style="font-size: 13px; opacity: 0.9;">Site: ${project.siteName || 'Not specified'} • Quotation Ref: ${project.quotation_ref || 'N/A'}</div>
        </div>
        <div style="text-align: right;">
          <div style="background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 8px; display: inline-block;">
            <div style="font-size: 11px; text-transform: uppercase;">System Capacity</div>
            <div style="font-size: 24px; font-weight: 800;">${project.capacityKw} kW</div>
          </div>
        </div>
      </div>

      <!-- Key Metrics 4-Box Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Stage & Progress</div>
          <div style="font-size: 16px; font-weight: 700; color: #0b2546; margin: 4px 0;">${project.stage}</div>
          <div style="font-size: 11px; color: #0b75b9; font-weight: 700;">${project.progressPercent}% Completed</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Contract Value</div>
          <div style="font-size: 16px; font-weight: 700; color: #0b2546; margin: 4px 0;">${formatCurrency(project.contractValue)}</div>
          <div style="font-size: 11px; color: #16a34a; font-weight: 600;">Status: ${project.payment_status}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Paid to Date</div>
          <div style="font-size: 16px; font-weight: 700; color: #16a34a; margin: 4px 0;">${formatCurrency(project.paidAmount)}</div>
          <div style="font-size: 11px; color: #b45309;">Bal: ${formatCurrency(project.contractValue - project.paidAmount)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Date</div>
          <div style="font-size: 16px; font-weight: 700; color: #0b2546; margin: 4px 0;">${project.target_date ? formatDate(project.target_date) : 'TBD'}</div>
        </div>
      </div>

      <!-- Energy Generation & Carbon Offset -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase;">Estimated Monthly Clean Yield</div>
          <div style="font-size: 22px; font-weight: 800; color: #166534; margin: 4px 0;">${project.estMonthlyKwh.toLocaleString()} kWh / month</div>
          <div style="font-size: 11px; color: #15803d;">Calculated with ~4.2 Peak Sun Hours / day index</div>
        </div>
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase;">Annual CO2 Offset Potential</div>
          <div style="font-size: 22px; font-weight: 800; color: #166534; margin: 4px 0;">${project.co2OffsetTons} Metric Tons / year</div>
          <div style="font-size: 11px; color: #15803d;">Equivalent to eliminating ~${Math.round(project.co2OffsetTons * 2.2)} combustion engine cars</div>
        </div>
      </div>

      <!-- Signoff -->
      <div style="border-top: 2px solid #e2e8f0; padding-top: 16px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
        <div>Generated by ToGen Solar CRM • Official Technical Record</div>
        <div>Confidential & Proprietary • ToGen Solar</div>
      </div>

    </div>
  `;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;background:#ffffff;';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    await new Promise(r => setTimeout(r, 120));

    const canvas = await html2canvas(wrap, {
      scale: 3.0,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
    pdf.save(filename || `Project_Report_${project.reference.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
