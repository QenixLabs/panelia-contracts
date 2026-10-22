import { z } from 'zod';
import { entityIdSchema, objectIdSchema, uuidSchema } from './primitives.js';

export const PLAN_LIMITS = {
  scenes: 30,
  panels: 60,
  panelsPerScene: 40,
  dialogueLines: 8,
  panelCast: 8,
  sceneCast: 12,
} as const;

export const DEFAULT_BEAT_LABELS = ['Setup', 'Development', 'Turn', 'Punchline'] as const;

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

export const dialogueKindSchema = z.enum(['speech', 'thought', 'caption', 'sfx']);

export const planTierSchema = z.enum(['draft', 'hq']);

// A cast reference is either a roster character or a name.
// extra: false = unresolved name (blocks approve). extra: true = unnamed background person.
export const castRefSchema = z.union([
  z.object({ characterId: objectIdSchema }).strict(),
  z.object({ name: z.string().trim().min(1).max(80), extra: z.boolean() }).strict(),
]);

export const dialogueLineSchema = z.object({
  id: uuidSchema,
  kind: dialogueKindSchema,
  speaker: castRefSchema.nullable(), // always null for caption and sfx
  text: z.string().trim().max(300),
});

export const panelSchema = z.object({
  id: uuidSchema,
  shot: shotTypeSchema,
  subject: z.string().trim().max(200),
  cast: z.array(castRefSchema).max(PLAN_LIMITS.panelCast),
  action: z.string().trim().max(1000),
  mood: z.string().trim().max(80),
  dialogue: z.array(dialogueLineSchema).max(PLAN_LIMITS.dialogueLines),
});

export const sceneCastSchema = z.object({
  ref: castRefSchema,
  // Character refs only. null = carry forward (the default outfit on first appearance).
  outfitId: entityIdSchema.nullable(),
  notes: z.string().trim().max(200), // equipment, injuries, props (CO-01); '' = carry forward
});

const beatLabel = z.string().trim().max(40);

export const sceneSchema = z.object({
  id: uuidSchema,
  heading: z.string().trim().max(120),
  location: z.string().trim().max(120),
  cast: z.array(sceneCastSchema).max(PLAN_LIMITS.sceneCast),
  beatLabels: z.tuple([beatLabel, beatLabel, beatLabel, beatLabel]).nullable(), // 4-koma strips only
  panels: z.array(panelSchema).min(1).max(PLAN_LIMITS.panelsPerScene),
});

// No cross-field rules here: they depend on the project format (panelPlanSchemaFor below).
// Keeping this schema unrefined is what lets .extend() and .pick() work on it in zod 4.
export const panelPlanInputSchema = z.object({
  tier: planTierSchema,
  scenes: z.array(sceneSchema).min(1).max(PLAN_LIMITS.scenes),
});

export const panelPlanSchema = panelPlanInputSchema.extend({
  revision: z.number().int().positive(),
});

/** 'c:<characterId>' for roster characters, 'n:<case-folded name>' for names (extra or not). */
export function refKey(ref: CastRef): string {
  return 'characterId' in ref ? `c:${ref.characterId}` : `n:${ref.name.trim().toLowerCase()}`;
}

export function countPanels(plan: { scenes: readonly { panels: readonly unknown[] }[] }): number {
  return plan.scenes.reduce((n, scene) => n + scene.panels.length, 0);
}

export type ShotType = z.infer<typeof shotTypeSchema>;
export type DialogueKind = z.infer<typeof dialogueKindSchema>;
export type PlanTier = z.infer<typeof planTierSchema>;
export type CastRef = z.infer<typeof castRefSchema>;
export type DialogueLine = z.infer<typeof dialogueLineSchema>;
export type Panel = z.infer<typeof panelSchema>;
export type SceneCast = z.infer<typeof sceneCastSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type PanelPlanInput = z.infer<typeof panelPlanInputSchema>;
export type PanelPlan = z.infer<typeof panelPlanSchema>;
