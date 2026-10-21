import { describe, expect, it } from 'vitest';
import {
  artDirectionSchema,
  fineControlsSchema,
  moodSchema,
  renderFamilySchema,
  styleProfileSchema,
} from './style.js';
import type { StyleProfile } from './style.js';

const fine = {
  lineWeight: 50, realism: 50, saturation: 50, shadingHardness: 50,
  detail: 50, eyeExaggeration: 50, texture: 50, lightingStrength: 50,
};

const profile: StyleProfile = {
  renderFamily: 'bw_ink',
  artDirection: 'seinen_cinematic',
  mood: 'gritty',
  fine,
};

describe('style layers', () => {
  it('exposes the ST-05 option sets', () => {
    expect(renderFamilySchema.options).toEqual([
      'bw_ink', 'cel_color', 'painterly', 'semi_realistic', 'brush_watercolor',
    ]);
    expect(artDirectionSchema.options).toHaveLength(11);
    expect(moodSchema.options).toEqual([
      'bright', 'dark', 'warm', 'cold', 'dreamy', 'gritty', 'cinematic',
    ]);
  });
});

describe('fineControlsSchema', () => {
  it('accepts 0 and 100 bounds', () => {
    expect(fineControlsSchema.parse({ ...fine, detail: 0, texture: 100 }).detail).toBe(0);
  });

  it('rejects out-of-range and fractional values', () => {
    expect(() => fineControlsSchema.parse({ ...fine, detail: 101 })).toThrow();
    expect(() => fineControlsSchema.parse({ ...fine, detail: -1 })).toThrow();
    expect(() => fineControlsSchema.parse({ ...fine, detail: 50.5 })).toThrow();
  });

  it('rejects a missing dial', () => {
    const { texture: _t, ...rest } = fine;
    expect(() => fineControlsSchema.parse(rest)).toThrow();
  });
});

describe('styleProfileSchema', () => {
  it('round-trips a profile', () => {
    expect(styleProfileSchema.parse(profile)).toEqual(profile);
  });

  it('rejects an unknown mood', () => {
    expect(() => styleProfileSchema.parse({ ...profile, mood: 'sad' })).toThrow();
  });
});
