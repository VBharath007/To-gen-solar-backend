import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate, formatDateDMY } from '../../utils/formatters';
import type { Customer } from '@shared/types/customer.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await window.desktop.customers.get(Number(id));
      if (res.success) {
        setCustomer(res.data);
      } else {
        setError(res.error?.message || 'Failed to load customer');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while loading customer details.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleDelete = async () => {
    if (!customer) return;

    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Customer',
      description: `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Customer',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });

    if (!confirmed) return;

    try {
      const res = await window.desktop.customers.delete(customer.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Customer Deleted',
          description: `Customer "${customer.name}" was successfully removed.`,
        });
        navigate('/customers');
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete customer',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || 'An error occurred while deleting the customer.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <span>Loading customer details...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error" message={error || 'Customer not found.'} className="mb-4" />
        <Button variant="secondary" onClick={() => navigate('/customers')}>
          ← Back to Customers
        </Button>
      </div>
    );
  }

  const getCustomerTypeBadgeVariant = (type?: string) => {
    switch (type) {
      case 'Business':
        return 'info';
      case 'Government':
        return 'warning';
      case 'Individual':
        return 'success';
      default:
        return 'default';
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      <PageHeader 
        title={customer.name} 
        description={`Customer ID: #${customer.id} • Registered on ${formatDateDMY(customer.createdAt)}`}
        breadcrumbs={[
          { label: 'Customers', to: '/customers' },
          { label: customer.name }
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/customers')}>
              ← Back to List
            </Button>
            <Button variant="primary" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
              Edit Details
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6 mt-6">
        {/* Row 1: Basic Information & Contact Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Basic Information */}
          <Card title="Basic Information">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Customer Type</label>
                <div style={{ marginTop: '2px' }}>
                  <Badge variant={getCustomerTypeBadgeVariant(customer.customer_type)}>
                    {customer.customer_type || 'Individual'}
                  </Badge>
                </div>
              </div>

              {customer.business_category && (
                <div>
                  <label style={labelStyle}>Business Category</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {customer.business_category}
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Full Name (Primary Contact)</label>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {customer.name}
                </div>
              </div>

              {customer.customer_type === 'Business' && (
                <div>
                  <label style={labelStyle}>Company Name</label>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {customer.company_name || '—'}
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Customer ID</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  #{customer.id}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Date Registered</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {formatDate(customer.createdAt)}
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Contact Details */}
          <Card title="Contact Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <a 
                    href={`tel:${customer.phone}`} 
                    style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)' }}
                    className="hover:underline"
                  >
                    {customer.phone}
                  </a>
                  <button 
                    type="button"
                    onClick={() => copyToClipboard(customer.phone, 'phone')}
                    className="text-xs px-2 py-0.5 border rounded"
                    title="Copy phone"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                  >
                    {copiedField === 'phone' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Alternate Phone</label>
                {customer.alternate_phone ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <a 
                      href={`tel:${customer.alternate_phone}`} 
                      style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--primary-color)' }}
                      className="hover:underline"
                    >
                      {customer.alternate_phone}
                    </a>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(customer.alternate_phone!, 'alt_phone')}
                      className="text-xs px-2 py-0.5 border rounded"
                      title="Copy alternate phone"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                    >
                      {copiedField === 'alt_phone' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Not provided</div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Email Address</label>
                {customer.email ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <a 
                      href={`mailto:${customer.email}`} 
                      style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--accent-blue)' }}
                      className="hover:underline"
                    >
                      {customer.email}
                    </a>
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(customer.email!, 'email')}
                      className="text-xs px-2 py-0.5 border rounded"
                      title="Copy email"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                    >
                      {copiedField === 'email' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Not provided</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Row 2: Billing & Address and Tax Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Card 3: Billing & Address */}
          <Card title="Billing & Address">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Billing Address</label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {customer.address || <span className="text-muted">Not provided</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {customer.city || '—'}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>State</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {customer.state || '—'}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Pincode</label>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {customer.pincode || '—'}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 4: Tax Details */}
          <Card title="Tax Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>GSTIN</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {customer.gstin || <span className="text-muted" style={{ fontFamily: 'inherit' }}>Not provided</span>}
                  </div>
                  {customer.gstin && (
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(customer.gstin!, 'gstin')}
                      className="text-xs px-2 py-0.5 border rounded"
                      title="Copy GSTIN"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                    >
                      {copiedField === 'gstin' ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label style={labelStyle}>PAN</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {customer.pan || <span className="text-muted" style={{ fontFamily: 'inherit' }}>Not provided</span>}
                  </div>
                  {customer.pan && (
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(customer.pan!, 'pan')}
                      className="text-xs px-2 py-0.5 border rounded"
                      title="Copy PAN"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                    >
                      {copiedField === 'pan' ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Row 3: Internal Notes */}
        <Card title="Internal Notes">
          {customer.notes?.trim() ? (
            <div 
              style={{ 
                fontSize: '0.925rem',
                color: 'var(--text-primary)',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-subtle)', 
                border: '1px solid var(--border-color-subtle)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}
            >
              {customer.notes}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No internal notes or remarks recorded for this customer.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
