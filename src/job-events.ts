import { z } from 'zod';
import { parseErrorCodeSchema, parseStateSchema } from './chapter.js';
import { objectIdSchema, uuidSchema } from './primitives.js';
import {
  renderAttemptStatusSchema,
  renderCountsSchema,
  renderErrorCodeSchema,
  renderRunStateSchema,
} from './render.js';

// Events carry ids and states only; the client refetches over REST.
export const scriptParseEventSchema = z.object({
  kind: z.literal('script_parse'),
  jobId: uuidSchema,
  projectId: objectIdSchema, // lets the client build query keys without a lookup
  chapterId: objectIdSchema,
  state: parseStateSchema,
  code: parseErrorCodeSchema.optional(), // when state is 'failed'
  revision: z.number().int().positive().optional(), // when state is 'done'
});

// On claim, settle and cancel of one attempt.
export const panelRenderEventSchema = z.object({
  kind: z.literal('panel_render'),
  projectId: objectIdSchema,
  chapterId: objectIdSchema,
  runId: uuidSchema,
  panelId: uuidSchema,
  attemptId: objectIdSchema,
  status: renderAttemptStatusSchema,
  errorCode: renderErrorCodeSchema.optional(), // when failed or canceled
});

// On start, stop, finalize and provider-health changes of an active run.
export const chapterRenderEventSchema = z.object({
  kind: z.literal('chapter_render'),
  projectId: objectIdSchema,
  chapterId: objectIdSchema,
  runId: uuidSchema,
  state: renderRunStateSchema,
  counts: renderCountsSchema,
  providerHealthy: z.boolean(),
});

export const jobEventSchema = z.discriminatedUnion('kind', [
  scriptParseEventSchema,
  panelRenderEventSchema,
  chapterRenderEventSchema,
]);

export type ScriptParseEvent = z.infer<typeof scriptParseEventSchema>;
export type PanelRenderEvent = z.infer<typeof panelRenderEventSchema>;
export type ChapterRenderEvent = z.infer<typeof chapterRenderEventSchema>;
export type JobEvent = z.infer<typeof jobEventSchema>;
