import { describe, expect, it } from 'vitest';
import {
  LAYOUT_TEMPLATE,
  LAYOUT_UNITS,
  layoutDirection,
  layoutPageKindSchema,
  layoutPageSchema,
  layoutSchema,
  slotSchema,
} from './layout.js';
import type { Layout, LayoutPage, Slot } from './layout.js';

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
