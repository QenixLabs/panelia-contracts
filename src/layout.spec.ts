import { describe, expect, it } from 'vitest';
import type { PanelPlanInput, Scene } from './chapter.js';
import {
  LAYOUT_TEMPLATE,
  LAYOUT_UNITS,
  autoLayout,
  layoutDirection,
  layoutPageKindSchema,
  layoutPageSchema,
  layoutSchema,
  slotSchema,
} from './layout.js';
import type { Layout, LayoutPage, Slot } from './layout.js';
import { shotTypeSchema } from './plan-basics.js';
import type { ShotType } from './plan-basics.js';
import { uuidSchema } from './primitives.js';

// ---------- fixtures ----------

let nextId = 1;
// z.uuid() checks the version and variant nibbles, so mint well-formed v4 ids.
const uid = () => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

function slot(over: Partial<Slot> = {}): Slot {
  return { id: uid(), panelId: uid(), x: 60, y: 70, w: 880, h: 400, crop: null, z: 0, ...over };
}

function layoutPage(over: Partial<LayoutPage> = {}): LayoutPage {
  return {
    id: uid(),
    index: 0,
    kind: 'page',
    width: 1000,
    height: 1414,
    sceneIds: [uid()],
    slots: [slot()],
    ...over,
  };
}

function layout(over: Partial<Layout> = {}): Layout {
  return { revision: 1, template: 'shot_weighted_v1', direction: 'rtl', pages: [layoutPage()], ...over };
}

// ---------- schemas and constants ----------

describe('layout constants', () => {
  it('names the template shot_weighted_v1', () => {
    expect(LAYOUT_TEMPLATE).toBe('shot_weighted_v1');
  });

  it('pins the page units of every format', () => {
    expect(LAYOUT_UNITS).toEqual({
      manga: { width: 1000, height: 1414, margin: { x: 60, top: 70, bottom: 70 }, tierGap: 36, panelGap: 16 },
      '4koma': { width: 1000, height: 1414, stripWidth: 395, panelHeight: 296, panelGap: 16, titleBand: 40 },
      manhwa: { width: 800, topPad: 80, endPad: 200, sceneGap: 480, panelGap: 120 },
    });
  });
});

describe('layoutDirection', () => {
  it('reads manga and 4-koma right to left, manhwa left to right', () => {
    expect(layoutDirection('manga')).toBe('rtl');
    expect(layoutDirection('4koma')).toBe('rtl');
    expect(layoutDirection('manhwa')).toBe('ltr');
  });
});

describe('slotSchema', () => {
  it('round-trips a slot with the default cover crop and one with a crop', () => {
    const cover = slot();
    expect(slotSchema.parse(cover)).toEqual(cover);
    const cropped = slot({ crop: { scale: 1.5, x: -40, y: 12 } });
    expect(slotSchema.parse(cropped)).toEqual(cropped);
  });

  it('rejects an empty size, a crop scale under 1 and a fractional z', () => {
    const ok = (over: Partial<Slot>) => slotSchema.safeParse(slot(over)).success;
    expect(ok({ w: 0 })).toBe(false);
    expect(ok({ h: -1 })).toBe(false);
    expect(ok({ crop: { scale: 0.9, x: 0, y: 0 } })).toBe(false);
    expect(ok({ z: 0.5 })).toBe(false);
    expect(ok({ x: -12.5, y: 0.25, z: -1 })).toBe(true); // positions are free; z only needs an integer
  });

  it('rejects slot and panel ids that are not uuids', () => {
    expect(slotSchema.safeParse(slot({ id: 's1' })).success).toBe(false);
    expect(slotSchema.safeParse(slot({ panelId: 'p1' })).success).toBe(false);
  });
});

describe('layoutPageSchema', () => {
  it('round-trips a manga page, a manhwa section and a 4-koma strip page', () => {
    expect(layoutPageKindSchema.options).toEqual(['page', 'section', 'strip_page']);
    for (const page of [
      layoutPage(),
      layoutPage({ kind: 'section', width: 800, height: 3000 }),
      layoutPage({ kind: 'strip_page', sceneIds: [uid(), uid()] }),
    ]) {
      expect(layoutPageSchema.parse(page)).toEqual(page);
    }
  });

  it('needs a scene, a slot and a non-negative integer index', () => {
    const ok = (over: Partial<LayoutPage>) => layoutPageSchema.safeParse(layoutPage(over)).success;
    expect(ok({ sceneIds: [] })).toBe(false);
    expect(ok({ slots: [] })).toBe(false);
    expect(ok({ index: -1 })).toBe(false);
    expect(ok({ index: 1.5 })).toBe(false);
    expect(ok({ kind: 'spread' as LayoutPage['kind'] })).toBe(false);
  });
});

