import { z } from 'zod';

export const jobStateSchema = z.enum(['queued', 'rendering', 'done', 'failed']);

export const jobStatusEventSchema = z.object({
  state: jobStateSchema,
  panelId: z.string().optional(),
  error: z.string().optional(),
});

export type JobState = z.infer<typeof jobStateSchema>;
export type JobStatusEvent = z.infer<typeof jobStatusEventSchema>;
