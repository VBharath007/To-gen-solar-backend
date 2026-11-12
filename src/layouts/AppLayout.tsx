import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../context/UserProfileContext';
import logoImg from '../assets/images/logo.png';
import './AppLayout.css';

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavGroup({ title, children }: NavGroupProps) {
  return (
    <div className="nav-group">
      <div className="nav-group-title">{title}</div>
      {children}
    </div>
  );
}

function ToGenLogo() {
  const [processedLogo, setProcessedLogo] = useState<string>(logoImg);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logoImg;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const maxVal = Math.max(r, g, b);

            if (maxVal < 35) {
              data[idx + 3] = 0; // Pure transparent for black background
            } else {
              if (maxVal < 85) {
                data[idx + 3] = Math.round(((maxVal - 35) / 50) * 255);
              }
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Crop tightly around the logo
        const pad = 12;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(canvas.width - cropX, (maxX - minX) + pad * 2);
        const cropH = Math.min(canvas.height - cropY, (maxY - minY) + pad * 2);

        if (cropW > 0 && cropH > 0) {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d');
          if (cropCtx) {
            cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            setProcessedLogo(cropCanvas.toDataURL('image/png'));
          }
        }
      } catch {
        // Fallback gracefully to logoImg
      }
    };
  }, []);

  return (
    <div className="sidebar-logo-card">
      <img 
        src={processedLogo} 
        alt="TO-GEN SOLAR AGRO" 
        style={{
          width: '100%',
          maxHeight: '68px',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, initials } = useUserProfile();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/customers/new')) return 'New Customer';
    if (path.match(/^\/customers\/\d+/)) return 'Customer Details';
    if (path.startsWith('/customers')) return 'Customers';
    if (path.startsWith('/leads/new')) return 'New Lead';
    if (path.match(/^\/leads\/\d+\/edit/)) return 'Edit Lead';
    if (path.match(/^\/leads\/\d+/)) return 'Lead Details';
    if (path.startsWith('/leads')) return 'Leads';
    if (path.startsWith('/quotations')) return 'Quotations';
    if (path.startsWith('/products/new')) return 'New Product';
    if (path.match(/^\/products\/\d+\/edit/)) return 'Edit Product';
    if (path.match(/^\/products\/\d+/)) return 'Product Details';
    if (path.startsWith('/products')) return 'Products';
    if (path.startsWith('/packages')) return 'Packages';
    if (path.startsWith('/surveys/new')) return 'Schedule Survey';
    if (path.match(/^\/surveys\/\d+\/edit/)) return 'Edit Survey';
    if (path.match(/^\/surveys\/\d+/)) return 'Survey Details';
    if (path.startsWith('/surveys')) return 'Site Surveys';
    if (path.startsWith('/projects')) return 'Projects';
    if (path.startsWith('/invoices')) return 'Invoices';
    if (path.startsWith('/payments/new')) return 'Log Payment';
    if (path.match(/^\/payments\/\d+/)) return 'Payment Details';
    if (path.startsWith('/payments')) return 'Payments';
    if (path.startsWith('/accounts/new')) return 'New Bank Account';
    if (path.match(/^\/accounts\/.*\/edit/)) return 'Edit Bank Account';
    if (path.startsWith('/accounts')) return 'Accounts';
    // if (path.startsWith('/documents')) return 'Documents';
    if (path.startsWith('/reports')) return 'Reports';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Projects';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <ToGenLogo />
        
        <nav className="sidebar-nav">
          <NavGroup title="Overview">
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </span>
              <span>Dashboard</span>
            </NavLink>
          </NavGroup>

          <div className="nav-divider" />

          <NavGroup title="Sales">
            <NavLink to="/leads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
              </span>
              <span>Leads</span>
            </NavLink>
            <NavLink to="/customers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <span>Customers</span>
            </NavLink>
            <NavLink to="/quotations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </span>
              <span>Quotations</span>
            </NavLink>
          </NavGroup>

          <div className="nav-divider" />

          <NavGroup title="Operations">
            <NavLink to="/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </span>
              <span>Products</span>
            </NavLink>
            <NavLink to="/packages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </span>
              <span>Packages</span>
            </NavLink>
            <NavLink to="/surveys" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 22 22 22"></polygon>
                  <line x1="12" y1="12" x2="12" y2="18"></line>
                </svg>
              </span>
              <span>Site Surveys</span>
            </NavLink>
            <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </span>
              <span>Projects</span>
            </NavLink>
          </NavGroup>

          <div className="nav-divider" />

          <NavGroup title="Billing & Payments">
            <NavLink to="/invoices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </span>
              <span>Invoices</span>
            </NavLink>
            <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </span>
              <span>Payments</span>
            </NavLink>
          </NavGroup>

          <div className="nav-divider" />

          <NavGroup title="Bank">
            <NavLink to="/accounts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18"></path>
                  <path d="M3 10h18"></path>
                  <path d="M5 6l7-3 7 3"></path>
                  <path d="M4 10v11"></path>
                  <path d="M20 10v11"></path>
                  <path d="M8 14v4"></path>
                  <path d="M12 14v4"></path>
                  <path d="M16 14v4"></path>
                </svg>
              </span>
              <span>Accounts</span>
            </NavLink>
          </NavGroup>

          <div className="nav-divider" />

          <NavGroup title="Administration">
            {/* <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </span>
              <span>Documents</span>
            </NavLink> */}
            <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </span>
              <span>Reports</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </span>
              <span>Settings</span>
            </NavLink>
          </NavGroup>
        </nav>

        <div className="sidebar-footer">
          <div className="version-info">ToGen Solar v0.1.0</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h2>{getPageTitle()}</h2>
          </div>
          <div className="topbar-actions">
            <div className="topbar-search">
              <span className="topbar-search-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search..."
                className="topbar-search-input"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>

            <div
              className="topbar-user-badge"
              onClick={() => navigate('/settings')}
              title="Click to view User Profile and CRM Settings"
              style={{ cursor: 'pointer' }}
            >
              <div className="user-avatar-circle">{initials}</div>
              <span className="user-name-text">{profile.displayName}</span>
              <span className="user-dropdown-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </div>
        </header>
        
        <div className="page-container">
          <div className="page-content">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
