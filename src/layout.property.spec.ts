import { describe, expect, it } from 'vitest';
import { DEFAULT_BEAT_LABELS, countPanels, panelPlanSchemaFor } from './chapter.js';
import type { PanelPlanInput, Scene } from './chapter.js';
import { autoLayout, layoutSchema } from './layout.js';
import type { Layout, LayoutPage, Slot } from './layout.js';
import { PLAN_LIMITS, shotTypeSchema } from './plan-basics.js';
import type { ShotType } from './plan-basics.js';
import type { ProjectFormat } from './project.js';

// ---------- seeded random plans ----------

const RUNS = 200;

// mulberry32: a tiny seeded PRNG, so every run checks the same 200 plans per format.
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const between = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(rand: Rand, items: readonly T[]): T => items[Math.floor(rand() * items.length)];

// Each plan draws its shots from one palette, so runs of thirds or of full-width shots are common
// enough to hit every tier and page rule.
const PALETTES: readonly (readonly ShotType[])[] = [
  shotTypeSchema.options,
  ['insert', 'extreme_close_up'],
  ['establishing', 'wide', 'insert'],
  ['medium', 'close_up', 'pov', 'over_shoulder'],
  ['medium', 'extreme_close_up'],
];

let nextId = 1;
const uid = () => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

// A random plan that passes panelPlanSchemaFor(format): up to 60 panels in up to 30 scenes of up
// to 12 panels (manga, manhwa), or 1 to 15 strips of exactly 4 panels (4-koma).
function randomPlan(rand: Rand, format: ProjectFormat): PanelPlanInput {
  const palette = pick(rand, PALETTES);
  const scene = (panelCount: number): Scene => ({
    id: uid(),
    heading: 'The Rooftop',
    location: 'School rooftop, dusk',
    cast: [],
    beatLabels: format === '4koma' ? [...DEFAULT_BEAT_LABELS] : null,
    panels: Array.from({ length: panelCount }, () => ({
      id: uid(),
      shot: pick(rand, palette),
      subject: 'Aoi at the railing',
      cast: [],
      action: 'Aoi looks out over the city.',
      mood: 'tense',
      dialogue: [],
    })),
  });
  const scenes: Scene[] = [];
  if (format === '4koma') {
    const strips = between(rand, 1, PLAN_LIMITS.panels / 4);
    for (let i = 0; i < strips; i++) scenes.push(scene(4));
  } else {
    let left = between(rand, 1, PLAN_LIMITS.panels);
    while (left > 0) {
      // The 30th scene takes the rest (at most 60 - 29 = 31 panels).
      const size = scenes.length === PLAN_LIMITS.scenes - 1 ? left : between(rand, 1, Math.min(left, 12));
      scenes.push(scene(size));
      left -= size;
    }
  }
  return panelPlanSchemaFor(format).parse({ tier: 'draft', scenes });
}

// ---------- invariants ----------

type Box = { left: number; top: number; right: number; bottom: number };

const KIND: Record<ProjectFormat, LayoutPage['kind']> = { manga: 'page', manhwa: 'section', '4koma': 'strip_page' };
const DIRECTION: Record<ProjectFormat, Layout['direction']> = { manga: 'rtl', manhwa: 'ltr', '4koma': 'rtl' };

// Where slots may sit on a page (spec §1 and the autoLayout doc comment).
function contentBox(format: ProjectFormat, page: LayoutPage, last: boolean): Box {
  if (format === 'manga') return { left: 60, top: 70, right: 940, bottom: 1344 };
  if (format === '4koma') return { left: 70, top: 71 + 40, right: 930, bottom: 1343 }; // below the title band
  return {
    left: 0,
    right: 800,
    top: page.index === 0 ? 80 : 240,
    bottom: page.height - (last ? 200 : 240),
  };
}

// The smallest gap allowed between side-by-side and between stacked slots on one page.
const MIN_GAP: Record<ProjectFormat, { across: number; down: number }> = {
  manga: { across: 16, down: 36 },
  manhwa: { across: 16, down: 120 },
  '4koma': { across: 16, down: 16 },
};

const bottomOf = (s: Slot) => s.y + s.h;
const rightOf = (s: Slot) => s.x + s.w;

