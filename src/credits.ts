import { z } from 'zod';
import { countPanels } from './chapter.js';
import type { PlanTier } from './chapter.js';
import { isoDateTimeSchema, objectIdSchema } from './primitives.js';

export const CREDIT_PRICES = { panel: { draft: 5, hq: 12 } } as const;

export const TRIAL_GRANT = 150;

/** Web shows this live; the server recomputes it and stays authoritative at approve. */
export function planCost(
  plan: { scenes: readonly { panels: readonly unknown[] }[] },
  tier: PlanTier,
): number {
  return countPanels(plan) * CREDIT_PRICES.panel[tier];
}

export const creditEntryTypeSchema = z.enum(['grant', 'reserve', 'release', 'charge']);

export const creditEntrySchema = z.object({
  id: objectIdSchema,
  type: creditEntryTypeSchema,
  amount: z.number().int().positive(),
  availableAfter: z.number().int().nonnegative(),
  reservedAfter: z.number().int().nonnegative(),
  memo: z.string(), // snapshot, e.g. "Ch. 3 · The Rooftop" or "Free trial credits"
  createdAt: isoDateTimeSchema,
});

export const creditSummarySchema = z.object({
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  entries: z.array(creditEntrySchema).max(20), // newest first
});

export type CreditEntryType = z.infer<typeof creditEntryTypeSchema>;
export type CreditEntry = z.infer<typeof creditEntrySchema>;
export type CreditSummary = z.infer<typeof creditSummarySchema>;
