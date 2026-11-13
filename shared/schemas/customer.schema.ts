import { z } from 'zod';

/**
 * Zod schema for creating a customer.
 * Used in CustomerService (backend) and optionally in the React form for
 * client-side validation before the IPC call.
 */
export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name must not exceed 100 characters'),

  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must not exceed 15 characters')
    .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters'),

  email: z
    .string()
    .email('Enter a valid email address')
    .max(150, 'Email must not exceed 150 characters')
    .optional()
    .nullable()
    .or(z.literal('')),

  address: z.string().max(255, 'Address must not exceed 255 characters').optional().nullable().or(z.literal('')),

  city: z.string().max(100, 'City must not exceed 100 characters').optional().nullable().or(z.literal('')),

  state: z.string().max(100, 'State must not exceed 100 characters').optional().nullable().or(z.literal('')),

  pincode: z.string().max(20, 'Pincode must not exceed 20 characters').optional().nullable().or(z.literal('')),

  gstin: z.string().max(50).optional().nullable().or(z.literal('')),

  pan: z.string().max(50).optional().nullable().or(z.literal('')),

  customer_type: z
    .enum([
      'Individual',
      'Company',
      'Business',
      'Commercial',
      'Industrial',
      'Agricultural',
      'Government',
      'Residential',
      'Other',
    ])
    .or(z.string().max(50))
    .optional()
    .default('Individual'),

  company_name: z.string().max(255).optional().nullable().or(z.literal('')),

  alternate_phone: z.string().max(20).optional().nullable().or(z.literal('')),

  business_category: z.string().max(100).optional().nullable().or(z.literal('')),

  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional().nullable().or(z.literal('')),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .extend({ id: z.number().int().positive('id must be a positive integer') });

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
