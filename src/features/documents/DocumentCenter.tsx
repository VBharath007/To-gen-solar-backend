import { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SolarDocument, DocumentCategory, DocumentStatus } from './document.types';
import { deleteDocument, updateDocument } from './document.storage';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { generateTaxInvoicePDF, InvoiceData } from '../../utils/invoicePdfGenerator';
import { generateQuotationPDF } from '../../utils/quotationPdfGenerator';
import { generateProjectPDF } from '../../utils/projectPdfGenerator';
import { generateReceiptPDF } from '../../utils/receiptPdfGenerator';
import { formatDate, formatNotesToPlainText } from '../../utils/formatters';
import { useAlert } from '../../context/AlertContext';
import { getInvoiceBankAccount } from '../../utils/bankAccountStorage';

const CATEGORY_TABS: { label: string; value: DocumentCategory | 'ALL' | 'Projects' | 'Invoices' | 'Quotations' | 'Payments' }[] = [
  { label: 'All Documents', value: 'ALL' },
  { label: 'Projects', value: 'Projects' },
  { label: 'Invoices', value: 'Invoices' },
  { label: 'Quotations', value: 'Quotations' },
  { label: 'Payments', value: 'Payments' as any }
];

export default function DocumentCenter() {
  const { showAlert, showConfirm } = useAlert();
  const [documents, setDocuments] = useState<SolarDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<SolarDocument | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsStatusMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    let merged: SolarDocument[] = [];

    const systemOverrides: Record<string, DocumentStatus> = (() => {
      try {
        return JSON.parse(localStorage.getItem('togen_system_doc_status_overrides') || '{}');
      } catch {
        return {};
      }
    })();

    const deletedSystemDocIds: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem('togen_deleted_system_docs') || '[]');
      } catch {
        return [];
      }
    })();

    try {
      const [projRes, invRes, quoRes, recRes] = await Promise.all([
        window.desktop.projects.list(),
        window.desktop.invoices.list(),
        window.desktop.quotations.list(),
        window.desktop.receipts.list()
      ]);

      if (projRes.success) {
        merged.push(...projRes.data.map(p => ({
          id: `PRJ-${p.id}`,
          title: `Project ${p.reference}`,
          category: 'Projects' as any,
          customerName: p.customerName || 'Unknown Customer',
          projectRef: p.reference,
          status: systemOverrides[`PRJ-${p.id}`] || ('Verified' as any),
          uploadDate: formatDate(p.created_at),
          uploadedBy: 'System',
          fileSize: 'System Record',
          fileType: 'Data' as any,
          description: `System generated project record for ${p.reference}`,
          _systemData: { type: 'project', data: p }
        })));
      }

      if (invRes.success) {
        merged.push(...invRes.data.map(i => ({
          id: `INV-${i.id}`,
          title: `Invoice ${i.reference}`,
          category: 'Invoices' as any,
          customerName: i.customer_name || 'Unknown Customer',
          projectRef: i.project_reference || 'N/A',
          status: systemOverrides[`INV-${i.id}`] || (((i.status === 'Paid' || i.status === 'Sent') ? 'Approved' : 'Draft') as any),
          uploadDate: formatDate(i.issue_date),
          uploadedBy: 'System',
          fileSize: 'System Record',
          fileType: 'PDF' as any,
          description: `System generated invoice record for ${i.reference}`,
          _systemData: { type: 'invoice', data: i }
        })));
      }

      if (quoRes.success) {
        merged.push(...quoRes.data.map(q => ({
          id: `QUO-${q.id}`,
          title: `Quotation ${q.reference}`,
          category: 'Quotations' as any,
          customerName: q.customerName || 'Unknown Customer',
          projectRef: 'N/A',
          status: systemOverrides[`QUO-${q.id}`] || (((q.status === 'Accepted' || q.status === 'Issued') ? 'Approved' : 'Draft') as any),
          uploadDate: formatDate(q.created_at),
          uploadedBy: 'System',
          fileSize: 'System Record',
          fileType: 'PDF' as any,
          description: `System generated quotation record for ${q.reference}`,
          _systemData: { type: 'quotation', data: q }
        })));
      }

      if (recRes && recRes.success) {
        merged.push(...recRes.data.map((r: any) => ({
          id: `REC-${r.id}`,
          title: `Receipt ${r.receipt_number}`,
          category: 'Payments' as any,
          customerName: r.customer_name || 'Unknown Customer',
          projectRef: r.invoice_number || 'N/A',
          status: systemOverrides[`REC-${r.id}`] || 'Verified' as any,
          uploadDate: r.payment_date ? formatDate(r.payment_date) : '-',
          uploadedBy: 'System',
          fileSize: 'System Record',
          fileType: 'PDF' as any,
          description: `System generated payment receipt for ${r.receipt_number}`,
          _systemData: { type: 'receipt', data: r }
        })));
      }
    } catch (err) {
      console.error("Failed to load system documents", err);
    }

    if (deletedSystemDocIds.length > 0) {
      merged = merged.filter(d => !deletedSystemDocIds.includes(d.id));
    }

    setDocuments(merged);
    if (merged.length > 0) {
      setSelectedId(merged[0].id);
    }
  };

  const handleUpdateStatus = async (docId: string, newStatus: DocumentStatus) => {
    const isSystemDoc = docId.startsWith('PRJ-') || docId.startsWith('INV-') || docId.startsWith('QUO-');
    
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d));

    if (!isSystemDoc) {
      updateDocument(docId, { status: newStatus });
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('togen_system_doc_status_overrides') || '{}');
        stored[docId] = newStatus;
        localStorage.setItem('togen_system_doc_status_overrides', JSON.stringify(stored));
      } catch (e) {
        console.error('Failed to save status override', e);
      }
    }

    await showAlert({
      type: 'success',
      title: 'Status Updated',
      description: `Document status has been changed to "${newStatus}".`,
    });
  };


  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const docToDelete = documents.find(d => d.id === id);
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Remove Document',
      description: `Are you sure you want to remove "${docToDelete?.title || 'this document'}" from the CRM repository?`,
      confirmLabel: 'Remove Document',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      if (id.startsWith('QUO-')) {
        const qId = Number(id.replace('QUO-', ''));
        if (!isNaN(qId)) {
          try {
            await window.desktop.quotations.delete(qId);
          } catch (err) {
            console.error('Failed to delete quotation from desktop API', err);
          }
        }
      } else if (id.startsWith('PRJ-')) {
        const pId = Number(id.replace('PRJ-', ''));
        if (!isNaN(pId)) {
          try {
            await window.desktop.projects.delete(pId);
          } catch (err) {
            console.error('Failed to delete project from desktop API', err);
          }
        }
      }

      if (id.startsWith('PRJ-') || id.startsWith('INV-') || id.startsWith('QUO-')) {
        try {
          const deleted = JSON.parse(localStorage.getItem('togen_deleted_system_docs') || '[]');
          if (!deleted.includes(id)) {
            deleted.push(id);
            localStorage.setItem('togen_deleted_system_docs', JSON.stringify(deleted));
          }
        } catch (e) {
          console.error('Failed to save deleted system doc ID', e);
        }
      } else {
        deleteDocument(id);
      }

      setDocuments(prev => {
        const next = prev.filter(d => d.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id || null);
        return next;
      });
      if (previewDoc?.id === id) {
        setIsPreviewOpen(false);
        setPreviewDoc(null);
      }
      await showAlert({
        type: 'success',
        title: 'Document Removed',
        description: `Document "${docToDelete?.title || id}" was removed successfully.`,
      });
    }
  };

  const handleDownload = async (doc: SolarDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setDownloadingPdfId(doc.id);
    if ((doc as any)._systemData?.type === 'invoice') {
         // It's an invoice, trigger standard PDF generator
         try {
           const inv = (doc as any)._systemData.data;
           const res = await window.desktop.invoices.get(inv.id);
           if (!res.success) throw new Error("Failed to get full invoice");
           const full = res.data;
           
           const bank = getInvoiceBankAccount(full.id, full.bank_account_id);

           const pdfData: InvoiceData = {
             invoiceType: full.invoice_type || 'Invoice',
             invoiceNo: full.reference,
             invoiceDate: formatDate(full.issue_date),
             dueDate: full.due_date ? formatDate(full.due_date) : undefined,
             placeOfSupply: full.place_of_supply || 'Tamil Nadu',
             billTo: { 
               name: full.customer_name || 'Customer', 
               address: [full.customer_address, full.project_reference ? `Project: ${full.project_reference}` : ''].filter(Boolean).join('<br/>') || undefined,
               city: full.customer_city || undefined,
               pincode: full.customer_pincode || undefined,
               gstin: full.customer_gstin || undefined,
               phone: full.customer_phone || undefined
             },
             items: (full.lines || []).map(line => ({ description: line.description, hsn: line.hsn_sac, quantity: line.quantity, unit: line.unit, unitPrice: line.unit_price, gstRate: line.tax_rate, total: line.taxable_value })),
             notes: full.notes ? formatNotesToPlainText(full.notes) : undefined,
             bankDetails: {
               name: bank.bankName,
               branch: bank.branchName,
               accountHolder: bank.accountName,
               accountNo: bank.accountNumber,
               ifsc: bank.ifscCode,
               upiId: bank.upiId,
               accountType: bank.accountType
             }
           };
           await generateTaxInvoicePDF(pdfData);
           setDownloadingPdfId(null);
           return;
         } catch (err) {
           console.error(err);
           await showAlert({
             type: 'error',
             title: 'PDF Generation Failed',
             description: 'Could not generate invoice PDF document.',
           });
           setDownloadingPdfId(null);
           return;
         }
      }

      if ((doc as any)._systemData?.type === 'quotation') {
        try {
          const quo = (doc as any)._systemData.data;
          const res = await window.desktop.quotations.get(quo.id);
          const fullQuote = res.success ? res.data : quo;
          await generateQuotationPDF(fullQuote);
          setDownloadingPdfId(null);
          return;
        } catch (err: any) {
          console.error(err);
          await showAlert({
            type: 'error',
            title: 'PDF Generation Failed',
            description: 'Could not generate quotation proposal PDF.',
          });
          setDownloadingPdfId(null);
          return;
        }
      }

      if ((doc as any)._systemData?.type === 'project') {
        try {
          const prj = (doc as any)._systemData.data;
          let quoData = null;
          if (prj.quotation_ref) {
            const qs = await window.desktop.quotations.list();
            quoData = qs.success ? qs.data.find((q: any) => q.reference === prj.quotation_ref) : null;
            if (quoData && quoData.id) {
               const fullQ = await window.desktop.quotations.get(quoData.id);
               if (fullQ.success) quoData = fullQ.data;
            }
          }
          await generateProjectPDF(prj, quoData);
          setDownloadingPdfId(null);
          return;
        } catch (err) {
          console.error(err);
          await showAlert({ type: 'error', title: 'PDF Generation Failed', description: 'Could not generate project PDF.' });
          setDownloadingPdfId(null);
          return;
        }
      }
      
      if ((doc as any)._systemData?.type === 'receipt') {
        try {
          const rec = (doc as any)._systemData.data;
          const recData = {
            receiptNo: rec.receipt_number,
            paymentDate: rec.payment_date ? formatDate(rec.payment_date) : '',
            customerName: rec.customer_name || 'Customer',
            amount: rec.amount,
            paymentMethod: rec.payment_method,
            transactionId: rec.transaction_id,
            invoiceRef: rec.invoice_number
          };
          await generateReceiptPDF(recData as any);
          setDownloadingPdfId(null);
          return;
        } catch (err) {
          console.error(err);
          await showAlert({ type: 'error', title: 'PDF Generation Failed', description: 'Could not generate receipt PDF.' });
          setDownloadingPdfId(null);
          return;
        }
      }

      // Default download logic for user uploads / others
    const printDiv = document.createElement('div');
    printDiv.style.width = '800px';
    printDiv.style.padding = '40px';
    printDiv.style.backgroundColor = '#ffffff';
    printDiv.style.color = '#0b2546';
    printDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    printDiv.style.position = 'absolute';
    printDiv.style.left = '-9999px';
    printDiv.style.top = '-9999px';
    
    printDiv.innerHTML = `
      <div style="border-bottom: 3px solid #0b75b9; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; color: #0b75b9; font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 12px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0b75b9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v2"></path><path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path><path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
            ToGen Solar
          </h1>
          <p style="margin: 8px 0 0 0; color: #506e8c; font-size: 14px;">Official Document Archive</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #506e8c; font-weight: 600;">DATE GENERATED</div>
          <div style="font-size: 14px; font-weight: 700;">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div style="background-color: #f4f9fd; border: 1px solid #dbe7f3; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
        <h2 style="margin: 0 0 16px 0; color: #0b2546; font-size: 22px;">${doc.title}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
          <div><strong style="color: #506e8c;">Document Ref:</strong> <span style="font-weight: 600;">${doc.id}</span></div>
          <div><strong style="color: #506e8c;">Category:</strong> <span style="font-weight: 600;">${doc.category}</span></div>
          <div><strong style="color: #506e8c;">Customer Name:</strong> <span style="font-weight: 600;">${doc.customerName}</span></div>
          <div><strong style="color: #506e8c;">Project Ref:</strong> <span style="font-weight: 600;">${doc.projectRef || 'N/A'}</span></div>
          <div><strong style="color: #506e8c;">Status:</strong> <span style="font-weight: 600; color: ${doc.status === 'Approved' || doc.status === 'Verified' ? '#1b5e20' : '#d97706'};">${doc.status}</span></div>
          <div><strong style="color: #506e8c;">Version:</strong> <span style="font-weight: 600;">${doc.version || 'v1.0'}</span></div>
          <div><strong style="color: #506e8c;">File Details:</strong> <span style="font-weight: 600;">${doc.fileSize} - ${doc.fileType}</span></div>
          <div><strong style="color: #506e8c;">Uploaded By:</strong> <span style="font-weight: 600;">${doc.uploadedBy} on ${doc.uploadDate}</span></div>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="color: #0b75b9; font-size: 16px; border-bottom: 1px solid #dbe7f3; padding-bottom: 8px; margin-bottom: 16px;">DESCRIPTION & NOTES</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${doc.description || 'Verified solar installation project document.'}</p>
      </div>
      
      <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 60px; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
        <p>This is a system-generated document from ToGen Solar CRM.</p>
        <p>For inquiries, please refer to the Document Ref ID: ${doc.id}</p>
      </div>
    `;

    document.body.appendChild(printDiv);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(printDiv, { scale: 3.0, useCORS: true, logging: false, scrollX: 0, scrollY: 0 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`${doc.id}_${doc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      await showAlert({
        type: 'error',
        title: 'PDF Generation Failed',
        description: 'Failed to generate PDF document. Check console for details.',
      });
    } finally {
      document.body.removeChild(printDiv);
      setDownloadingPdfId(null);
    }
  };

  const handleGenerateInvoice = async (doc: SolarDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if ((doc as any)._systemData?.type === 'invoice') return handleDownload(doc, e);
    const bank = getInvoiceBankAccount(doc.id);
    await generateTaxInvoicePDF({
      invoiceNo: doc.id,
      invoiceDate: new Date().toLocaleDateString('en-IN'),
      billTo: { name: doc.customerName, address: doc.projectRef ? `Project Ref: ${doc.projectRef}` : undefined },
      items: [{ description: doc.title, quantity: 1, unit: 'Job', unitPrice: 0, gstRate: 18, total: 0 }],
      notes: doc.description,
      bankDetails: {
        name: bank.bankName,
        branch: bank.branchName,
        accountHolder: bank.accountName,
        accountNo: bank.accountNumber,
        ifsc: bank.ifscCode,
        upiId: bank.upiId,
        accountType: bank.accountType
      }
    }, `Invoice_${doc.id}_${doc.customerName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleOpenPreview = (doc: SolarDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // 1. Category tab match
      const matchCategory = activeTab === 'ALL' || doc.category === activeTab;

      // 2. Status filter match
      let matchStatus = true;
      if (statusFilter !== 'ALL') {
        const docStatus = (doc.status || '').toLowerCase().trim();
        const filterVal = statusFilter.toLowerCase().trim();

        if (filterVal === 'verified / approved' || filterVal === 'verified/approved' || filterVal === 'approved & verified') {
          matchStatus = docStatus === 'approved' || docStatus === 'verified';
        } else if (filterVal === 'pending review & draft' || filterVal === 'pending all' || filterVal === 'pending & draft') {
          matchStatus = docStatus === 'pending review' || docStatus === 'draft';
        } else {
          matchStatus = docStatus === filterVal;
        }
      }

      // 3. Search query match
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (doc.title && doc.title.toLowerCase().includes(q)) ||
        (doc.customerName && doc.customerName.toLowerCase().includes(q)) ||
        (doc.projectRef && doc.projectRef.toLowerCase().includes(q)) ||
        (doc.id && doc.id.toLowerCase().includes(q)) ||
        (doc.category && doc.category.toLowerCase().includes(q)) ||
        (doc.fileType && doc.fileType.toLowerCase().includes(q)) ||
        (doc.status && doc.status.toLowerCase().includes(q));

      return matchCategory && matchStatus && matchSearch;
    });
  }, [documents, activeTab, statusFilter, searchQuery]);

  const selectedDoc = useMemo(() => {
    if (filteredDocuments.length === 0) return null;
    return filteredDocuments.find(d => d.id === selectedId) || filteredDocuments[0];
  }, [filteredDocuments, selectedId]);

  useEffect(() => {
    if (filteredDocuments.length > 0) {
      const exists = filteredDocuments.some(d => d.id === selectedId);
      if (!exists) {
        setSelectedId(filteredDocuments[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredDocuments, selectedId]);

  const totalCount = documents.length;
  const approvedOnlyCount = documents.filter(d => d.status === 'Approved').length;
  const verifiedOnlyCount = documents.filter(d => d.status === 'Verified').length;
  const approvedCount = approvedOnlyCount + verifiedOnlyCount;
  const pendingReviewOnlyCount = documents.filter(d => d.status === 'Pending Review').length;
  const draftOnlyCount = documents.filter(d => d.status === 'Draft').length;
  const pendingCount = pendingReviewOnlyCount + draftOnlyCount;
  const paymentsCount = documents.filter(d => (d.category as string) === 'Payments').length;

  const getStatusBadge = (status: string) => {
    if (status === 'Approved' || status === 'Verified') return <Badge variant="success">{status}</Badge>;
    if (status === 'Pending Review' || status === 'Draft') return <Badge variant="warning">{status}</Badge>;
    return <Badge variant="default">{status}</Badge>;
  };

  const getFileIcon = (fileType: string) => {
    const baseStyle: React.CSSProperties = { 
      fontWeight: 800, 
      fontSize: '0.75rem', 
      padding: '3px 6px', 
      borderRadius: '4px', 
      whiteSpace: 'nowrap', 
      display: 'inline-flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minWidth: '42px', 
      flexShrink: 0, 
      textAlign: 'center' 
    };
    switch (fileType) {
      case 'PDF': return <span style={{ ...baseStyle, color: '#dc2626', backgroundColor: '#fee2e2' }}>PDF</span>;
      case 'DWG': return <span style={{ ...baseStyle, color: '#0284c7', backgroundColor: '#e0f2fe' }}>DWG</span>;
      case 'DOCX': return <span style={{ ...baseStyle, color: '#2563eb', backgroundColor: '#dbeafe' }}>DOC</span>;
      case 'Data': return <span style={{ ...baseStyle, color: '#6366f1', backgroundColor: '#e0e7ff' }}>DATA</span>;
      default: return <span style={{ ...baseStyle, color: '#16a34a', backgroundColor: '#dcfce7' }}>{fileType}</span>;
    }
  };

  return (
    <div className="animate-fade-in pb-12">
      <PageHeader
        title="Document Center"
        description="Store, organize, and inspect solar project documentation, invoices, and payments."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Total Documents */}
        <div 
          onClick={() => { setStatusFilter('ALL'); setActiveTab('ALL'); }}
          style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '14px', 
            border: (statusFilter === 'ALL' && activeTab === 'ALL') ? '2px solid #0b75b9' : '1px solid #dbe7f3', 
            padding: '1.1rem 1.25rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            boxShadow: (statusFilter === 'ALL' && activeTab === 'ALL') ? '0 4px 14px rgba(11, 117, 185, 0.15)' : '0 2px 8px rgba(11, 117, 185, 0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Click to view all documents"
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e1f0fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b75b9', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Total Documents</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0b75b9', lineHeight: 1.1 }}>{String(totalCount).padStart(2, '0')}</div>
          </div>
        </div>

        {/* Approved / Verified */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Verified / Approved' ? 'ALL' : 'Verified / Approved')}
          style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '14px', 
            border: statusFilter === 'Verified / Approved' ? '2px solid #2e8b38' : '1px solid #dbe7f3', 
            padding: '1.1rem 1.25rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            boxShadow: statusFilter === 'Verified / Approved' ? '0 4px 14px rgba(46, 139, 56, 0.15)' : '0 2px 8px rgba(11, 117, 185, 0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Click to filter Verified & Approved documents"
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e2f7e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2e8b38', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Verified / Approved</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#1b5e20', lineHeight: 1.1 }}>{String(approvedCount).padStart(2, '0')}</div>
          </div>
        </div>

        {/* Pending Review */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'Pending Review' ? 'ALL' : 'Pending Review')}
          style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '14px', 
            border: (statusFilter === 'Pending Review' || statusFilter === 'Draft') ? '2px solid #d97706' : '1px solid #dbe7f3', 
            padding: '1.1rem 1.25rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            boxShadow: (statusFilter === 'Pending Review' || statusFilter === 'Draft') ? '0 4px 14px rgba(217, 119, 6, 0.15)' : '0 2px 8px rgba(11, 117, 185, 0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Click to filter Pending Review documents"
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Pending Review</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>{String(pendingCount).padStart(2, '0')}</div>
          </div>
        </div>

        {/* Payments */}
        <div 
          onClick={() => setActiveTab(prev => prev === 'Payments' ? 'ALL' : 'Payments')}
          style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '14px', 
            border: activeTab === 'Payments' ? '2px solid #0b75b9' : '1px solid #dbe7f3', 
            padding: '1.1rem 1.25rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            boxShadow: activeTab === 'Payments' ? '0 4px 14px rgba(11, 117, 185, 0.15)' : '0 2px 8px rgba(11, 117, 185, 0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Click to filter Payments"
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e1f0fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b75b9', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Payments</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0b75b9', lineHeight: 1.1 }}>{String(paymentsCount).padStart(2, '0')}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {CATEGORY_TABS.map(tab => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid', borderColor: isActive ? 'var(--accent-blue)' : '#dbe7f3', backgroundColor: isActive ? 'var(--accent-blue)' : '#ffffff', color: isActive ? '#ffffff' : '#506e8c', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s ease', boxShadow: isActive ? '0 2px 6px rgba(11, 117, 185, 0.2)' : 'none' }}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #dbe7f3', overflow: 'hidden', boxShadow: '0 2px 8px rgba(11, 117, 185, 0.04)' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #edf4fb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '280px', flex: 1 }}>
              <span style={{ position: 'absolute', left: '0.75rem', color: '#0b75b9', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
              <input type="text" placeholder="Search documents, customers, projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2.25rem', borderRadius: '8px', border: '1px solid #d4e5f5', backgroundColor: '#ffffff', color: '#0b2546', fontSize: '0.875rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#506e8c', fontWeight: 600 }}>Status:</span>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                style={{ 
                  padding: '0.4rem 0.75rem', 
                  borderRadius: '8px', 
                  border: statusFilter !== 'ALL' ? '1.5px solid #0b75b9' : '1px solid #d4e5f5', 
                  backgroundColor: statusFilter !== 'ALL' ? '#f0f7fe' : '#ffffff', 
                  color: '#0b2546', 
                  fontSize: '0.825rem', 
                  cursor: 'pointer',
                  fontWeight: statusFilter !== 'ALL' ? 600 : 500
                }}
              >
                <option value="ALL">All Statuses ({totalCount})</option>
                <option value="Verified / Approved">Verified / Approved ({approvedCount})</option>
                <option value="Approved">Approved ({approvedOnlyCount})</option>
                <option value="Verified">Verified ({verifiedOnlyCount})</option>
                <option value="Pending Review">Pending Review ({pendingReviewOnlyCount})</option>
                <option value="Draft">Draft ({draftOnlyCount})</option>
              </select>
              {statusFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #d4e5f5',
                    backgroundColor: '#ffffff',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Clear status filter"
                >
                  Clear ✕
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f4f9fd', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '220px', borderBottom: '1px solid #dbe7f3' }}>Document Name</th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '180px', borderBottom: '1px solid #dbe7f3' }}>Customer & Project</th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '130px', borderBottom: '1px solid #dbe7f3' }}>Category</th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '110px', borderBottom: '1px solid #dbe7f3' }}>Date</th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'left', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: '110px', borderBottom: '1px solid #dbe7f3' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.15rem', textAlign: 'center', fontWeight: 600, color: '#55728f', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '120px', borderBottom: '1px solid #dbe7f3' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#506e8c' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
                      <div style={{ fontWeight: 600, color: '#0b2546' }}>No documents found</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{searchQuery || statusFilter !== 'ALL' || activeTab !== 'ALL' ? 'Try adjusting your search query or filters' : 'Click "+ Upload Document" above to add your first document'}</div>
                      {(searchQuery || statusFilter !== 'ALL' || activeTab !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setActiveTab('ALL'); }}
                          style={{
                            marginTop: '12px',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            border: '1px solid #d4e5f5',
                            backgroundColor: '#f0f7fe',
                            color: '#0b75b9',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Reset All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map(doc => {
                    const isSelected = selectedId === doc.id;
                    return (
                      <tr key={doc.id} onClick={() => setSelectedId(doc.id)} style={{ borderBottom: '1px solid #edf4fb', cursor: 'pointer', backgroundColor: isSelected ? '#f1f8fe' : 'transparent', transition: 'background-color 0.15s ease' }} onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fbfe'; }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                        <td style={{ padding: '0.85rem 1.15rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getFileIcon(doc.fileType)}
                            <div>
                              <div style={{ fontWeight: 600, color: '#0b2546', fontSize: '0.875rem' }}>{doc.title}</div>
                              <div style={{ fontSize: '0.72rem', color: '#506e8c', whiteSpace: 'nowrap' }}>Ref: {doc.id} • {doc.fileSize}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#0b2546', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{doc.customerName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#1b6e38', fontWeight: 600, whiteSpace: 'nowrap' }}>{doc.projectRef || 'General File'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1.15rem', fontSize: '0.825rem', color: '#506e8c', whiteSpace: 'nowrap' }}>{doc.category}</td>
                        <td style={{ padding: '0.85rem 1.15rem', fontSize: '0.825rem', color: '#506e8c', whiteSpace: 'nowrap' }}>{doc.uploadDate}</td>
                        <td style={{ padding: '0.85rem 1.15rem', whiteSpace: 'nowrap' }}>{getStatusBadge(doc.status)}</td>
                        <td style={{ padding: '0.85rem 1.15rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <button title="Preview" onClick={(e) => handleOpenPreview(doc, e)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', backgroundColor: '#ffffff', color: '#0b75b9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>👁️</button>
                            <button title="Download" onClick={(e) => handleDownload(doc, e)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', backgroundColor: '#ffffff', color: '#2e8b38', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>📥</button>
                            <button title="Delete" onClick={(e) => handleDelete(doc.id, e)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', backgroundColor: '#ffffff', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid #edf4fb', backgroundColor: '#ffffff', fontSize: '0.825rem', color: '#55728f' }}>
            <div>Showing {filteredDocuments.length} of {documents.length} records</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', background: '#ffffff', color: '#55728f', cursor: 'pointer' }}>‹</button>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#1b5e20', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>1</button>
              <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #d4e5f5', background: '#ffffff', color: '#55728f', cursor: 'pointer' }}>›</button>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #dbe7f3', padding: '1.25rem', boxShadow: '0 2px 8px rgba(11, 117, 185, 0.05)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0b2546' }}>Quick Detail Preview</h3>
          {!selectedDoc ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#506e8c', fontSize: '0.85rem' }}>Select a document to inspect full details and actions.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ width: '68px', height: '56px', borderRadius: '10px', backgroundColor: '#e1f0fa', border: '1px solid #cce3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.2rem' }}>📑</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0b75b9' }}>{selectedDoc.fileType}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0b2546', lineHeight: 1.2 }}>{selectedDoc.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#506e8c', margin: '2px 0 4px' }}>{selectedDoc.id} • {selectedDoc.version || 'v1.0'}</div>
                  <div>{getStatusBadge(selectedDoc.status)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>👤</span> Customer</span><span style={{ fontWeight: 600, color: '#0b2546' }}>{selectedDoc.customerName}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>🏗️</span> Project Ref</span><span style={{ fontWeight: 600, color: '#1b6e38' }}>{selectedDoc.projectRef || 'General'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>📁</span> Category</span><span style={{ fontWeight: 600, color: '#0b2546' }}>{selectedDoc.category}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>📊</span> File Size</span><span style={{ fontWeight: 600, color: '#0b2546' }}>{selectedDoc.fileSize}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>📅</span> Upload Date</span><span style={{ fontWeight: 600, color: '#0b2546' }}>{selectedDoc.uploadDate}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#506e8c' }}><span style={{ color: '#2e8b38' }}>✍️</span> Added By</span><span style={{ fontWeight: 600, color: '#0b2546' }}>{selectedDoc.uploadedBy}</span></div>
              </div>

              <div style={{ backgroundColor: '#f5f9fe', borderRadius: '8px', padding: '0.75rem', border: '1px solid #e1edf7', fontSize: '0.75rem', color: '#506e8c', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                <strong>Notes:</strong>
                <p style={{ margin: '4px 0 0', color: '#0b2546' }}>{selectedDoc.description || 'System-generated or verified solar installation project document.'}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Status Dropdown Button matching other action buttons */}
                <div style={{ position: 'relative' }} ref={statusMenuRef}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setIsStatusMenuOpen(prev => !prev)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      justifyContent: 'space-between',
                      fontWeight: 600,
                      fontSize: '0.825rem',
                      padding: '0.55rem 0.85rem',
                      borderColor: '#0b75b9',
                      color: '#0b2546',
                      backgroundColor: isStatusMenuOpen ? '#f0f7fe' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem' }}>🔄</span>
                      <span style={{ color: '#506e8c', fontWeight: 500 }}>Status:</span>
                      {getStatusBadge(selectedDoc.status)}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#0b75b9',
                      transform: isStatusMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease'
                    }}>
                      ▼
                    </span>
                  </Button>

                  {isStatusMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #d4e5f5',
                      boxShadow: '0 8px 24px rgba(11, 37, 70, 0.14), 0 2px 6px rgba(11, 37, 70, 0.08)',
                      zIndex: 100,
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ padding: '4px 8px 6px', fontSize: '0.7rem', fontWeight: 700, color: '#506e8c', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #edf4fb' }}>
                        Change Document Status
                      </div>
                      {(['Approved', 'Verified', 'Pending Review', 'Draft'] as DocumentStatus[]).map((st) => {
                        const isCurrent = selectedDoc.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              handleUpdateStatus(selectedDoc.id, st);
                              setIsStatusMenuOpen(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderRadius: '6px',
                              border: isCurrent ? '1px solid #bbf7d0' : '1px solid transparent',
                              backgroundColor: isCurrent ? '#f0fdf4' : 'transparent',
                              color: isCurrent ? '#15803d' : '#0b2546',
                              fontWeight: isCurrent ? 700 : 500,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = '#f4f9fd';
                            }}
                            onMouseLeave={e => {
                              if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {getStatusBadge(st)}
                            </div>
                            {isCurrent ? (
                              <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.85rem' }}>✓</span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#0b75b9', fontWeight: 600 }}>Select</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button variant="secondary" onClick={() => handleOpenPreview(selectedDoc)} style={{ width: '100%', borderRadius: '8px', justifyContent: 'center', fontWeight: 600, fontSize: '0.825rem', padding: '0.55rem', borderColor: '#2e8b38', color: '#2e8b38' }}>View Details &gt;</Button>
                <Button variant="primary" disabled={downloadingPdfId === selectedDoc.id} onClick={() => handleDownload(selectedDoc)} style={{ width: '100%', borderRadius: '8px', justifyContent: 'center', fontWeight: 600, fontSize: '0.825rem', padding: '0.55rem', gap: '6px' }}>
                  {downloadingPdfId === selectedDoc.id ? (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span>📥</span>
                  )}
                  Download {selectedDoc.fileType}
                </Button>
                {!(selectedDoc.id.startsWith('INV-') || selectedDoc.id.startsWith('QUO-') || selectedDoc.id.startsWith('PRJ-')) && (
                  <Button variant="secondary" onClick={() => handleGenerateInvoice(selectedDoc)} style={{ width: '100%', borderRadius: '8px', justifyContent: 'center', fontWeight: 600, fontSize: '0.825rem', padding: '0.55rem', gap: '6px', borderColor: '#e57300', color: '#e57300', backgroundColor: '#fff7f0' }}><span>🧾</span> Generate Standard Invoice</Button>
                )}
                <button onClick={() => handleDelete(selectedDoc.id)} style={{ width: '100%', borderRadius: '8px', padding: '0.45rem', backgroundColor: 'transparent', border: '1px solid transparent', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Delete Document</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewModal document={previewDoc} isOpen={isPreviewOpen} isDownloading={previewDoc ? downloadingPdfId === previewDoc.id : false} onClose={() => { setIsPreviewOpen(false); setPreviewDoc(null); }} onDownload={handleDownload} onUpdateStatus={handleUpdateStatus} />
    </div>
  );
}
