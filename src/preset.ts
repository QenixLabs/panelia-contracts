import { z } from 'zod';
import { projectFormatSchema } from './project.js';
import type { ProjectFormat } from './project.js';
import { styleProfileSchema } from './style.js';
import type { FineControls, StyleProfile } from './style.js';

export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  formats: z.array(projectFormatSchema).min(1),
  style: styleProfileSchema,
});

export type Preset = z.infer<typeof presetSchema>;

// Fine-control order: lineWeight, realism, saturation, shadingHardness,
// detail, eyeExaggeration, texture, lightingStrength.
function fine(
  lineWeight: number, realism: number, saturation: number, shadingHardness: number,
  detail: number, eyeExaggeration: number, texture: number, lightingStrength: number,
): FineControls {
  return { lineWeight, realism, saturation, shadingHardness, detail, eyeExaggeration, texture, lightingStrength };
}

function style(
  renderFamily: StyleProfile['renderFamily'],
  artDirection: StyleProfile['artDirection'],
  mood: StyleProfile['mood'],
  dials: FineControls,
): StyleProfile {
  return { renderFamily, artDirection, mood, fine: dials };
}

const MANGA: ProjectFormat[] = ['manga', '4koma'];
const MANHWA: ProjectFormat[] = ['manhwa'];

export const PRESETS: readonly Preset[] = [
  {
    id: 'classic_4koma_comedy',
    name: 'Classic 4-Koma Comedy',
    description: 'Clean ink, chibi proportions, bright setup-and-punchline strips.',
    formats: ['4koma'],
    style: style('bw_ink', 'chibi', 'bright', fine(60, 10, 0, 40, 35, 80, 20, 40)),
  },
  {
    id: 'shonen_action_manga',
    name: 'Shonen Action Manga',
    description: 'Bold ink, speed lines, high-energy fights.',
    formats: MANGA,
    style: style('bw_ink', 'shonen_action', 'cinematic', fine(70, 30, 0, 75, 70, 55, 40, 70)),
  },
  {
    id: 'shojo_romance_manga',
    name: 'Shojo Romance Manga',
    description: 'Fine lines, expressive eyes, soft screentone.',
    formats: MANGA,
    style: style('bw_ink', 'shojo_romance', 'dreamy', fine(35, 25, 0, 30, 65, 85, 35, 45)),
  },
  {
    id: 'seinen_cinematic_manga',
    name: 'Seinen Cinematic Manga',
    description: 'Grounded anatomy, film-like framing, heavy detail.',
    formats: MANGA,
    style: style('bw_ink', 'seinen_cinematic', 'gritty', fine(55, 65, 0, 70, 85, 30, 60, 75)),
  },
  {
    id: 'gekiga_noir_manga',
    name: 'Gekiga/Noir Manga',
    description: 'Hard shadows, heavy blacks, adult drama.',
    formats: MANGA,
    style: style('bw_ink', 'gekiga_noir', 'dark', fine(80, 60, 0, 90, 75, 20, 70, 85)),
  },
  {
    id: 'dark_fantasy_manga',
    name: 'Dark Fantasy Manga',
    description: 'Ornate creatures, dense hatching, ominous worlds.',
    formats: MANGA,
    style: style('bw_ink', 'dark_fantasy', 'dark', fine(65, 50, 0, 80, 85, 35, 70, 80)),
  },
  {
    id: 'horror_manga',
    name: 'Horror Manga',
    description: 'Unsettling detail, stark contrast, creeping dread.',
    formats: MANGA,
    style: style('bw_ink', 'horror', 'cold', fine(60, 55, 0, 85, 80, 30, 80, 85)),
  },
  {
    id: 'clean_webtoon',
    name: 'Clean Webtoon',
    description: 'Crisp cel colour, soft lighting, easy vertical reading.',
    formats: MANHWA,
    style: style('cel_color', 'slice_of_life', 'bright', fine(40, 35, 65, 35, 55, 60, 20, 50)),
  },
  {
    id: 'action_manhwa',
    name: 'Action Manhwa',
    description: 'Saturated colour, dynamic angles, glowing effects.',
    formats: MANHWA,
    style: style('cel_color', 'shonen_action', 'cinematic', fine(55, 45, 70, 60, 70, 50, 35, 70)),
  },
  {
    id: 'dark_fantasy_manhwa',
    name: 'Dark Fantasy Manhwa',
    description: 'Painterly gloom, dramatic rim light, muted palette.',
    formats: MANHWA,
    style: style('painterly', 'dark_fantasy', 'dark', fine(50, 60, 45, 65, 85, 40, 65, 80)),
  },
  {
    id: 'romance_webtoon',
    name: 'Romance Webtoon',
    description: 'Warm tones, gentle shading, close-up emotion.',
    formats: MANHWA,
    style: style('cel_color', 'romance', 'warm', fine(35, 40, 70, 30, 60, 70, 25, 50)),
  },
  {
    id: 'romantasy_manhwa',
    name: 'Romantasy Manhwa',
    description: 'Lush painterly colour, ornate costumes, magic glow.',
    formats: MANHWA,
    style: style('painterly', 'romantasy', 'dreamy', fine(40, 55, 75, 40, 80, 65, 50, 65)),
  },
  {
    id: 'semi_realistic_manhwa',
    name: 'Semi-Realistic/Painterly Manhwa',
    description: 'Realistic proportions, rendered lighting, cinematic depth.',
    formats: MANHWA,
    style: style('semi_realistic', 'seinen_cinematic', 'cinematic', fine(40, 85, 60, 55, 85, 25, 55, 70)),
  },
];

export const DEFAULT_PRESET_BY_FORMAT: Record<ProjectFormat, string> = {
  manga: 'shonen_action_manga',
  manhwa: 'clean_webtoon',
  '4koma': 'classic_4koma_comedy',
};

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function presetsForFormat(format: ProjectFormat): Preset[] {
  return PRESETS.filter((p) => p.formats.includes(format));
}

export const presetListSchema = z.array(presetSchema);
