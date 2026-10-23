import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, planTierSchema, shotTypeSchema } from './plan-basics.js';
import * as chapter from './chapter.js';

describe('plan-basics (leaf module)', () => {
  it('holds the shot types, the tiers and the plan limits', () => {
    expect(shotTypeSchema.options).toEqual([
      'establishing', 'wide', 'medium', 'close_up',
      'extreme_close_up', 'over_shoulder', 'pov', 'insert',
    ]);
    expect(planTierSchema.options).toEqual(['draft', 'hq']);
    expect(PLAN_LIMITS).toEqual({
      scenes: 30, panels: 60, panelsPerScene: 40, dialogueLines: 8, panelCast: 8, sceneCast: 12,
    });
  });

  it('is re-exported by chapter.ts as the very same objects', () => {
    expect(chapter.shotTypeSchema).toBe(shotTypeSchema);
    expect(chapter.planTierSchema).toBe(planTierSchema);
    expect(chapter.PLAN_LIMITS).toBe(PLAN_LIMITS);
  });
});
