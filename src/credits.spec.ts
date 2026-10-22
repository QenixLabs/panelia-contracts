import { describe, expect, it } from 'vitest';
import type { PlanTier } from './chapter.js';
import {
  CREDIT_PRICES,
  TRIAL_GRANT,
  creditEntrySchema,
  creditEntryTypeSchema,
  creditSummarySchema,
  planCost,
} from './credits.js';
import type { CreditEntry, CreditSummary } from './credits.js';

// planCost only counts panels, so placeholder panels are enough here.
const planOf = (...sceneSizes: number[]) => ({
  scenes: sceneSizes.map((n) => ({ panels: Array.from({ length: n }, () => ({})) })),
});

const entry: CreditEntry = {
  id: '64b7f0c2a1b2c3d4e5f60720',
  type: 'reserve',
  amount: 70,
  availableAfter: 80,
  reservedAfter: 70,
  memo: 'Ch. 3 · The Rooftop',
  createdAt: '2026-10-22T09:30:00.000Z',
};

describe('prices and the trial grant', () => {
  it('charges 5 credits per Draft panel and 12 per HQ panel', () => {
    expect(CREDIT_PRICES).toEqual({ panel: { draft: 5, hq: 12 } });
  });

  it('grants 150 trial credits', () => {
    expect(TRIAL_GRANT).toBe(150);
  });
});

describe('planCost', () => {
  const table: Array<[PlanTier, number[], number]> = [
    ['draft', [1], 5],
    ['hq', [1], 12],
    ['draft', [3, 4, 3, 4], 70],
    ['hq', [3, 4, 3, 4], 168],
    ['draft', [30, 30], 300],
    ['hq', [30, 30], 720],
  ];

  it.each(table)('%s with scenes of %j panels costs %i', (tier, sceneSizes, cost) => {
    expect(planCost(planOf(...sceneSizes), tier)).toBe(cost);
  });

  it('is 0 for an empty plan in either tier', () => {
    expect(planCost({ scenes: [] }, 'draft')).toBe(0);
    expect(planCost({ scenes: [] }, 'hq')).toBe(0);
  });
});

describe('creditEntrySchema', () => {
  it('round-trips a reserve entry', () => {
    expect(creditEntrySchema.parse(entry)).toEqual(entry);
  });

  it('has the four ledger entry types', () => {
    expect(creditEntryTypeSchema.options).toEqual(['grant', 'reserve', 'release', 'charge']);
  });

  it('rejects a zero amount, a negative balance and an unknown type', () => {
    expect(creditEntrySchema.safeParse({ ...entry, amount: 0 }).success).toBe(false);
    expect(creditEntrySchema.safeParse({ ...entry, availableAfter: -1 }).success).toBe(false);
    expect(creditEntrySchema.safeParse({ ...entry, type: 'refund' }).success).toBe(false);
  });
});

describe('creditSummarySchema', () => {
  const summary = (entries: CreditEntry[]): CreditSummary => ({ available: 80, reserved: 70, entries });
  const entries = (n: number) => Array.from({ length: n }, () => entry);

  it('holds at most the 20 newest entries', () => {
    expect(creditSummarySchema.safeParse(summary(entries(20))).success).toBe(true);
    expect(creditSummarySchema.safeParse(summary(entries(21))).success).toBe(false);
  });

  it('rejects a negative balance', () => {
    expect(creditSummarySchema.safeParse({ ...summary([]), reserved: -5 }).success).toBe(false);
  });
});