/** Every rule that holds for any valid plan, as a list of human-readable violations. */
function violations(plan: PanelPlanInput, format: ProjectFormat, layout: Omit<Layout, 'revision'>): string[] {
  const problems: string[] = [];
  const fail = (message: string) => problems.push(message);

  const parsed = layoutSchema.safeParse({ revision: 1, ...layout });
  if (!parsed.success) fail(`not a valid layout: ${parsed.error.message}`);
  if (layout.direction !== DIRECTION[format]) fail(`direction ${layout.direction}`);

  // Every panel exactly once, in plan order.
  const planOrder = plan.scenes.flatMap((scene) => scene.panels.map((panel) => panel.id));
  const readingOrder = layout.pages.flatMap((page) => page.slots.map((slot) => slot.panelId));
  if (JSON.stringify(readingOrder) !== JSON.stringify(planOrder)) fail('reading order differs from plan order');
  const ids = layout.pages.flatMap((page) => [page.id, ...page.slots.map((slot) => slot.id)]);
  if (new Set(ids).size !== ids.length) fail('page and slot ids repeat');

  const sceneOf = new Map(plan.scenes.flatMap((scene) => scene.panels.map((panel) => [panel.id, scene.id])));

  layout.pages.forEach((page, p) => {
    const at = `page ${p}`;
    const last = p === layout.pages.length - 1;
    if (page.index !== p) fail(`${at}: index ${page.index}`);
    if (page.kind !== KIND[format]) fail(`${at}: kind ${page.kind}`);
    const scenesOnPage = [...new Set(page.slots.map((slot) => sceneOf.get(slot.panelId)))];
    if (JSON.stringify(page.sceneIds) !== JSON.stringify(scenesOnPage)) fail(`${at}: sceneIds`);

    const box = contentBox(format, page, last);
    page.slots.forEach((s, i) => {
      if (s.x < box.left || s.y < box.top || rightOf(s) > box.right || bottomOf(s) > box.bottom) {
        fail(`${at} slot ${i}: outside the content area`);
      }
      if (s.crop !== null) fail(`${at} slot ${i}: crop is not the default`);
    });

    // No overlaps, and never closer than the minimum gaps.
    const min = MIN_GAP[format];
    page.slots.forEach((a, i) => {
      page.slots.slice(i + 1).forEach((b, k) => {
        const across = Math.max(b.x - rightOf(a), a.x - rightOf(b));
        const down = Math.max(b.y - bottomOf(a), a.y - bottomOf(b));
        const pair = `${at} slots ${i}/${i + 1 + k}`;
        if (across < 0 && down < 0) fail(`${pair}: overlap`);
        if (down < 0 && across < min.across) fail(`${pair}: ${across} apart side by side`);
        if (across < 0 && down < min.down) fail(`${pair}: ${down} apart stacked`);
      });
    });
  });
  return problems;
}

// Tiers of a manga page: slots grouped by y, in reading order.
function tiersOf(page: LayoutPage): Slot[][] {
  const byY = new Map<number, Slot[]>();
  for (const slot of page.slots) byY.set(slot.y, [...(byY.get(slot.y) ?? []), slot]);
  return [...byY.values()];
}

function mangaViolations(plan: PanelPlanInput, layout: Omit<Layout, 'revision'>): string[] {
  const problems: string[] = [];
  const shotOf = new Map(plan.scenes.flatMap((scene) => scene.panels.map((panel) => [panel.id, panel.shot])));
  const sceneOf = new Map(plan.scenes.flatMap((scene) => scene.panels.map((panel) => [panel.id, scene.id])));
  layout.pages.forEach((page, p) => {
    const at = `page ${p}`;
    const tiers = tiersOf(page);
    if (page.width !== 1000 || page.height !== 1414) problems.push(`${at}: size ${page.width}x${page.height}`);
    if (page.slots.length > 6) problems.push(`${at}: ${page.slots.length} panels`);
    if (tiers.length > 3) problems.push(`${at}: ${tiers.length} tiers`);
    if (p < layout.pages.length - 1 && bottomOf(page.slots.at(-1)!) !== 1344) problems.push(`${at}: does not fill`);
    tiers.forEach((tier, t) => {
      const where = `${at} tier ${t}`;
      // A tier spans the content width, reads right to left, keeps one height and one scene.
      if (rightOf(tier[0]) !== 940 || tier.at(-1)!.x !== 60) problems.push(`${where}: not 60..940`);
      tier.slice(1).forEach((slot, i) => {
        if (rightOf(slot) >= tier[i].x) problems.push(`${where}: not right to left`);
      });
      if (new Set(tier.map((slot) => slot.h)).size !== 1) problems.push(`${where}: uneven height`);
      if (new Set(tier.map((slot) => sceneOf.get(slot.panelId))).size !== 1) problems.push(`${where}: two scenes`);
      // Full-width shots never share a tier.
      const full = tier.some((slot) => ['establishing', 'wide'].includes(shotOf.get(slot.panelId)!));
      if (full && tier.length !== 1) problems.push(`${where}: a full-width shot shares its tier`);
    });
  });
  return problems;
}

