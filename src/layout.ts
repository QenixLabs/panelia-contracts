import { z } from 'zod';
import { uuidSchema } from './primitives.js';
import type { ProjectFormat } from './project.js';

// Imports from chapter.ts and project.ts stay `import type`: chapter.ts imports render.ts,
// which imports this file, so a runtime import would close a cycle.

export const LAYOUT_TEMPLATE = 'shot_weighted_v1' as const;

export const slotSchema = z.object({
  id: uuidSchema,
  panelId: uuidSchema,
  x: z.number(), // page units, top-left origin
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  // null = cover, centred (4.2 edits it)
  crop: z.object({ scale: z.number().min(1), x: z.number(), y: z.number() }).nullable(),
  z: z.number().int(),
});

export const layoutPageKindSchema = z.enum(['page', 'section', 'strip_page']); // manga · manhwa · 4-koma

export const layoutPageSchema = z.object({
  id: uuidSchema,
  index: z.number().int().nonnegative(), // reading order
  kind: layoutPageKindSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  sceneIds: z.array(uuidSchema).min(1),
  slots: z.array(slotSchema).min(1), // in reading order
});

export const layoutSchema = z.object({
  revision: z.number().int().positive(), // 1 when created; 4.2 saves bump it
  template: z.literal(LAYOUT_TEMPLATE),
  direction: z.enum(['rtl', 'ltr']), // manga and 4-koma rtl, manhwa ltr
  pages: z.array(layoutPageSchema).min(1),
});

export const LAYOUT_UNITS = {
  manga: { width: 1000, height: 1414, margin: { x: 60, top: 70, bottom: 70 }, tierGap: 36, panelGap: 16 },
  '4koma': { width: 1000, height: 1414, stripWidth: 395, panelHeight: 296, panelGap: 16, titleBand: 40 },
  manhwa: { width: 800, topPad: 80, endPad: 200, sceneGap: 480, panelGap: 120 },
} as const;

export type Slot = z.infer<typeof slotSchema>;
export type LayoutPageKind = z.infer<typeof layoutPageKindSchema>;
export type LayoutPage = z.infer<typeof layoutPageSchema>;
export type Layout = z.infer<typeof layoutSchema>;
export type LayoutDirection = Layout['direction'];

/** Manga and 4-koma read right to left; manhwa reads left to right (and top to bottom). */
export function layoutDirection(format: ProjectFormat): LayoutDirection {
  return format === 'manhwa' ? 'ltr' : 'rtl';
}
