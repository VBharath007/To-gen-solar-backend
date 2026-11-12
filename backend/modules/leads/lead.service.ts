import { z } from 'zod';
import { ApiResponse, ok, fail, exception } from '@shared/types/api-response.types';
import type { Lead, CreateLeadDto, UpdateLeadDto } from '@shared/types/lead.types';
import { LeadRepository } from './lead.repository';
import { getDb } from '../../database/connection';
import { checkPhoneDuplicate } from '../../utils/phone-duplicate';
import { CustomerService } from '../customers/customer.service';

// Note: Zod enums must exactly match the TypeScript types
const leadStatusEnum = z.enum(['New', 'Contacted', 'Qualified', 'Lost', 'Converted']);
const leadSourceEnum = z.enum(['Website', 'Referral', 'Social Media', 'Direct', 'Other']);

const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.union([z.literal(''), z.string().email('Invalid email address')]).optional().nullable(),
  source: leadSourceEnum.optional().nullable(),
  status: leadStatusEnum.optional().default('New'),
  business_category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateLeadSchema = createLeadSchema.partial().extend({
  id: z.number().int().positive(),
});

/**
 * Handles business logic, validation, and orchestrates database access via the repository.
 * Every method returns an ApiResponse<T> to guarantee a standardized IPC payload.
 */
export class LeadService {
  private repo: LeadRepository;

  constructor() {
    this.repo = new LeadRepository();
  }

  listLeads(): ApiResponse<Lead[]> {
    try {
      const leads = this.repo.list();
      return ok(leads);
    } catch (err) {
      return exception(err, 'Failed to list leads');
    }
  }

  getLead(id: number): ApiResponse<Lead> {
    try {
      const lead = this.repo.getById(id);
      if (!lead) {
        return fail('NOT_FOUND', `Lead with ID ${id} not found.`);
      }
      return ok(lead);
    } catch (err) {
      return exception(err, `Failed to fetch lead ${id}`);
    }
  }

  async createLead(dto: CreateLeadDto): Promise<ApiResponse<Lead>> {
    try {
      const parsed = createLeadSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', 'Invalid lead data', parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }

      // Check phone uniqueness across Customer and Lead modules
      const db = getDb();
      const dupCheck = checkPhoneDuplicate(db, parsed.data.phone);
      if (!dupCheck.isValid) {
        return fail('VALIDATION', dupCheck.message || 'Please enter a valid 10-digit mobile number.');
      }
      if (dupCheck.isDuplicate) {
        if (parsed.data.status === 'Converted' && dupCheck.module === 'Customer') {
          // allow
        } else {
          return fail('VALIDATION', dupCheck.message || 'This phone number already exists.');
        }
      }

      parsed.data.phone = dupCheck.normalizedPhone;
      const newLead = this.repo.create(parsed.data as CreateLeadDto);

      if (newLead.status === 'Converted') {
        const customerService = new CustomerService();
        const check = checkPhoneDuplicate(getDb(), newLead.phone, { excludeLeadId: newLead.id });
        if (!check.isDuplicate || check.module !== 'Customer') {
          await customerService.createCustomer({
            name: newLead.name,
            phone: newLead.phone,
            email: newLead.email,
            customer_type: 'Individual',
            business_category: newLead.business_category || null,
            notes: newLead.notes ? `Converted from Lead (Source: ${newLead.source || 'Unknown'}).\n\nNotes: ${newLead.notes}` : `Converted from Lead (Source: ${newLead.source || 'Unknown'})`,
          });
        } else if (newLead.business_category) {
          const db = getDb();
          const existingCust = db.prepare('SELECT id, business_category FROM customers WHERE phone = ?').get(newLead.phone) as any;
          if (existingCust && !existingCust.business_category) {
            await customerService.updateCustomer({
              id: existingCust.id,
              business_category: newLead.business_category,
            });
          }
        }
      }

      return ok(newLead);
    } catch (err: any) {
      if (err.message?.includes('registered as a Customer') || err.message?.includes('idx_leads_phone') || err.message?.includes('UNIQUE constraint failed: leads.phone')) {
        return fail('VALIDATION', err.message?.includes('registered as a Customer') ? err.message : 'This phone number is already registered as a Lead.');
      }
      return exception(err, 'Failed to create lead');
    }
  }

  async updateLead(dto: UpdateLeadDto): Promise<ApiResponse<Lead>> {
    try {
      const parsed = updateLeadSchema.safeParse(dto);
      if (!parsed.success) {
        return fail('VALIDATION', 'Invalid lead data', parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }

      // Check phone uniqueness across Customer and Lead modules (excluding current lead)
      if (parsed.data.phone !== undefined) {
        const db = getDb();
        const dupCheck = checkPhoneDuplicate(db, parsed.data.phone, { excludeLeadId: parsed.data.id });
        if (!dupCheck.isValid) {
          return fail('VALIDATION', dupCheck.message || 'Please enter a valid 10-digit mobile number.');
        }
        if (dupCheck.isDuplicate) {
          // Allow converting the lead even if the customer already exists (we'll just skip creating a new customer)
          if (parsed.data.status === 'Converted' && dupCheck.module === 'Customer') {
            // allow
          } else {
            return fail('VALIDATION', dupCheck.message || 'This phone number already exists.');
          }
        }
        parsed.data.phone = dupCheck.normalizedPhone;
      }

      const updatedLead = this.repo.update(parsed.data as UpdateLeadDto);

      if (updatedLead.status === 'Converted') {
        const customerService = new CustomerService();
        const check = checkPhoneDuplicate(getDb(), updatedLead.phone, { excludeLeadId: updatedLead.id });
        if (!check.isDuplicate || check.module !== 'Customer') {
          await customerService.createCustomer({
            name: updatedLead.name,
            phone: updatedLead.phone,
            email: updatedLead.email,
            customer_type: 'Individual',
            business_category: updatedLead.business_category || null,
            notes: updatedLead.notes ? `Converted from Lead (Source: ${updatedLead.source || 'Unknown'}).\n\nNotes: ${updatedLead.notes}` : `Converted from Lead (Source: ${updatedLead.source || 'Unknown'})`,
          });
        } else if (updatedLead.business_category) {
          const db = getDb();
          const existingCust = db.prepare('SELECT id, business_category FROM customers WHERE phone = ?').get(updatedLead.phone) as any;
          if (existingCust && !existingCust.business_category) {
            await customerService.updateCustomer({
              id: existingCust.id,
              business_category: updatedLead.business_category,
            });
          }
        }
      }

      return ok(updatedLead);
    } catch (err: any) {
      if (err.message?.includes('registered as a Customer') || err.message?.includes('idx_leads_phone') || err.message?.includes('UNIQUE constraint failed: leads.phone')) {
        return fail('VALIDATION', err.message?.includes('registered as a Customer') ? err.message : 'This phone number is already registered as a Lead.');
      }
      if (err.message?.includes('not found')) {
        return fail('NOT_FOUND', err.message);
      }
      return exception(err, 'Failed to update lead');
    }
  }

  deleteLead(id: number): ApiResponse<{ deleted: boolean }> {
    try {
      const existing = this.repo.getById(id);
      if (!existing) {
        return fail('NOT_FOUND', `Lead with ID ${id} not found.`);
      }
      this.repo.delete(id);
      return ok({ deleted: true });
    } catch (err) {
      return exception(err, `Failed to delete lead ${id}`);
    }
  }
}