function manhwaViolations(plan: PanelPlanInput, layout: Omit<Layout, 'revision'>): string[] {
  const problems: string[] = [];
  if (layout.pages.length !== plan.scenes.length) problems.push('not one section per scene');
  layout.pages.forEach((page, p) => {
    const at = `section ${p}`;
    if (JSON.stringify(page.sceneIds) !== JSON.stringify([plan.scenes[p]?.id])) problems.push(`${at}: scene`);
    if (page.width !== 800) problems.push(`${at}: width ${page.width}`);
    if (page.slots.some((slot) => slot.x !== 0 || slot.w !== 800)) problems.push(`${at}: not full width`);
    const next = layout.pages[p + 1];
    if (next) {
      const gap = page.height - bottomOf(page.slots.at(-1)!) + next.slots[0].y;
      if (gap < 480) problems.push(`${at}: ${gap} before the next scene`);
    }
  });
  if (layout.pages[0].slots[0].y < 80) problems.push('less than 80 on top');
  const end = layout.pages.at(-1)!;
  if (end.height - bottomOf(end.slots.at(-1)!) < 200) problems.push('less than 200 at the end');
  return problems;
}

function komaViolations(plan: PanelPlanInput, layout: Omit<Layout, 'revision'>): string[] {
  const problems: string[] = [];
  const sceneOf = new Map(plan.scenes.flatMap((scene) => scene.panels.map((panel) => [panel.id, scene.id])));
  layout.pages.forEach((page, p) => {
    const at = `page ${p}`;
    if (page.width !== 1000 || page.height !== 1414) problems.push(`${at}: size ${page.width}x${page.height}`);
    if (page.slots.some((slot) => slot.w !== 395 || slot.h !== 296)) problems.push(`${at}: panel size`);
    // Two strips of 4 per page; the last page may hold one.
    const last = p === layout.pages.length - 1;
    if (!(page.slots.length === 8 || (last && page.slots.length === 4))) {
      problems.push(`${at}: ${page.slots.length} panels`);
    }
    // Strips in reading order: runs of 4 slots that share an x and a scene.
    const strips = [page.slots.slice(0, 4), page.slots.slice(4)].filter((strip) => strip.length > 0);
    for (const strip of strips) {
      if (new Set(strip.map((slot) => slot.x)).size !== 1) problems.push(`${at}: a strip is not one column`);
      if (new Set(strip.map((slot) => sceneOf.get(slot.panelId))).size !== 1) problems.push(`${at}: a strip mixes scenes`);
    }
    if (strips.length === 2 && strips[0][0].x <= strips[1][0].x) problems.push(`${at}: the left strip reads first`);
  });
  return problems;
}

const FORMAT_RULES: Record<ProjectFormat, typeof mangaViolations> = {
  manga: mangaViolations,
  manhwa: manhwaViolations,
  '4koma': komaViolations,
};

const SEEDS: Record<ProjectFormat, number> = { manga: 0x6d61, manhwa: 0x6877, '4koma': 0x346b };

// Lays out RUNS seeded random plans of one format and collects every violation.
function run(format: ProjectFormat) {
  const rand = mulberry32(SEEDS[format]);
  const problems: string[] = [];
  const results: { plan: PanelPlanInput; layout: Omit<Layout, 'revision'> }[] = [];
  for (let i = 0; i < RUNS; i++) {
    const plan = randomPlan(rand, format);
    const layout = autoLayout(plan, format, null);
    results.push({ plan, layout });
    for (const problem of [...violations(plan, format, layout), ...FORMAT_RULES[format](plan, layout)]) {
      problems.push(`plan ${i}: ${problem}`);
    }
  }
  return { problems, results };
}

describe('autoLayout properties (200 seeded random plans per format)', () => {
  it.each(['manga', 'manhwa', '4koma'] as const)('%s: every rule holds for every plan', (format) => {
    const { problems, results } = run(format);
    expect(problems.slice(0, 5)).toEqual([]);
    expect(Math.max(...results.map(({ plan }) => countPanels(plan)))).toBe(PLAN_LIMITS.panels);
  });

  it('manga: the random plans reach every page rule', () => {
    const pages = run('manga').results.flatMap(({ layout }) =>
      layout.pages.map((page, p) => ({
        tiers: tiersOf(page).length,
        panels: page.slots.length,
        last: p === layout.pages.length - 1,
      })),
    );
    expect(pages.some((page) => page.tiers === 3 && page.panels === 6)).toBe(true);
    expect(pages.some((page) => !page.last && page.tiers === 2)).toBe(true); // closed at 6 panels
    expect(pages.some((page) => page.last && page.tiers === 1)).toBe(true); // stretched at most 2x
  });
});
