import { z } from 'zod';
import type { PanelPlanInput } from './chapter.js';
import type { ShotType } from './plan-basics.js';
import { uuidSchema } from './primitives.js';
import type { KomaVariant, ProjectFormat } from './project.js';

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

// ---------- autoLayout (shot_weighted_v1) ----------

type WidthClass = 'full' | 'half' | 'third';

// Manga: how much of a 6-unit tier each shot asks for.
const MANGA_CLASS: Record<ShotType, WidthClass> = {
  establishing: 'full',
  wide: 'full',
  medium: 'half',
  over_shoulder: 'half',
  pov: 'half',
  close_up: 'half',
  extreme_close_up: 'third',
  insert: 'third',
};
const CLASS_UNITS: Record<WidthClass, number> = { full: 6, half: 3, third: 2 };
const TIER_UNITS = 6; // thirds are the narrowest class, so a tier never holds more than 3 panels
const PAGE_TIERS = 3;
const PAGE_PANELS = 6;
const TIER_WEIGHT = { full: 1.2, thirds: 0.85, other: 1 } as const;
const LAST_PAGE_STRETCH = 2;

// Manhwa: panel height at width 800.
const MANHWA_HEIGHT: Record<ShotType, number> = {
  establishing: 640,
  wide: 600,
  medium: 1000,
  over_shoulder: 1000,
  pov: 900,
  close_up: 800,
  extreme_close_up: 400,
  insert: 500,
};

const STRIP_PANELS = 4;

type PlanPanel = { id: string; shot: ShotType };
type PanelRect = { panelId: string; x: number; y: number; w: number; h: number };
type Tier = { sceneId: string; panels: PlanPanel[]; units: number };

