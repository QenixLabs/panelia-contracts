import { z } from 'zod';
import { entityIdSchema, isoDateTimeSchema, urlSchema } from './primitives.js';

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_REFS_PER_CHARACTER = 20;

export const assetContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export const assetKindSchema = z.literal('character_ref');
export const assetStatusSchema = z.enum(['pending', 'ready']);
export const rightsBasisSchema = z.enum(['own_work', 'licensed', 'commissioned', 'generated_by_me']);
export const reviewStatusSchema = z.enum(['unreviewed', 'approved', 'flagged', 'taken_down']);

const sizeBytesSchema = z.number().int().positive().max(MAX_ASSET_BYTES);

export const assetSchema = z.object({
  id: entityIdSchema,
  projectId: entityIdSchema,
  kind: assetKindSchema,
  contentType: assetContentTypeSchema,
  sizeBytes: sizeBytesSchema,
  status: assetStatusSchema,
  url: urlSchema.nullable(),
  rights: z.object({
    basis: rightsBasisSchema,
    attestedAt: isoDateTimeSchema,
    reviewStatus: reviewStatusSchema,
  }),
  createdAt: isoDateTimeSchema,
});

export const createUploadInputSchema = z.object({
  kind: assetKindSchema,
  characterId: entityIdSchema,
  contentType: assetContentTypeSchema,
  sizeBytes: sizeBytesSchema,
  rights: z.object({
    attested: z.literal(true),
    basis: rightsBasisSchema,
  }),
});

export const createUploadResultSchema = z.object({
  asset: assetSchema,
  uploadUrl: urlSchema,
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: isoDateTimeSchema,
});

export type AssetContentType = z.infer<typeof assetContentTypeSchema>;
export type RightsBasis = z.infer<typeof rightsBasisSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type CreateUploadInput = z.infer<typeof createUploadInputSchema>;
export type CreateUploadResult = z.infer<typeof createUploadResultSchema>;
