import { z } from 'zod';

export const couponSchema = z.object({
  code: z.string().min(1, 'El código es requerido').transform(v => v.toUpperCase()),
  type: z.enum(['percentage', 'fixed']),
  discount_amount: z.number().optional(),   // for fixed
  discount_percent: z.number().optional(),  // for percentage
  event_id: z.string().optional(),
  zone_id: z.string().optional(),
  max_uses: z.number().int().positive().optional(),
  max_uses_per_customer: z.number().int().positive().optional(),
  min_tickets: z.number().int().positive().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  is_public: z.boolean().optional(),
});

export type CouponFormData = z.infer<typeof couponSchema>;
