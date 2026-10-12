import { z } from 'zod';
import { entityIdSchema, isoDateTimeSchema, urlSchema } from './primitives.js';

export const projectFormatSchema = z.enum(['manga', 'manhwa', '4koma']);

export const projectSchema = z.object({
  id: entityIdSchema,
  title: z.string().min(1).max(120),
  format: projectFormatSchema,
  coverUrl: urlSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const projectListSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

export const createProjectInputSchema = z.object({
  title: z.string().min(1).max(120),
  format: projectFormatSchema.default('manga'),
});

export const updateProjectInputSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    coverUrl: urlSchema.nullable().optional(),
  })
  .strict();

export type ProjectFormat = z.infer<typeof projectFormatSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectList = z.infer<typeof projectListSchema>;
export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