describe('layoutSchema', () => {
  it('round-trips a layout at revision 1', () => {
    const l = layout({ direction: 'ltr' });
    expect(layoutSchema.parse(l)).toEqual(l);
  });

  it('rejects revision 0, another template, an unknown direction and no pages', () => {
    const ok = (input: unknown) => layoutSchema.safeParse(input).success;
    expect(ok({ ...layout(), revision: 0 })).toBe(false);
    expect(ok({ ...layout(), template: 'grid_v1' })).toBe(false);
    expect(ok({ ...layout(), direction: 'ttb' })).toBe(false);
    expect(ok({ ...layout(), pages: [] })).toBe(false);
  });
});

// ---------- autoLayout ----------

// Readable fixed ids: panel n of the plan, scene n of the plan, and the n-th id autoLayout mints.
const panelId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sceneId = (n: number) => `00000000-0000-4000-8000-5ce${String(n).padStart(9, '0')}`;
const layoutId = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

// A fresh newId for every call: layoutId(1), layoutId(2), ...
function counter(): () => string {
  let n = 0;
  return () => layoutId(++n);
}

// One shot list per scene; panels and scenes are numbered from 1 in plan order.
function planOf(...scenes: ShotType[][]): PanelPlanInput {
  let n = 0;
  return {
    tier: 'draft',
    scenes: scenes.map(
      (shots, s): Scene => ({
        id: sceneId(s + 1),
        heading: `Scene ${s + 1}`,
        location: 'School rooftop, dusk',
        cast: [],
        beatLabels: null,
        panels: shots.map((shot) => ({
          id: panelId(++n),
          shot,
          subject: 'Aoi at the railing',
          cast: [],
          action: 'Aoi looks out over the city.',
          mood: 'tense',
          dialogue: [],
        })),
      }),
    ),
  };
}

// A 4-koma plan of n strips (4 panels and the 4 beat labels each).
function stripPlan(n: number): PanelPlanInput {
  const strip: ShotType[] = ['medium', 'close_up', 'wide', 'insert'];
  const plan = planOf(...Array.from({ length: n }, () => strip));
  for (const scene of plan.scenes) scene.beatLabels = ['Setup', 'Development', 'Turn', 'Punchline'];
  return plan;
}

const pagesOf = (format: 'manga' | 'manhwa' | '4koma', plan: PanelPlanInput) =>
  autoLayout(plan, format, null, { newId: counter() }).pages;

describe('autoLayout: manga tiers', () => {
  const manga = (...scenes: ShotType[][]) => pagesOf('manga', planOf(...scenes));

  it('gives a full-width shot a tier of its own, across the content width', () => {
    const [page] = manga(['medium', 'establishing', 'medium']);
    expect(page.slots.map((s) => [s.x, s.w])).toEqual([[60, 880], [60, 880], [60, 880]]);
    // 1202 split 1.0 : 1.2 : 1.0; the full-width tier is the tallest.
    expect(page.slots.map((s) => [s.y, s.h])).toEqual([[70, 376], [482, 451], [969, 375]]);
  });

  it('shares leftover units in proportion (medium + extreme close-up = 60/40), first panel on the right', () => {
    const [page] = manga(['medium', 'extreme_close_up']);
    expect(page.slots.map((s) => [s.x, s.y, s.w])).toEqual([[422, 70, 518], [60, 70, 346]]);
  });

  it('fits three thirds in a tier and starts a new tier for the fourth', () => {
    const [page] = manga(['insert', 'extreme_close_up', 'insert', 'insert']);
    expect(page.slots.map((s) => [s.x, s.w])).toEqual([[657, 283], [358, 283], [60, 282], [60, 880]]);
    expect(page.slots[3].y).toBeGreaterThan(page.slots[0].y);
  });

  it('closes a tier at a scene boundary', () => {
    const [page] = manga(['medium'], ['medium']);
    expect(page.slots.map((s) => [s.x, s.w])).toEqual([[60, 880], [60, 880]]);
    expect(page.sceneIds).toEqual([sceneId(1), sceneId(2)]);
  });
});

