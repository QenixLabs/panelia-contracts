import { z } from 'zod';

export const renderFamilySchema = z.enum([
  'bw_ink',
  'cel_color',
  'painterly',
  'semi_realistic',
  'brush_watercolor',
]);

export const artDirectionSchema = z.enum([
  'shonen_action',
  'shojo_romance',
  'seinen_cinematic',
  'gekiga_noir',
  'dark_fantasy',
  'horror',
  'romance',
  'romantasy',
  'comedy',
  'slice_of_life',
  'chibi',
]);

export const moodSchema = z.enum([
  'bright',
  'dark',
  'warm',
  'cold',
  'dreamy',
  'gritty',
  'cinematic',
]);

const dial = z.number().int().min(0).max(100);

export const fineControlsSchema = z.object({
  lineWeight: dial,
  realism: dial,
  saturation: dial,
  shadingHardness: dial,
  detail: dial,
  eyeExaggeration: dial,
  texture: dial,
  lightingStrength: dial,
});

export const styleProfileSchema = z.object({
  renderFamily: renderFamilySchema,
  artDirection: artDirectionSchema,
  mood: moodSchema,
  fine: fineControlsSchema,
});

export type RenderFamily = z.infer<typeof renderFamilySchema>;
export type ArtDirection = z.infer<typeof artDirectionSchema>;
export type Mood = z.infer<typeof moodSchema>;
export type FineControls = z.infer<typeof fineControlsSchema>;
export type FineControlKey = keyof FineControls;
export type StyleProfile = z.infer<typeof styleProfileSchema>;
