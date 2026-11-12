import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { UserProfileProvider } from './context/UserProfileContext';
import { AlertProvider } from './context/AlertContext';

// Connected Features
import Dashboard from './features/dashboard/Dashboard';
import CustomerList from './features/customers/CustomerList';
import CustomerDetail from './features/customers/CustomerDetail';
import CustomerForm from './features/customers/CustomerForm';
import LeadsList from './features/leads/LeadsList';
import LeadForm from './features/leads/LeadForm';
import LeadDetail from './features/leads/LeadDetail';

// Unconnected Features (UI Only)
import QuotationsList from './features/quotations/QuotationsList'; // Force TS server refresh
import QuotationEditor from './features/quotations/QuotationEditor';
import SurveysList from './features/surveys/SurveysList';
import SurveyForm from './features/surveys/SurveyForm';
import SurveyDetail from './features/surveys/SurveyDetail';
import ProductsList from './features/products/ProductsList';
import ProductForm from './features/products/ProductForm';
import ProductDetail from './features/products/ProductDetail';
import PackagesList from './features/packages/PackagesList';
import PackageForm from './features/packages/PackageForm';
import ProjectsList from './features/projects/ProjectsList';
import ProjectForm from './features/projects/ProjectForm';
import ProjectDetail from './features/projects/ProjectDetail';
import InvoicesList from './features/finance/InvoicesList';
import InvoiceForm from './features/finance/InvoiceForm';
import InvoiceDetail from './features/finance/InvoiceDetail';
import PaymentsList from './features/finance/PaymentsList';
import PaymentForm from './features/finance/PaymentForm';
import PaymentDetail from './features/finance/PaymentDetail';
import AccountsView from './features/accounts/AccountsView';
import AccountForm from './features/accounts/AccountForm';
// import DocumentCenter from './features/documents/DocumentCenter';
import ReportsCenter from './features/reports/ReportsCenter';
import SettingsView from './features/settings/SettingsView';
import { FirstRunSetupModal } from './features/settings/FirstRunSetupModal';
import { StorageRecoveryScreen } from './features/settings/StorageRecoveryScreen';

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [storageMissing, setStorageMissing] = useState<boolean>(false);
  const [missingPath, setMissingPath] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);

  const checkAppStatus = useCallback(async () => {
    try {
      if (window.desktop?.app?.getStatus) {
        const res = await window.desktop.app.getStatus();
        if (res.success && res.data) {
          setNeedsSetup(!!res.data.needsSetup);
          setStorageMissing(!!res.data.storageMissing);
          setMissingPath(res.data.missingPath || '');
        }
      }
    } catch (err) {
      console.warn('[App] Failed to query desktop status:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkAppStatus();
  }, [checkAppStatus]);

  if (isCheckingStatus) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#94a3b8',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>☀️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>To-Gen Solar CRM</div>
          <div style={{ fontSize: '13px', marginTop: '6px', color: '#64748b' }}>Connecting storage...</div>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <FirstRunSetupModal
        onSetupComplete={() => {
          setNeedsSetup(false);
          checkAppStatus();
        }}
      />
    );
  }

  if (storageMissing) {
    return (
      <StorageRecoveryScreen
        missingPath={missingPath}
        onRecovered={() => {
          setStorageMissing(false);
          checkAppStatus();
        }}
      />
    );
  }

  return (
    <UserProfileProvider>
      <AlertProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              <Route path="dashboard" element={<Dashboard />} />
              
              <Route path="customers">
                <Route index element={<CustomerList />} />
                <Route path="new" element={<CustomerForm />} />
                <Route path=":id" element={<CustomerDetail />} />
                <Route path=":id/edit" element={<CustomerForm />} />
              </Route>

              {/* Sales */}
              <Route path="leads">
                <Route index element={<LeadsList />} />
                <Route path="new" element={<LeadForm />} />
                <Route path=":id" element={<LeadDetail />} />
                <Route path=":id/edit" element={<LeadForm />} />
              </Route>
              <Route path="quotations">
                <Route index element={<QuotationsList />} />
                <Route path="new" element={<QuotationEditor />} />
                <Route path=":id" element={<QuotationEditor />} />
              </Route>

              {/* Operations */}
              <Route path="/products" element={<ProductsList />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/products/:id/edit" element={<ProductForm />} />
              
              <Route path="/packages" element={<PackagesList />} />
              <Route path="/packages/new" element={<PackageForm />} />
              <Route path="/packages/:id/edit" element={<PackageForm />} />
              
              <Route path="/surveys" element={<SurveysList />} />
              <Route path="/surveys/new" element={<SurveyForm />} />
              <Route path="/surveys/:id" element={<SurveyDetail />} />
              <Route path="/surveys/:id/edit" element={<SurveyForm />} />
              
              <Route path="projects">
                <Route index element={<ProjectsList />} />
                <Route path="new" element={<ProjectForm />} />
                <Route path=":id" element={<ProjectDetail />} />
                <Route path=":id/edit" element={<ProjectForm />} />
              </Route>

              <Route path="/invoices" element={<InvoicesList />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
              
              <Route path="/payments" element={<PaymentsList />} />
              <Route path="/payments/new" element={<PaymentForm />} />
              <Route path="/payments/:id" element={<PaymentDetail />} />
              
              {/* Accounts */}
              <Route path="/accounts" element={<AccountsView />} />
              <Route path="/accounts/new" element={<AccountForm />} />
              <Route path="/accounts/:id/edit" element={<AccountForm />} />

              {/* <Route path="documents" element={<DocumentCenter />} /> */}

              {/* Admin */}
              <Route path="reports" element={<ReportsCenter />} />
              <Route path="settings" element={<SettingsView />} />
            </Route>
          </Routes>
        </HashRouter>
      </AlertProvider>
    </UserProfileProvider>
  );
}

export default App;

