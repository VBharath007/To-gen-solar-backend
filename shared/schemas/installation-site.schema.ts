import { z } from 'zod';

export const createInstallationSiteSchema = z.object({
  customerId: z.number().int().positive('Customer ID must be a positive integer'),
  address: z.string().min(2, 'Address is required').max(255, 'Address must not exceed 255 characters'),
  city: z.string().min(2, 'City is required').max(100, 'City must not exceed 100 characters'),
  state: z.string().max(100).optional().nullable(),
  postcode: z.string().max(20, 'Postcode must not exceed 20 characters').optional().nullable().or(z.literal('')),
  siteNotes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional().nullable(),
  utility_provider: z.string().max(100).optional().nullable(),
  consumer_number: z.string().max(100).optional().nullable(),
  sanctioned_load_kw: z.number().optional().nullable(),
  tariff_category: z.string().max(100).optional().nullable(),
  connection_phase: z.enum(['1-Phase', '3-Phase']).optional().nullable(),
  average_monthly_bill: z.number().optional().nullable(),
});

export type CreateInstallationSiteInput = z.infer<typeof createInstallationSiteSchema>;

export const updateInstallationSiteSchema = createInstallationSiteSchema
  .omit({ customerId: true })
  .partial()
  .extend({ id: z.number().int().positive('id must be a positive integer') });

export type UpdateInstallationSiteInput = z.infer<typeof updateInstallationSiteSchema>;
