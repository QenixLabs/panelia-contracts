import { z } from 'zod';
import { characterTraitsSchema, outfitSchema } from './character.js';
import { PLAN_LIMITS, planTierSchema, shotTypeSchema } from './plan-basics.js';
import { entityIdSchema, isoDateTimeSchema, objectIdSchema, uuidSchema } from './primitives.js';
import { titleSchema } from './project.js';
import type { ProjectFormat } from './project.js';
import { SCRIPT_LIMITS } from './script.js';
import { styleProfileSchema } from './style.js';

// Moved to plan-basics.ts, a leaf module that render.ts can import without a cycle.
// Re-exported here, so the package's exports are unchanged.
export { PLAN_LIMITS, planTierSchema, shotTypeSchema };
export type { PlanTier, ShotType } from './plan-basics.js';

export const DEFAULT_BEAT_LABELS = ['Setup', 'Development', 'Turn', 'Punchline'] as const;

export const dialogueKindSchema = z.enum(['speech', 'thought', 'caption', 'sfx']);

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

export type DialogueKind = z.infer<typeof dialogueKindSchema>;
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

// ---------- approve blockers (web action bar and server approve share these) ----------

/**
 * Distinct refKeys that block approve: names with extra: false, and character ids missing from
 * the roster. `names` lists the unresolved names in plan order (first spelling wins). A missing
 * character has no name, so `count` can exceed `names.length`.
 */
export function unresolvedRefs(
  plan: PanelPlanInput,
  rosterIds: ReadonlySet<string>,
): { count: number; names: string[] } {
  const keys = new Set<string>();
  const names: string[] = [];
  const visit = (ref: CastRef) => {
    if ('characterId' in ref ? rosterIds.has(ref.characterId) : ref.extra) return;
    const key = refKey(ref);
    if (keys.has(key)) return;
    keys.add(key);
    if ('name' in ref) names.push(ref.name.trim());
  };
  for (const scene of plan.scenes) {
    for (const entry of scene.cast) visit(entry.ref);
    for (const panel of scene.panels) {
      for (const ref of panel.cast) visit(ref);
      for (const line of panel.dialogue) if (line.speaker) visit(line.speaker);
    }
  }
  return { count: keys.size, names };
}

/** Panels with nothing to draw: subject and action are both blank after trimming. */
export function countEmptyPanels(plan: PanelPlanInput): number {
  let n = 0;
  for (const scene of plan.scenes) {
    for (const panel of scene.panels) {
      if (panel.subject.trim() === '' && panel.action.trim() === '') n++;
    }
  }
  return n;
}

// ---------- chapter document ----------

// Derived on read, never stored: no plan → draft, plan → planned, approval → approved.
export const chapterStatusSchema = z.enum(['draft', 'planned', 'approved']);

export const parseStateSchema = z.enum(['idle', 'queued', 'running', 'done', 'failed']);

export const parseErrorCodeSchema = z.enum([
  'PARSE_FAILED',
  'AI_UNAVAILABLE',
  'PLAN_TOO_LARGE',
  'PARSE_TIMEOUT',
]);

export const parseStatusSchema = z.object({
  state: parseStateSchema, // PARSE_TIMEOUT is applied when the chapter is read
  errorCode: parseErrorCodeSchema.nullable(), // non-null iff state === 'failed'
  queuedAt: isoDateTimeSchema.nullable(), // elapsed time is computed from this
  attempt: z.number().int().min(0).max(2), // 2 = "Retrying…"
  finishedAt: isoDateTimeSchema.nullable(),
});

export const approvalSchema = z.object({
  amount: z.number().int().positive(),
  tier: planTierSchema,
  panelCount: z.number().int().positive(),
  approvedAt: isoDateTimeSchema,
});

export const chapterSchema = z.object({
  id: objectIdSchema,
  projectId: objectIdSchema,
  number: z.number().int().positive(),
  title: titleSchema,
  script: z.string().max(SCRIPT_LIMITS.maxChars),
  status: chapterStatusSchema,
  parse: parseStatusSchema,
  plan: panelPlanSchema.nullable(),
  approval: approvalSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const chapterSummarySchema = chapterSchema
  .pick({ id: true, number: true, title: true, status: true, updatedAt: true })
  .extend({
    parse: parseStatusSchema.pick({ state: true, errorCode: true }),
    panelCount: z.number().int().nonnegative(),
  });

export const chapterListSchema = z.object({
  items: z.array(chapterSummarySchema),
  total: z.number().int().nonnegative(),
});

export type ChapterStatus = z.infer<typeof chapterStatusSchema>;
export type ParseState = z.infer<typeof parseStateSchema>;
export type ParseErrorCode = z.infer<typeof parseErrorCodeSchema>;
export type ParseStatus = z.infer<typeof parseStatusSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type ChapterSummary = z.infer<typeof chapterSummarySchema>;
export type ChapterList = z.infer<typeof chapterListSchema>;

// ---------- requests and responses ----------

// The server defaults the title to "Chapter {n}".
export const createChapterInputSchema = z.object({ title: titleSchema.optional() }).strict();

export const updateChapterInputSchema = z
  .object({ title: titleSchema, script: z.string().max(SCRIPT_LIMITS.maxChars) })
  .partial()
  .strict();

export const savePlanInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative(), // 0 = the chapter has no plan yet
    saveId: uuidSchema,
    plan: panelPlanInputSchema, // the server also applies panelPlanSchemaFor(format)
  })
  .strict();

export const savePlanResultSchema = z.object({ revision: z.number().int().positive() });

export const startParseInputSchema = z.object({ replace: z.boolean().default(false) }).strict();

export const startParseResultSchema = z.object({ jobId: uuidSchema });

export const approvePlanInputSchema = z
  .object({
    idempotencyKey: uuidSchema,
    tier: planTierSchema,
    revision: z.number().int().positive(),
  })
  .strict();

// ---------- continuity context v1 (CO-01/02) ----------

export const panelContextSchema = z.object({
  panelId: uuidSchema,
  sceneId: uuidSchema,
  location: z.string(),
  characters: z.array(
    z.object({
      characterId: objectIdSchema,
      name: z.string(),
      // Locked, non-empty traits only.
      lockedTraits: z.partialRecord(characterTraitsSchema.keyof(), z.string()),
      outfit: outfitSchema.pick({ id: true, name: true, description: true }).nullable(),
      notes: z.string(),
    }),
  ),
});

export const chapterContextSchema = z.object({
  chapterId: objectIdSchema,
  revision: z.number().int().nonnegative(), // 0 when the chapter has no plan
  style: styleProfileSchema,
  panels: z.array(panelContextSchema),
});

export type CreateChapterInput = z.infer<typeof createChapterInputSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterInputSchema>;
export type SavePlanInput = z.infer<typeof savePlanInputSchema>;
export type SavePlanResult = z.infer<typeof savePlanResultSchema>;
export type StartParseInput = z.input<typeof startParseInputSchema>; // `replace` is optional for callers
export type StartParseResult = z.infer<typeof startParseResultSchema>;
export type ApprovePlanInput = z.infer<typeof approvePlanInputSchema>;
export type PanelContext = z.infer<typeof panelContextSchema>;
export type ChapterContext = z.infer<typeof chapterContextSchema>;