describe('autoLayout: manga pages', () => {
  const manga = (...scenes: ShotType[][]) => pagesOf('manga', planOf(...scenes));

  it('holds at most 3 tiers on a page', () => {
    expect(manga(['wide', 'wide', 'wide', 'wide']).map((p) => p.slots.length)).toEqual([3, 1]);
  });

  it('holds at most 6 panels on a page; a page that is not the last fills its height', () => {
    const pages = manga(['insert', 'insert', 'insert', 'insert', 'insert', 'insert', 'medium']);
    expect(pages.map((p) => p.slots.length)).toEqual([6, 1]);
    // Two tiers split 1274 - 36 = 1238 evenly.
    expect(pages[0].slots.map((s) => [s.y, s.h])).toEqual([
      [70, 619], [70, 619], [70, 619], [725, 619], [725, 619], [725, 619],
    ]);
  });

  it('splits 1274 minus the tier gaps by weight: full-width 1.2, others 1.0, all thirds 0.85', () => {
    const [page] = manga(['wide', 'close_up', 'pov', 'insert', 'insert', 'insert']);
    const tiers = [...new Map(page.slots.map((s) => [s.y, s.h])).entries()];
    expect(tiers).toEqual([[70, 473], [579, 394], [1009, 335]]); // 1202 as 1.2 : 1.0 : 0.85
    expect(1009 + 335).toBe(1344); // the last tier ends on the bottom margin
  });

  it('stretches the last page to fill it, each tier up to twice its normal height', () => {
    const last = (...shots: ShotType[]) => manga(shots).at(-1)!.slots.map((s) => [s.y, s.h]);
    expect(last('medium', 'medium', 'medium')).toEqual([[70, 619], [70, 619], [725, 619]]);
    // One tier can't fill the page: normal height is weight x (1274 - 2 x 36) / 3 = weight x 400.67.
    expect(last('medium')).toEqual([[70, 801]]);
    expect(last('wide')).toEqual([[70, 961]]);
    expect(last('insert')).toEqual([[70, 681]]);
  });
});

describe('autoLayout: manhwa', () => {
  it('gives every shot its height at the full width of 800', () => {
    const [section] = pagesOf('manhwa', planOf([...shotTypeSchema.options]));
    expect(section.slots.map((s) => [s.x, s.w, s.h])).toEqual([
      [0, 800, 640], // establishing
      [0, 800, 600], // wide
      [0, 800, 1000], // medium
      [0, 800, 800], // close_up
      [0, 800, 400], // extreme_close_up
      [0, 800, 1000], // over_shoulder
      [0, 800, 900], // pov
      [0, 800, 500], // insert
    ]);
  });

  it('makes one section per scene: 80 on top, 120 between panels, 480 between scenes, 200 at the end', () => {
    const pages = pagesOf('manhwa', planOf(['medium', 'medium'], ['close_up'], ['insert']));
    expect(pages.map((p) => [p.kind, p.width, p.height, p.sceneIds])).toEqual([
      ['section', 800, 80 + 1000 + 120 + 1000 + 240, [sceneId(1)]],
      ['section', 800, 240 + 800 + 240, [sceneId(2)]],
      ['section', 800, 240 + 500 + 200, [sceneId(3)]],
    ]);
    expect(pages.map((p) => p.slots.map((s) => s.y))).toEqual([[80, 1200], [240], [240]]);
  });
});

