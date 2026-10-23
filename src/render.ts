import { z } from 'zod';
import { layoutSchema } from './layout.js';
import { PLAN_LIMITS, planTierSchema } from './plan-basics.js';
import { isoDateTimeSchema, objectIdSchema, urlSchema, uuidSchema } from './primitives.js';

// Imports only primitives.ts, plan-basics.ts and layout.ts. chapter.ts imports this file, so an
// import of chapter.ts here would close a cycle and leave schemas undefined while modules load.

export const renderRunStateSchema = z.enum([
  'queued',
  'rendering',
  'stopping',
  'done',
  'partial',
  'stopped',
  'stalled',
]);

/** Runs that still change on their own; the web polls while a run is in one of these. */
export const ACTIVE_RUN_STATES = ['queued', 'rendering', 'stopping'] as const satisfies readonly RenderRunState[];

/** true for queued, rendering and stopping; false for finished or stalled runs and for no run. */
export function isRunActive(state: RenderRunState | null | undefined): boolean {
  return state !== null && state !== undefined && (ACTIVE_RUN_STATES as readonly string[]).includes(state);
}

export const renderAttemptStatusSchema = z.enum(['queued', 'rendering', 'rendered', 'failed', 'canceled']);

// CHAPTER_GONE exists server-side only and is never returned.
export const renderErrorCodeSchema = z.enum([
  'PROVIDER_ERROR',
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'CONTENT_BLOCKED',
  'NSFW_FLAGGED',
  'REFS_UNAVAILABLE',
  'CANCELED',
]);

// After 2 safety blocks a panel can't be retried until 4.3's panel editing.
export const MAX_BLOCKED_ATTEMPTS = 2;

export const renderCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  rendered: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(), // failed + blocked
  notRendered: z.number().int().nonnegative(), // canceled by Stop
  active: z.number().int().nonnegative(), // queued + rendering
});

export const renderRunSchema = z.object({
  runId: uuidSchema,
  state: renderRunStateSchema,
  tier: planTierSchema,
  counts: renderCountsSchema,
  credits: z.object({ charged: z.number().int(), reserved: z.number().int(), released: z.number().int() }),
  providerHealthy: z.boolean(), // false while a worker breaker is open
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
});

export const renderImageSchema = z.object({
  thumbUrl: urlSchema, // signed for 1h
  previewUrl: urlSchema,
  fullUrl: urlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  expiresAt: isoDateTimeSchema,
});

// The latest attempt of one panel.
export const panelRenderSchema = z.object({
  panelId: uuidSchema,
  attemptId: objectIdSchema,
  seq: z.number().int().positive(),
  status: renderAttemptStatusSchema,
  credits: z.number().int().positive(),
  errorCode: renderErrorCodeSchema.nullable(),
  blockedAttempts: z.number().int().nonnegative(), // CONTENT_BLOCKED + NSFW_FLAGGED attempts so far
  image: renderImageSchema.nullable(),
  queuedAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});

export const chapterRenderSchema = z.object({
  run: renderRunSchema.nullable(),
  layout: layoutSchema.nullable(),
  panels: z.array(panelRenderSchema), // plan order
});

export const retryRenderInputSchema = z
  .object({
    idempotencyKey: uuidSchema,
    panelIds: z.array(uuidSchema).min(1).max(PLAN_LIMITS.panels),
  })
  .strict();

export const moderationReasonSchema = z.enum([
  'sexual',
  'sexual_minors',
  'graphic_violence',
  'self_harm',
  'hate',
  'violent_wrongdoing',
]);

export type RenderRunState = z.infer<typeof renderRunStateSchema>;
export type RenderAttemptStatus = z.infer<typeof renderAttemptStatusSchema>;
export type RenderErrorCode = z.infer<typeof renderErrorCodeSchema>;
export type RenderCounts = z.infer<typeof renderCountsSchema>;
export type RenderRun = z.infer<typeof renderRunSchema>;
export type RenderImage = z.infer<typeof renderImageSchema>;
export type PanelRender = z.infer<typeof panelRenderSchema>;
export type ChapterRender = z.infer<typeof chapterRenderSchema>;
export type RetryRenderInput = z.infer<typeof retryRenderInputSchema>;
export type ModerationReason = z.infer<typeof moderationReasonSchema>;
