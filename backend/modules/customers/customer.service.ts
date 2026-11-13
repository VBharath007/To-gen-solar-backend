import { CustomerRepository } from './customer.repository';
import { InstallationSiteRepository } from './installation-site.repository';
import { createCustomerSchema, updateCustomerSchema } from '@shared/schemas/customer.schema';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@shared/types/customer.types';
import { getDb } from '../../database/connection';
import { checkPhoneDuplicate } from '../../utils/phone-duplicate';

export class CustomerService {
  private repository = new CustomerRepository();
  private siteRepository = new InstallationSiteRepository();

  public async listCustomers(): Promise<ApiResponse<Customer[]>> {
    try {
      const customers = this.repository.list();
      return ok(customers);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async getCustomer(id: number): Promise<ApiResponse<Customer>> {
    try {
      const customer = this.repository.getById(id);
      if (!customer) return fail('NOT_FOUND', 'Customer not found');
      return ok(customer);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async createCustomer(dto: CreateCustomerDto): Promise<ApiResponse<Customer>> {
    try {
      const parsed = createCustomerSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', parsed.error.errors[0].message);
      }

      // Check phone uniqueness across Customer and Lead modules
      const db = getDb();
      const dupCheck = checkPhoneDuplicate(db, parsed.data.phone);
      if (!dupCheck.isValid) {
        return fail('VALIDATION', dupCheck.message || 'Please enter a valid 10-digit mobile number.');
      }
      if (dupCheck.isDuplicate) {
        return fail('VALIDATION', dupCheck.message || 'This phone number already exists.');
      }

      parsed.data.phone = dupCheck.normalizedPhone;
      const customer = this.repository.create(parsed.data as CreateCustomerDto);

      if (customer.address) {
        try {
          this.siteRepository.create({
            customerId: customer.id,
            address: customer.address,
            city: customer.city || '',
            state: customer.state || '',
            postcode: customer.pincode || '',
          });
        } catch (e) {
          console.error('Failed to create installation site for customer:', e);
        }
      }

      return ok(customer);
    } catch (err: any) {
      if (err.message?.includes('registered as a Lead') || err.message?.includes('idx_customers_phone') || err.message?.includes('UNIQUE constraint failed: customers.phone')) {
        return fail('VALIDATION', err.message?.includes('registered as a Lead') ? err.message : 'This phone number is already registered as a Customer.');
      }
      return fail('INTERNAL', err.message);
    }
  }

  public async updateCustomer(dto: UpdateCustomerDto): Promise<ApiResponse<Customer>> {
    try {
      const parsed = updateCustomerSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', parsed.error.errors[0].message);
      }

      // Check phone uniqueness across Customer and Lead modules (excluding current customer)
      if (parsed.data.phone !== undefined) {
        const db = getDb();
        const dupCheck = checkPhoneDuplicate(db, parsed.data.phone, { excludeCustomerId: parsed.data.id });
        if (!dupCheck.isValid) {
          return fail('VALIDATION', dupCheck.message || 'Please enter a valid 10-digit mobile number.');
        }
        if (dupCheck.isDuplicate) {
          return fail('VALIDATION', dupCheck.message || 'This phone number already exists.');
        }
        parsed.data.phone = dupCheck.normalizedPhone;
      }

      const customer = this.repository.update(parsed.data as UpdateCustomerDto);
      if (!customer) return fail('NOT_FOUND', 'Customer not found');

      if (customer.address) {
        try {
          const existingSites = this.siteRepository.listByCustomerId(customer.id);
          if (existingSites.length === 0) {
            this.siteRepository.create({
              customerId: customer.id,
              address: customer.address,
              city: customer.city || '',
              state: customer.state || '',
              postcode: customer.pincode || '',
            });
          } else {
            this.siteRepository.update({
              id: existingSites[0].id,
              address: customer.address,
              city: customer.city || '',
              state: customer.state || '',
              postcode: customer.pincode || '',
            });
          }
        } catch (e) {
          console.error('Failed to sync installation site on customer update:', e);
        }
      }

      return ok(customer);
    } catch (err: any) {
      if (err.message?.includes('registered as a Lead') || err.message?.includes('idx_customers_phone') || err.message?.includes('UNIQUE constraint failed: customers.phone')) {
        return fail('VALIDATION', err.message?.includes('registered as a Lead') ? err.message : 'This phone number is already registered as a Customer.');
      }
      return fail('INTERNAL', err.message);
    }
  }

  public async deleteCustomer(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const deleted = this.repository.delete(id);
      if (!deleted) return fail('NOT_FOUND', 'Customer not found');
      return ok({ deleted: true });
    } catch (err: any) {
      console.error('[CustomerService.deleteCustomer] Error:', err);
      return fail('INTERNAL', err.message || 'Failed to delete customer');
    }
  }
}