describe('autoLayout: 4-koma', () => {
  it('stacks a strip of 4 panels of 395x296, 16 apart, under the 40-unit title band', () => {
    const [page] = pagesOf('4koma', stripPlan(1));
    expect(page.slots.map((s) => [s.x, s.y, s.w, s.h])).toEqual([
      [535, 111, 395, 296],
      [535, 423, 395, 296],
      [535, 735, 395, 296],
      [535, 1047, 395, 296],
    ]);
  });

  it('puts two strips on a page, the right one first, with 70 margins and a 70 gutter', () => {
    const pages = pagesOf('4koma', stripPlan(3));
    expect(pages.map((p) => [p.kind, p.width, p.height, p.sceneIds])).toEqual([
      ['strip_page', 1000, 1414, [sceneId(1), sceneId(2)]],
      ['strip_page', 1000, 1414, [sceneId(3)]],
    ]);
    expect(pages[0].slots.map((s) => s.x)).toEqual([535, 535, 535, 535, 70, 70, 70, 70]);
    expect(pages[1].slots.map((s) => s.x)).toEqual([535, 535, 535, 535]);
  });

  it('treats komaVariant null as classic_vertical', () => {
    const plan = stripPlan(2);
    expect(autoLayout(plan, '4koma', null, { newId: counter() })).toEqual(
      autoLayout(plan, '4koma', 'classic_vertical', { newId: counter() }),
    );
  });

  it('still places every panel once if a scene is not a strip of 4 (never in a valid plan)', () => {
    const [page] = pagesOf('4koma', planOf(['medium', 'medium', 'medium', 'medium', 'medium', 'medium']));
    expect(page.slots.map((s) => s.panelId)).toEqual([1, 2, 3, 4, 5, 6].map(panelId));
    expect(page.slots.map((s) => s.x)).toEqual([535, 535, 535, 535, 70, 70]);
    expect(page.sceneIds).toEqual([sceneId(1)]);
  });
});

describe('autoLayout: the document', () => {
  const samples = { manga: planOf(['wide', 'medium'], ['insert']), manhwa: planOf(['wide', 'medium'], ['insert']), '4koma': stripPlan(3) };

  it('returns the template and the direction, with pages indexed in reading order', () => {
    for (const format of ['manga', 'manhwa', '4koma'] as const) {
      const out = autoLayout(samples[format], format, null, { newId: counter() });
      expect(out.template).toBe(LAYOUT_TEMPLATE);
      expect(out.direction).toBe(layoutDirection(format));
      expect(out.pages.map((p) => p.index)).toEqual(out.pages.map((_, i) => i));
      expect(layoutSchema.parse({ revision: 1, ...out })).toEqual({ revision: 1, ...out });
    }
  });

  it('starts every slot with the cover crop and stacks slots in reading order', () => {
    const [page] = pagesOf('manga', planOf(['medium', 'insert', 'wide']));
    expect(page.slots.map((s) => [s.crop, s.z])).toEqual([[null, 0], [null, 1], [null, 2]]);
  });

  it('mints ids with newId: each page id, then its slot ids in reading order', () => {
    const pages = pagesOf('manhwa', planOf(['wide'], ['medium', 'medium']));
    expect(pages.map((p) => [p.id, ...p.slots.map((s) => s.id)])).toEqual([
      [layoutId(1), layoutId(2)],
      [layoutId(3), layoutId(4), layoutId(5)],
    ]);
  });

  it('is deterministic: the same plan and newId sequence give the same layout', () => {
    for (const format of ['manga', 'manhwa', '4koma'] as const) {
      const once = autoLayout(samples[format], format, null, { newId: counter() });
      expect(autoLayout(samples[format], format, null, { newId: counter() })).toEqual(once);
    }
  });

  it('mints unique v4 uuids with crypto.randomUUID() by default', () => {
    const out = autoLayout(samples.manga, 'manga', null);
    const ids = out.pages.flatMap((p) => [p.id, ...p.slots.map((s) => s.id)]);
    expect(ids).toHaveLength(4); // 1 page + 3 slots
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(uuidSchema.safeParse(id).success).toBe(true);
  });
});

