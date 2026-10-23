import { z } from 'zod';
import { parseErrorCodeSchema, parseStateSchema } from './chapter.js';
import { objectIdSchema, uuidSchema } from './primitives.js';

// Events carry ids only; the client refetches over REST. Phase 4 adds render kinds to the union.
export const scriptParseEventSchema = z.object({
  kind: z.literal('script_parse'),
  jobId: uuidSchema,
  projectId: objectIdSchema, // lets the client build query keys without a lookup
  chapterId: objectIdSchema,
  state: parseStateSchema,
  code: parseErrorCodeSchema.optional(), // when state is 'failed'
  revision: z.number().int().positive().optional(), // when state is 'done'
});

export const jobEventSchema = z.discriminatedUnion('kind', [scriptParseEventSchema]);

export type ScriptParseEvent = z.infer<typeof scriptParseEventSchema>;
export type JobEvent = z.infer<typeof jobEventSchema>;
