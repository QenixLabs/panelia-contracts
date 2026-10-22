import { z } from 'zod';
import { entityIdSchema, objectIdSchema, uuidSchema } from './primitives.js';
import type { ProjectFormat } from './project.js';

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

// ---------- cross-field rules (panelPlanSchemaFor) ----------

type PlanIssue = { path: (string | number)[]; message: string };
type PlanRule = (plan: PanelPlanInput, format: ProjectFormat) => PlanIssue[];

const totalPanels: PlanRule = (plan) =>
  countPanels(plan) > PLAN_LIMITS.panels
    ? [{ path: ['scenes'], message: `Plans hold up to ${PLAN_LIMITS.panels} panels` }]
    : [];

// Scene, panel and line ids share one namespace: each id appears once in the whole plan.
const uniqueIds: PlanRule = (plan) => {
  const seen = new Set<string>();
  const issues: PlanIssue[] = [];
  const visit = (id: string, path: (string | number)[]) => {
    if (seen.has(id)) {
      issues.push({ path: [...path, 'id'], message: 'Scene, panel and line ids must be unique' });
    }
    seen.add(id);
  };
  plan.scenes.forEach((scene, si) => {
    visit(scene.id, ['scenes', si]);
    scene.panels.forEach((panel, pi) => {
      visit(panel.id, ['scenes', si, 'panels', pi]);
      panel.dialogue.forEach((line, li) => visit(line.id, ['scenes', si, 'panels', pi, 'dialogue', li]));
    });
  });
  return issues;
};

// Each cast member appears once per scene (by refKey); only roster characters carry an outfit.
const sceneCastEntries: PlanRule = (plan) => {
  const issues: PlanIssue[] = [];
  plan.scenes.forEach((scene, si) => {
    const keys = new Set<string>();
    scene.cast.forEach((entry, ci) => {
      const key = refKey(entry.ref);
      if (keys.has(key)) {
        issues.push({
          path: ['scenes', si, 'cast', ci, 'ref'],
          message: 'A scene lists each cast member once',
        });
      }
      keys.add(key);
      if (!('characterId' in entry.ref) && entry.outfitId !== null) {
        issues.push({
          path: ['scenes', si, 'cast', ci, 'outfitId'],
          message: 'Only roster characters have outfits',
        });
      }
    });
  });
  return issues;
};

// Closure: every panel cast ref and speaker is in its scene's cast (by refKey). Captions and
// sound effects never have a speaker; speech and thought may have none (an unknown voice).
const panelRefs: PlanRule = (plan) => {
  const issues: PlanIssue[] = [];
  plan.scenes.forEach((scene, si) => {
    const sceneKeys = new Set(scene.cast.map((entry) => refKey(entry.ref)));
    scene.panels.forEach((panel, pi) => {
      const at = ['scenes', si, 'panels', pi];
      panel.cast.forEach((ref, ri) => {
        if (!sceneKeys.has(refKey(ref))) {
          issues.push({ path: [...at, 'cast', ri], message: 'Panel cast must be in the scene cast' });
        }
      });
      panel.dialogue.forEach((line, li) => {
        const path = [...at, 'dialogue', li, 'speaker'];
        if (line.kind === 'caption' || line.kind === 'sfx') {
          if (line.speaker !== null) {
            issues.push({ path, message: 'Captions and sound effects have no speaker' });
          }
        } else if (line.speaker !== null && !sceneKeys.has(refKey(line.speaker))) {
          issues.push({ path, message: 'Speakers must be in the scene cast' });
        }
      });
    });
  });
  return issues;
};

// 4-koma: every scene is a strip of exactly 4 panels with 4 beat labels. Other formats: no labels.
const stripShape: PlanRule = (plan, format) => {
  const issues: PlanIssue[] = [];
  plan.scenes.forEach((scene, si) => {
    if (format !== '4koma') {
      if (scene.beatLabels !== null) {
        issues.push({
          path: ['scenes', si, 'beatLabels'],
          message: 'Only 4-koma strips have beat labels',
        });
      }
      return;
    }
    if (scene.panels.length !== 4) {
      issues.push({ path: ['scenes', si, 'panels'], message: 'A 4-koma strip has exactly 4 panels' });
    }
    if (scene.beatLabels === null) {
      issues.push({ path: ['scenes', si, 'beatLabels'], message: 'A 4-koma strip needs 4 beat labels' });
    }
  });
  return issues;
};

const PLAN_RULES: PlanRule[] = [totalPanels, uniqueIds, sceneCastEntries, panelRefs, stripShape];

/**
 * panelPlanInputSchema plus the cross-field rules for one project format. The server applies it
 * on every plan write; the web reducer's fuzz test parses with it after every op. zod skips these
 * rules while the plan has a type-level error (wrong type, unknown enum value, malformed cast
 * ref); length caps and id formats don't stop them, so every rule tolerates oversized arrays.
 * `.check()` (zod 4's successor to `.superRefine()`) refines a clone: panelPlanInputSchema stays
 * unrefined, so `.extend()` and `.pick()` keep working on it.
 */
export function panelPlanSchemaFor(format: ProjectFormat) {
  return panelPlanInputSchema.check((ctx) => {
    for (const rule of PLAN_RULES) {
      for (const { path, message } of rule(ctx.value, format)) {
        ctx.issues.push({ code: 'custom', input: ctx.value, path, message });
      }
    }
  });
}
