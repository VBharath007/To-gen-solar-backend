import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer } from '@shared/types/customer.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { DataTable } from '../../components/common/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDateDMY } from '../../utils/formatters';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { showConfirm, showAlert } = useAlert();
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await window.desktop.customers.list();
      if (res.success) {
        setCustomers(res.data);
      } else {
        setError(res.error?.message || 'Failed to load customers');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Customer',
      description: `Are you sure you want to permanently delete "${c.name}"? This action cannot be undone.`,
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await window.desktop.customers.delete(c.id);
      if (res.success) {
        await loadCustomers();
      } else {
        await showAlert({
          type: 'error',
          title: 'Cannot Delete Customer',
          description: 'Failed to delete customer. They may have associated installation sites or quotations.'
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || String(err),
      });
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns = [
    { header: 'ID', accessor: 'id' as keyof Customer, width: '70px' },
    { header: 'Name', accessor: 'name' as keyof Customer },
    { header: 'Phone', accessor: 'phone' as keyof Customer },
    { header: 'Email', accessor: (c: Customer) => c.email || '-' },
    { header: 'City', accessor: (c: Customer) => c.city || '-' },
    { header: 'Added', accessor: (c: Customer) => formatDateDMY(c.createdAt) },
    {
      header: 'Actions',
      accessor: (c: Customer) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            className="text-xs py-1 px-3 whitespace-nowrap"
            style={{ color: '#0f172a', borderColor: '#cbd5e1', backgroundColor: '#ffffff' }}
            onClick={() => navigate(`/customers/${c.id}`)}
          >
            View
          </Button>
          <Button
            variant="outline"
            className="text-xs py-1 px-3 whitespace-nowrap"
            style={{ color: '#16a34a', borderColor: '#16a34a', backgroundColor: '#ffffff' }}
            onClick={() => navigate(`/customers/${c.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-xs py-1 px-3 whitespace-nowrap"
            style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#ffffff' }}
            onClick={(e) => handleDelete(c, e)}
          >
            Delete
          </Button>
        </div>
      ),
      width: '240px'
    }
  ];

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Customers" 
        description="Manage your solar customer base and their installation sites."
        action={
          <Button variant="primary" onClick={() => navigate('/customers/new')}>
            + New Customer
          </Button>
        }
      />

      {error && <Alert type="error" message={error} className="mb-6" />}

      <DataTable 
        columns={columns}
        data={filteredCustomers}
        keyExtractor={(row) => row.id.toString()}
        searchPlaceholder="Search customers by name, phone, or email..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        itemLabel="customers"
        emptyState={
          <EmptyState 
            icon="👥"
            title="No customers found"
            description={searchTerm ? "No customers match your search criteria." : "You haven't added any customers yet. Add a customer to manage their installation sites and quotations."}
            action={!searchTerm ? (
              <Button variant="primary" onClick={() => navigate('/customers/new')}>
                Add First Customer
              </Button>
            ) : undefined}
          />
        }
      />
    </div>
  );
}
