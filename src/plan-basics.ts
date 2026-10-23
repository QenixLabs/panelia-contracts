import { z } from 'zod';

// A leaf module (zod only). render.ts and layout.ts need these, and chapter.ts imports
// render.ts, so they can't come from chapter.ts: the import cycle would leave schemas
// undefined while the modules evaluate. chapter.ts re-exports all of them, so the
// package's public exports don't change.

export const PLAN_LIMITS = {
  scenes: 30,
  panels: 60,
  panelsPerScene: 40,
  dialogueLines: 8,
  panelCast: 8,
  sceneCast: 12,
} as const;

export const shotTypeSchema = z.enum([
  'establishing',
  'wide',
  'medium',
  'close_up',
  'extreme_close_up',
  'over_shoulder',
  'pov',
  'insert',
]);

export const planTierSchema = z.enum(['draft', 'hq']);

export type ShotType = z.infer<typeof shotTypeSchema>;
export type PlanTier = z.infer<typeof planTierSchema>;