describe('autoLayout: fixed sample plans', () => {
  it('manga: 11 panels in 3 scenes', () => {
    const plan = planOf(
      ['establishing', 'medium', 'extreme_close_up', 'close_up'],
      ['insert', 'insert', 'extreme_close_up', 'wide', 'pov', 'over_shoulder'],
      ['medium'],
    );
    expect(autoLayout(plan, 'manga', null, { newId: counter() })).toMatchInlineSnapshot(`
      {
        "direction": "rtl",
        "pages": [
          {
            "height": 1414,
            "id": "00000000-0000-4000-a000-000000000001",
            "index": 0,
            "kind": "page",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000001",
            ],
            "slots": [
              {
                "crop": null,
                "h": 451,
                "id": "00000000-0000-4000-a000-000000000002",
                "panelId": "00000000-0000-4000-8000-000000000001",
                "w": 880,
                "x": 60,
                "y": 70,
                "z": 0,
              },
              {
                "crop": null,
                "h": 376,
                "id": "00000000-0000-4000-a000-000000000003",
                "panelId": "00000000-0000-4000-8000-000000000002",
                "w": 518,
                "x": 422,
                "y": 557,
                "z": 1,
              },
              {
                "crop": null,
                "h": 376,
                "id": "00000000-0000-4000-a000-000000000004",
                "panelId": "00000000-0000-4000-8000-000000000003",
                "w": 346,
                "x": 60,
                "y": 557,
                "z": 2,
              },
              {
                "crop": null,
                "h": 375,
                "id": "00000000-0000-4000-a000-000000000005",
                "panelId": "00000000-0000-4000-8000-000000000004",
                "w": 880,
                "x": 60,
                "y": 969,
                "z": 3,
              },
            ],
            "width": 1000,
          },
          {
            "height": 1414,
            "id": "00000000-0000-4000-a000-000000000006",
            "index": 1,
            "kind": "page",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000002",
            ],
            "slots": [
              {
                "crop": null,
                "h": 335,
                "id": "00000000-0000-4000-a000-000000000007",
                "panelId": "00000000-0000-4000-8000-000000000005",
                "w": 283,
                "x": 657,
                "y": 70,
                "z": 0,
              },
              {
                "crop": null,
                "h": 335,
                "id": "00000000-0000-4000-a000-000000000008",
                "panelId": "00000000-0000-4000-8000-000000000006",
                "w": 283,
                "x": 358,
                "y": 70,
                "z": 1,
              },
              {
                "crop": null,
                "h": 335,
                "id": "00000000-0000-4000-a000-000000000009",
                "panelId": "00000000-0000-4000-8000-000000000007",
                "w": 282,
                "x": 60,
                "y": 70,
                "z": 2,
              },
              {
                "crop": null,
                "h": 473,
                "id": "00000000-0000-4000-a000-000000000010",
                "panelId": "00000000-0000-4000-8000-000000000008",
                "w": 880,
                "x": 60,
                "y": 441,
                "z": 3,
              },
              {
                "crop": null,
                "h": 394,
                "id": "00000000-0000-4000-a000-000000000011",
                "panelId": "00000000-0000-4000-8000-000000000009",
                "w": 432,
                "x": 508,
                "y": 950,
                "z": 4,
              },
              {
                "crop": null,
                "h": 394,
                "id": "00000000-0000-4000-a000-000000000012",
                "panelId": "00000000-0000-4000-8000-000000000010",
                "w": 432,
                "x": 60,
                "y": 950,
                "z": 5,
              },
            ],
            "width": 1000,
          },
          {
            "height": 1414,
            "id": "00000000-0000-4000-a000-000000000013",
            "index": 2,
            "kind": "page",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000003",
            ],
            "slots": [
              {
                "crop": null,
                "h": 801,
                "id": "00000000-0000-4000-a000-000000000014",
                "panelId": "00000000-0000-4000-8000-000000000011",
                "w": 880,
                "x": 60,
                "y": 70,
                "z": 0,
              },
            ],
            "width": 1000,
          },
        ],
        "template": "shot_weighted_v1",
      }
    `);
  });

  it('manhwa: 5 panels in 2 scenes', () => {
    const plan = planOf(['establishing', 'medium', 'close_up'], ['insert', 'wide']);
    expect(autoLayout(plan, 'manhwa', null, { newId: counter() })).toMatchInlineSnapshot(`
      {
        "direction": "ltr",
        "pages": [
          {
            "height": 3000,
            "id": "00000000-0000-4000-a000-000000000001",
            "index": 0,
            "kind": "section",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000001",
            ],
            "slots": [
              {
                "crop": null,
                "h": 640,
                "id": "00000000-0000-4000-a000-000000000002",
                "panelId": "00000000-0000-4000-8000-000000000001",
                "w": 800,
                "x": 0,
                "y": 80,
                "z": 0,
              },
              {
                "crop": null,
                "h": 1000,
                "id": "00000000-0000-4000-a000-000000000003",
                "panelId": "00000000-0000-4000-8000-000000000002",
                "w": 800,
                "x": 0,
                "y": 840,
                "z": 1,
              },
              {
                "crop": null,
                "h": 800,
                "id": "00000000-0000-4000-a000-000000000004",
                "panelId": "00000000-0000-4000-8000-000000000003",
                "w": 800,
                "x": 0,
                "y": 1960,
                "z": 2,
              },
            ],
            "width": 800,
          },
          {
            "height": 1660,
            "id": "00000000-0000-4000-a000-000000000005",
            "index": 1,
            "kind": "section",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000002",
            ],
            "slots": [
              {
                "crop": null,
                "h": 500,
                "id": "00000000-0000-4000-a000-000000000006",
                "panelId": "00000000-0000-4000-8000-000000000004",
                "w": 800,
                "x": 0,
                "y": 240,
                "z": 0,
              },
              {
                "crop": null,
                "h": 600,
                "id": "00000000-0000-4000-a000-000000000007",
                "panelId": "00000000-0000-4000-8000-000000000005",
                "w": 800,
                "x": 0,
                "y": 860,
                "z": 1,
              },
            ],
            "width": 800,
          },
        ],
        "template": "shot_weighted_v1",
      }
    `);
  });

  it('4-koma: 3 strips', () => {
    expect(autoLayout(stripPlan(3), '4koma', 'classic_vertical', { newId: counter() })).toMatchInlineSnapshot(`
      {
        "direction": "rtl",
        "pages": [
          {
            "height": 1414,
            "id": "00000000-0000-4000-a000-000000000001",
            "index": 0,
            "kind": "strip_page",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000001",
              "00000000-0000-4000-8000-5ce000000002",
            ],
            "slots": [
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000002",
                "panelId": "00000000-0000-4000-8000-000000000001",
                "w": 395,
                "x": 535,
                "y": 111,
                "z": 0,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000003",
                "panelId": "00000000-0000-4000-8000-000000000002",
                "w": 395,
                "x": 535,
                "y": 423,
                "z": 1,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000004",
                "panelId": "00000000-0000-4000-8000-000000000003",
                "w": 395,
                "x": 535,
                "y": 735,
                "z": 2,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000005",
                "panelId": "00000000-0000-4000-8000-000000000004",
                "w": 395,
                "x": 535,
                "y": 1047,
                "z": 3,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000006",
                "panelId": "00000000-0000-4000-8000-000000000005",
                "w": 395,
                "x": 70,
                "y": 111,
                "z": 4,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000007",
                "panelId": "00000000-0000-4000-8000-000000000006",
                "w": 395,
                "x": 70,
                "y": 423,
                "z": 5,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000008",
                "panelId": "00000000-0000-4000-8000-000000000007",
                "w": 395,
                "x": 70,
                "y": 735,
                "z": 6,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000009",
                "panelId": "00000000-0000-4000-8000-000000000008",
                "w": 395,
                "x": 70,
                "y": 1047,
                "z": 7,
              },
            ],
            "width": 1000,
          },
          {
            "height": 1414,
            "id": "00000000-0000-4000-a000-000000000010",
            "index": 1,
            "kind": "strip_page",
            "sceneIds": [
              "00000000-0000-4000-8000-5ce000000003",
            ],
            "slots": [
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000011",
                "panelId": "00000000-0000-4000-8000-000000000009",
                "w": 395,
                "x": 535,
                "y": 111,
                "z": 0,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000012",
                "panelId": "00000000-0000-4000-8000-000000000010",
                "w": 395,
                "x": 535,
                "y": 423,
                "z": 1,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000013",
                "panelId": "00000000-0000-4000-8000-000000000011",
                "w": 395,
                "x": 535,
                "y": 735,
                "z": 2,
              },
              {
                "crop": null,
                "h": 296,
                "id": "00000000-0000-4000-a000-000000000014",
                "panelId": "00000000-0000-4000-8000-000000000012",
                "w": 395,
                "x": 535,
                "y": 1047,
                "z": 3,
              },
            ],
            "width": 1000,
          },
        ],
        "template": "shot_weighted_v1",
      }
    `);
  });
});