// The package compiles without DOM or Node typings; Node >= 19 and browsers both have it.
const randomUuid = (): string =>
  (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();

/**
 * Integer parts of `total` in proportion to `weights`. Largest remainder: the parts sum to
 * `total` exactly, and ties go to the earlier part.
 */
function splitInt(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map((e) => Math.floor(e));
  let left = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((e, i) => ({ i, rest: e - Math.floor(e) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

// Mints the page id first, then one slot id per rect in reading order.
function buildPage(
  newId: () => string,
  index: number,
  kind: LayoutPageKind,
  size: { width: number; height: number },
  sceneIds: readonly string[],
  rects: readonly PanelRect[],
): LayoutPage {
  const id = newId();
  return {
    id,
    index,
    kind,
    width: size.width,
    height: size.height,
    sceneIds: [...new Set(sceneIds)],
    slots: rects.map((r, i) => ({
      id: newId(),
      panelId: r.panelId,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      crop: null,
      z: i,
    })),
  };
}

function mangaTiers(plan: PanelPlanInput): Tier[] {
  const tiers: Tier[] = [];
  for (const scene of plan.scenes) {
    let tier: Tier | null = null;
    for (const panel of scene.panels) {
      const units = CLASS_UNITS[MANGA_CLASS[panel.shot]];
      // The next panel doesn't fit: close the tier. A full-width panel never fits a started tier.
      if (tier !== null && tier.units + units > TIER_UNITS) {
        tiers.push(tier);
        tier = null;
      }
      tier ??= { sceneId: scene.id, panels: [], units: 0 };
      tier.panels.push(panel);
      tier.units += units;
    }
    if (tier !== null) tiers.push(tier); // a scene boundary closes the tier
  }
  return tiers;
}

function tierWeight(tier: Tier): number {
  const classes = tier.panels.map((p) => MANGA_CLASS[p.shot]);
  if (classes.includes('full')) return TIER_WEIGHT.full;
  if (classes.every((c) => c === 'third')) return TIER_WEIGHT.thirds;
  return TIER_WEIGHT.other;
}

function mangaPages(plan: PanelPlanInput, newId: () => string): LayoutPage[] {
  const { width, height, margin, tierGap, panelGap } = LAYOUT_UNITS.manga;
  const contentW = width - 2 * margin.x; // 880
  const contentH = height - margin.top - margin.bottom; // 1274
  // A tier's normal height per 1.0 of weight: a 3-tier page of 1.0 tiers.
  const normal = (contentH - (PAGE_TIERS - 1) * tierGap) / PAGE_TIERS;

  const groups: Tier[][] = [];
  let group: Tier[] = [];
  let panelCount = 0;
  for (const tier of mangaTiers(plan)) {
    if (group.length === PAGE_TIERS || panelCount + tier.panels.length > PAGE_PANELS) {
      groups.push(group);
      group = [];
      panelCount = 0;
    }
    group.push(tier);
    panelCount += tier.panels.length;
  }
  if (group.length > 0) groups.push(group);

  return groups.map((tiers, index) => {
    const weights = tiers.map(tierWeight);
    const fill = contentH - (tiers.length - 1) * tierGap;
    const isLast = index === groups.length - 1;
    const weightSum = weights.reduce((a, b) => a + b, 0);
    // Tiers fill the page. On the last page each stops at twice its normal height.
    const total = isLast ? Math.min(fill, Math.floor(LAST_PAGE_STRETCH * normal * weightSum)) : fill;
    const heights = splitInt(total, weights);

    const rects: PanelRect[] = [];
    let y = margin.top;
    tiers.forEach((tier, t) => {
      const h = heights[t];
      const n = tier.panels.length;
      const widths = splitInt(
        contentW - (n - 1) * panelGap,
        tier.panels.map((p) => CLASS_UNITS[MANGA_CLASS[p.shot]]),
      );
      let right = margin.x + contentW; // a tier reads right to left
      tier.panels.forEach((panel, i) => {
        const w = widths[i];
        rects.push({ panelId: panel.id, x: right - w, y, w, h });
        right -= w + panelGap;
      });
      y += h + tierGap;
    });
    return buildPage(newId, index, 'page', { width, height }, tiers.map((t) => t.sceneId), rects);
  });
}

function manhwaPages(plan: PanelPlanInput, newId: () => string): LayoutPage[] {
  const { width, topPad, endPad, sceneGap, panelGap } = LAYOUT_UNITS.manhwa;
  const half = sceneGap / 2; // a scene boundary splits its gap between the two sections
  const last = plan.scenes.length - 1;
  return plan.scenes.map((scene, index) => {
    let y = index === 0 ? topPad : half;
    const rects = scene.panels.map((panel) => {
      const h = MANHWA_HEIGHT[panel.shot];
      const rect = { panelId: panel.id, x: 0, y, w: width, h };
      y += h + panelGap;
      return rect;
    });
    const sectionHeight = y - panelGap + (index === last ? endPad : half);
    return buildPage(newId, index, 'section', { width, height: sectionHeight }, [scene.id], rects);
  });
}

function komaPages(plan: PanelPlanInput, newId: () => string): LayoutPage[] {
  const { width, height, stripWidth, panelHeight, panelGap, titleBand } = LAYOUT_UNITS['4koma'];
  const margin = (width - 2 * stripWidth) / 3; // 70: both outer margins and the centre gutter
  const stripHeight = titleBand + STRIP_PANELS * panelHeight + (STRIP_PANELS - 1) * panelGap; // 1272
  const top = (height - stripHeight) / 2; // 71: the title band, then the panels from y 111
  const columns = [width - margin - stripWidth, margin]; // the right strip reads first
  // One strip per scene. A scene of another size (never in a valid plan) is cut into strips of 4.
  const strips = plan.scenes.flatMap((scene) => {
    const chunks: { sceneId: string; panels: PlanPanel[] }[] = [];
    for (let i = 0; i < scene.panels.length; i += STRIP_PANELS) {
      chunks.push({ sceneId: scene.id, panels: scene.panels.slice(i, i + STRIP_PANELS) });
    }
    return chunks;
  });
  const pages: LayoutPage[] = [];
  for (let first = 0; first < strips.length; first += columns.length) {
    const onPage = strips.slice(first, first + columns.length);
    const rects = onPage.flatMap((strip, s) =>
      strip.panels.map((panel, j) => ({
        panelId: panel.id,
        x: columns[s],
        y: top + titleBand + j * (panelHeight + panelGap),
        w: stripWidth,
        h: panelHeight,
      })),
    );
    const sceneIds = onPage.map((strip) => strip.sceneId);
    pages.push(buildPage(newId, pages.length, 'strip_page', { width, height }, sceneIds, rects));
  }
  return pages;
}

/**
 * The default page layout, `shot_weighted_v1` (spec §1). Pure: the same plan and the same
 * `newId` sequence give the same layout. `plan` must pass `panelPlanSchemaFor(format)`.
 * Coordinates are integer page units with a top-left origin, and every page lists its slots in
 * reading order. Ids are minted page by page: the page id, then its slot ids in reading order.
 *
 * - **manga** (`page`, 1000×1414, content x 60..940, y 70..1344): panels pack in plan order into
 *   tiers 6 units wide (full 6, half 3, third 2). A tier closes when the next panel doesn't fit
 *   (so a full-width panel is always alone) and at every scene boundary. Widths split 880 minus
 *   16 per gap in proportion to the units, so leftover units are shared (half + third: 60/40).
 *   The first panel touches the right edge (x + w = 940); the rest follow to the left. A page
 *   holds up to 3 tiers and 6 panels. Tier heights split 1274 minus 36 per gap by weight (a
 *   full-width tier 1.2, all thirds 0.85, others 1.0) and fill the page; on the last page the
 *   tiers stop at twice their normal height (weight × 400.67), top-aligned.
 * - **manhwa** (`section`, width 800, height = its content): one section per scene with
 *   full-width panels (x 0, w 800) of the shot's height, 120 apart. The first section opens with
 *   80, the last closes with 200, and each scene boundary splits its 480 as 240 + 240, so the
 *   sections tile edge to edge into one strip.
 * - **4-koma** (`strip_page`, 1000×1414, `classic_vertical`): each scene is a strip, a column of
 *   4 panels of 395×296 with 16 gaps under a 40-unit title band (y 71..111; panels y 111..1343).
 *   Two strips per page: the first at x 535 (right), the second at x 70 (left). The outer
 *   margins and the centre gutter are 70 each. The last page may hold one strip.
 */
export function autoLayout(
  plan: PanelPlanInput,
  format: ProjectFormat,
  komaVariant: KomaVariant | null,
  opts: { newId?: () => string } = {},
): Omit<Layout, 'revision'> {
  const newId = opts.newId ?? randomUuid;
  // classic_vertical is the only 4-koma variant (null means it), so komaVariant can't change
  // the result yet. A second variant adds a branch here.
  const pages =
    format === 'manga'
      ? mangaPages(plan, newId)
      : format === 'manhwa'
        ? manhwaPages(plan, newId)
        : komaPages(plan, newId);
  return { template: LAYOUT_TEMPLATE, direction: layoutDirection(format), pages };
}
