import { z } from 'zod';
import { assetSchema } from './asset.js';
import { entityIdSchema, isoDateTimeSchema, urlSchema } from './primitives.js';

export const traitSchema = z.object({
  value: z.string().trim().max(200),
  locked: z.boolean(),
});

export const characterTraitsSchema = z.object({
  ageRange: traitSchema,
  build: traitSchema,
  hair: traitSchema,
  eyes: traitSchema,
  face: traitSchema,
  skinTone: traitSchema,
  identifyingMarks: traitSchema,
  personality: traitSchema,
});

export const TRAIT_KEYS = characterTraitsSchema.keyof().options;

const traitPatchSchema = traitSchema.partial();

export const characterTraitsPatchSchema = z
  .object({
    ageRange: traitPatchSchema,
    build: traitPatchSchema,
    hair: traitPatchSchema,
    eyes: traitPatchSchema,
    face: traitPatchSchema,
    skinTone: traitPatchSchema,
    identifyingMarks: traitPatchSchema,
    personality: traitPatchSchema,
  })
  .partial()
  .strict();

export const characterRoleSchema = z.enum(['protagonist', 'antagonist', 'supporting', 'minor']);

const characterNameSchema = z.string().trim().min(1).max(80);

export const outfitSchema = z.object({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500),
  isDefault: z.boolean(),
});

export const outfitInputSchema = outfitSchema.extend({ id: entityIdSchema.optional() });

function oneDefault<T extends { isDefault: boolean }>(list: T[]): boolean {
  return list.length === 0 || list.filter((o) => o.isDefault).length === 1;
}

const ONE_DEFAULT_MSG = 'Exactly one outfit must be the default';

export const characterSchema = z.object({
  id: entityIdSchema,
  projectId: entityIdSchema,
  name: characterNameSchema,
  role: characterRoleSchema,
  traits: characterTraitsSchema,
  outfits: z.array(outfitSchema).max(12).refine(oneDefault, ONE_DEFAULT_MSG),
  references: z.array(assetSchema).max(20),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const characterSummarySchema = z.object({
  id: entityIdSchema,
  name: characterNameSchema,
  role: characterRoleSchema,
  thumbnailUrl: urlSchema.nullable(),
  referenceCount: z.number().int().nonnegative(),
});

export const characterListSchema = z.object({
  items: z.array(characterSummarySchema),
  total: z.number().int().nonnegative(),
});

export const createCharacterInputSchema = z.object({
  name: characterNameSchema,
  role: characterRoleSchema.default('supporting'),
});

export const updateCharacterInputSchema = z
  .object({
    name: characterNameSchema,
    role: characterRoleSchema,
    traits: characterTraitsPatchSchema,
    outfits: z.array(outfitInputSchema).max(12).refine(oneDefault, ONE_DEFAULT_MSG),
  })
  .partial()
  .strict();

export type Trait = z.infer<typeof traitSchema>;
export type TraitKey = (typeof TRAIT_KEYS)[number];
export type CharacterTraits = z.infer<typeof characterTraitsSchema>;
export type CharacterTraitsPatch = z.infer<typeof characterTraitsPatchSchema>;
export type CharacterRole = z.infer<typeof characterRoleSchema>;
export type Outfit = z.infer<typeof outfitSchema>;
export type OutfitInput = z.infer<typeof outfitInputSchema>;
export type Character = z.infer<typeof characterSchema>;
export type CharacterSummary = z.infer<typeof characterSummarySchema>;
export type CharacterList = z.infer<typeof characterListSchema>;
export type CreateCharacterInput = z.input<typeof createCharacterInputSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterInputSchema>;
