import { z } from 'zod';
import { entityIdSchema, isoDateTimeSchema } from './primitives.js';

export const userPlanSchema = z.enum(['free', 'pro', 'studio', 'max']);

export const userSchema = z.object({
  id: entityIdSchema,
  email: z.email(),
  name: z.string().min(1).max(80),
  plan: userPlanSchema,
  avatarUrl: z.url().optional(),
  createdAt: isoDateTimeSchema,
});

export type UserPlan = z.infer<typeof userPlanSchema>;
export type User = z.infer<typeof userSchema>;
