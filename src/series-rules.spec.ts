import { describe, expect, it } from 'vitest';
import { getPreset } from './preset.js';
import {
  SeriesRuleError,
  applyFormatChange,
  komaVariantFor,
  resolvePreset,
  resolveSeriesUpdate,
  sameStyle,
} from './series-rules.js';
import type { SeriesState } from './series-rules.js';
import type { StyleProfile } from './style.js';

// Ported from panelia-server src/modules/projects/preset-resolver.spec.ts. The server's
// DomainException (and its 400 status) is replaced by SeriesRuleError; S2 maps one to the other.

const shonen = getPreset('shonen_action_manga')!;
const webtoon = getPreset('clean_webtoon')!;

// An equal but distinct style (contracts has no DOM or Node typings for structuredClone).
const copy = (s: StyleProfile): StyleProfile => ({ ...s, fine: { ...s.fine } });

const tweak = (s: StyleProfile): StyleProfile => ({
  ...s,
  fine: { ...s.fine, detail: s.fine.detail === 100 ? 99 : s.fine.detail + 1 },
});

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof SeriesRuleError) return e.code;
    throw e;
  }
  return undefined;
};

const mangaShonen: SeriesState = {
  format: 'manga',
  presetId: 'shonen_action_manga',
  basedOnPresetId: 'shonen_action_manga',
  style: shonen.style,
};

describe('SeriesRuleError', () => {
  it('is an Error carrying the API error code', () => {
    const err = new SeriesRuleError('PRESET_UNKNOWN', 'Unknown preset');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SeriesRuleError');
    expect(err.code).toBe('PRESET_UNKNOWN');
    expect(err.message).toBe('Unknown preset');
  });
});

describe('resolvePreset', () => {
  it('copies the preset style when none is sent', () => {
    const out = resolvePreset({ format: 'manga', presetId: 'shonen_action_manga' });
    expect(out).toEqual({
      presetId: 'shonen_action_manga',
      basedOnPresetId: 'shonen_action_manga',
      style: shonen.style,
    });
    expect(out.style).not.toBe(shonen.style);
    expect(out.style.fine).not.toBe(shonen.style.fine);
  });

  it('keeps presetId when the sent style equals the preset', () => {
    const out = resolvePreset({
      format: 'manga',
      presetId: 'shonen_action_manga',
      style: copy(shonen.style),
    });
    expect(out.presetId).toBe('shonen_action_manga');
  });

  it('a customized style clears presetId and keeps basedOn', () => {
    const custom = tweak(shonen.style);
    const out = resolvePreset({ format: 'manga', presetId: 'shonen_action_manga', style: custom });
    expect(out).toEqual({
      presetId: null,
      basedOnPresetId: 'shonen_action_manga',
      style: custom,
    });
  });

  it('unknown preset → PRESET_UNKNOWN', () => {
    expect(codeOf(() => resolvePreset({ format: 'manga', presetId: 'nope' }))).toBe('PRESET_UNKNOWN');
    expect(() => resolvePreset({ format: 'manga', presetId: 'nope' })).toThrow('Unknown preset');
  });

  it('preset not listing the format → PRESET_FORMAT_MISMATCH', () => {
    expect(codeOf(() => resolvePreset({ format: 'manga', presetId: 'clean_webtoon' }))).toBe(
      'PRESET_FORMAT_MISMATCH',
    );
  });
});

describe('sameStyle', () => {
  it('compares every layer and dial', () => {
    expect(sameStyle(shonen.style, copy(shonen.style))).toBe(true);
    expect(sameStyle(shonen.style, tweak(shonen.style))).toBe(false);
    expect(sameStyle(shonen.style, { ...shonen.style, mood: 'bright' })).toBe(false);
  });
});

describe('applyFormatChange', () => {
  it('keeps a preset that lists the new format', () => {
    expect(applyFormatChange({ ...mangaShonen, format: '4koma' }).presetId).toBe(
      'shonen_action_manga',
    );
  });

  it('clears a preset that does not list the new format, keeps style + basedOn', () => {
    const out = applyFormatChange({ ...mangaShonen, format: 'manhwa' });
    expect(out).toEqual({
      format: 'manhwa',
      presetId: null,
      basedOnPresetId: 'shonen_action_manga',
      style: shonen.style,
    });
  });

  it('leaves a custom (null) preset alone', () => {
    const custom = { ...mangaShonen, presetId: null, format: 'manhwa' as const };
    expect(applyFormatChange(custom)).toEqual(custom);
  });
});

describe('resolveSeriesUpdate', () => {
  it('no series keys → unchanged', () => {
    expect(resolveSeriesUpdate(mangaShonen, {})).toEqual(mangaShonen);
  });

  it('format change to manhwa resets presetId', () => {
    const out = resolveSeriesUpdate(mangaShonen, { format: 'manhwa' });
    expect(out.presetId).toBeNull();
    expect(out.basedOnPresetId).toBe('shonen_action_manga');
    expect(out.style).toEqual(shonen.style);
  });

  it('format + new preset applies that preset', () => {
    const out = resolveSeriesUpdate(mangaShonen, { format: 'manhwa', presetId: 'clean_webtoon' });
    expect(out).toEqual({
      format: 'manhwa',
      presetId: 'clean_webtoon',
      basedOnPresetId: 'clean_webtoon',
      style: webtoon.style,
    });
  });

  it('new preset checked against the resulting format', () => {
    expect(codeOf(() => resolveSeriesUpdate(mangaShonen, { presetId: 'clean_webtoon' }))).toBe(
      'PRESET_FORMAT_MISMATCH',
    );
  });

  it('presetId null + style → custom, basedOn kept', () => {
    const custom = tweak(shonen.style);
    const out = resolveSeriesUpdate(mangaShonen, { presetId: null, style: custom });
    expect(out).toEqual({ ...mangaShonen, presetId: null, style: custom });
  });

  it('style-only edit that differs clears presetId', () => {
    const out = resolveSeriesUpdate(mangaShonen, { style: tweak(shonen.style) });
    expect(out.presetId).toBeNull();
    expect(out.basedOnPresetId).toBe('shonen_action_manga');
  });

  it('style-only edit equal to the preset keeps presetId', () => {
    const out = resolveSeriesUpdate(mangaShonen, { style: copy(shonen.style) });
    expect(out.presetId).toBe('shonen_action_manga');
  });
});

describe('komaVariantFor', () => {
  it('classic_vertical only for 4koma', () => {
    expect(komaVariantFor('4koma')).toBe('classic_vertical');
    expect(komaVariantFor('manga')).toBeNull();
    expect(komaVariantFor('manhwa')).toBeNull();
  });
});
