import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESET_BY_FORMAT,
  PRESETS,
  getPreset,
  presetSchema,
  presetsForFormat,
} from './preset.js';
import { projectFormatSchema } from './project.js';

describe('PRESETS invariants', () => {
  it('ships 13 presets (12 from ST-01 + Classic 4-Koma Comedy)', () => {
    expect(PRESETS).toHaveLength(13);
  });

  it('every preset parses against presetSchema', () => {
    for (const p of PRESETS) expect(() => presetSchema.parse(p)).not.toThrow();
  });

  it('ids are unique', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every format has at least one preset', () => {
    for (const f of projectFormatSchema.options) {
      expect(presetsForFormat(f).length).toBeGreaterThan(0);
    }
  });

  it('B&W ink presets carry zero saturation', () => {
    for (const p of PRESETS.filter((x) => x.style.renderFamily === 'bw_ink')) {
      expect(p.style.fine.saturation).toBe(0);
    }
  });
});

describe('presetsForFormat', () => {
  it('manhwa gets the 6 manhwa presets', () => {
    expect(presetsForFormat('manhwa').map((p) => p.id)).toEqual([
      'clean_webtoon',
      'action_manhwa',
      'dark_fantasy_manhwa',
      'romance_webtoon',
      'romantasy_manhwa',
      'semi_realistic_manhwa',
    ]);
  });

  it('4koma gets its own preset first, then the manga presets', () => {
    const ids = presetsForFormat('4koma').map((p) => p.id);
    expect(ids[0]).toBe('classic_4koma_comedy');
    expect(ids).toHaveLength(7);
  });
});

describe('getPreset / DEFAULT_PRESET_BY_FORMAT', () => {
  it('finds by id and returns undefined for unknown', () => {
    expect(getPreset('horror_manga')?.name).toBe('Horror Manga');
    expect(getPreset('nope')).toBeUndefined();
  });

  it('each default is valid for its format', () => {
    for (const f of projectFormatSchema.options) {
      const preset = getPreset(DEFAULT_PRESET_BY_FORMAT[f]);
      expect(preset?.formats).toContain(f);
    }
  });
});
