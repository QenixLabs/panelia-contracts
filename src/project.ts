import { z } from 'zod';
import { entityIdSchema, isoDateTimeSchema, urlSchema } from './primitives.js';
import { styleProfileSchema } from './style.js';

export const projectFormatSchema = z.enum(['manga', 'manhwa', '4koma']);

export const ratingSchema = z.enum(['all_ages', 'teen', 'mature', 'adult_18plus']);

export const komaVariantSchema = z.enum(['classic_vertical']);

export const titleSchema = z.string().trim().min(1).max(120);
const presetIdSchema = z.string().regex(/^[a-z0-9_]+$/);

export const projectSchema = z.object({
  id: entityIdSchema,
  title: titleSchema,
  format: projectFormatSchema,
  coverUrl: urlSchema.nullable(),
  rating: ratingSchema,
  presetId: presetIdSchema.nullable(),
  basedOnPresetId: presetIdSchema.nullable(),
  style: styleProfileSchema,
  komaVariant: komaVariantSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const projectListSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

export const createProjectInputSchema = z.object({
  title: titleSchema,
  format: projectFormatSchema.default('manga'),
  presetId: presetIdSchema,
  style: styleProfileSchema.optional(),
  rating: ratingSchema.default('teen'),
});

export const updateProjectInputSchema = z
  .object({
    title: titleSchema.optional(),
    coverUrl: urlSchema.nullable().optional(),
    format: projectFormatSchema.optional(),
    presetId: presetIdSchema.nullable().optional(),
    style: styleProfileSchema.optional(),
    rating: ratingSchema.optional(),
  })
  .strict();

export type ProjectFormat = z.infer<typeof projectFormatSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type KomaVariant = z.infer<typeof komaVariantSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectList = z.infer<typeof projectListSchema>;
export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
