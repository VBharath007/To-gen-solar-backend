import { InstallationSiteRepository } from './installation-site.repository';
import { CustomerRepository } from './customer.repository';
import { createInstallationSiteSchema, updateInstallationSiteSchema } from '@shared/schemas/installation-site.schema';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type { InstallationSite, CreateInstallationSiteDto, UpdateInstallationSiteDto } from '@shared/types/installation-site.types';

export class InstallationSiteService {
  private repository = new InstallationSiteRepository();
  private customerRepository = new CustomerRepository();

  public async listByCustomer(customerId: number): Promise<ApiResponse<InstallationSite[]>> {
    try {
      let sites = this.repository.listByCustomerId(customerId);
      if (sites.length === 0) {
        const customer = this.customerRepository.getById(customerId);
        if (customer && customer.address) {
          const autoSite = this.repository.create({
            customerId: customer.id,
            address: customer.address,
            city: customer.city || '',
            state: customer.state || '',
            postcode: customer.pincode || '',
          });
          sites = [autoSite];
        }
      }
      return ok(sites);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async getSite(id: number): Promise<ApiResponse<InstallationSite>> {
    try {
      const site = this.repository.getById(id);
      if (!site) return fail('NOT_FOUND', 'Installation Site not found');
      return ok(site);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async createSite(dto: CreateInstallationSiteDto): Promise<ApiResponse<InstallationSite>> {
    try {
      const parsed = createInstallationSiteSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', parsed.error.errors[0].message);
      }
      const site = this.repository.create(parsed.data as CreateInstallationSiteDto);
      return ok(site);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async updateSite(dto: UpdateInstallationSiteDto): Promise<ApiResponse<InstallationSite>> {
    try {
      const parsed = updateInstallationSiteSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', parsed.error.errors[0].message);
      }
      const site = this.repository.update(parsed.data as UpdateInstallationSiteDto);
      if (!site) return fail('NOT_FOUND', 'Installation Site not found');
      return ok(site);
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }

  public async deleteSite(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const deleted = this.repository.delete(id);
      if (!deleted) return fail('NOT_FOUND', 'Installation Site not found');
      return ok({ deleted: true });
    } catch (err: any) {
      return fail('INTERNAL', err.message);
    }
  }
}
