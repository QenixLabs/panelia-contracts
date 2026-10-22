import { getPreset } from './preset.js';
import type { Preset } from './preset.js';
import type { KomaVariant, ProjectFormat } from './project.js';
import type { FineControls, StyleProfile } from './style.js';

// Pure series update rules shared by the server (PATCH /projects/:id), the web settings page and
// the web mocks. Moved from panelia-server src/modules/projects/preset-resolver.ts.

export interface SeriesState {
  format: ProjectFormat;
  presetId: string | null;
  basedOnPresetId: string | null;
  style: StyleProfile;
}

export interface SeriesPatch {
  format?: ProjectFormat;
  presetId?: string | null;
  style?: StyleProfile;
}

/** Thrown by the series rules. The server maps it to a 400 DomainException with the same code. */
export class SeriesRuleError extends Error {
  readonly code: 'PRESET_UNKNOWN' | 'PRESET_FORMAT_MISMATCH';

  constructor(code: 'PRESET_UNKNOWN' | 'PRESET_FORMAT_MISMATCH', message: string) {
    super(message);
    this.name = 'SeriesRuleError';
    this.code = code;
  }
}

export function sameStyle(a: StyleProfile, b: StyleProfile): boolean {
  return (
    a.renderFamily === b.renderFamily &&
    a.artDirection === b.artDirection &&
    a.mood === b.mood &&
    (Object.keys(a.fine) as (keyof FineControls)[]).every((k) => a.fine[k] === b.fine[k])
  );
}

// A deep copy: StyleProfile is flat apart from `fine`.
function cloneStyle(style: StyleProfile): StyleProfile {
  return { ...style, fine: { ...style.fine } };
}

function presetFor(format: ProjectFormat, presetId: string): Preset {
  const preset = getPreset(presetId);
  if (!preset) {
    throw new SeriesRuleError('PRESET_UNKNOWN', 'Unknown preset');
  }
  if (!preset.formats.includes(format)) {
    throw new SeriesRuleError('PRESET_FORMAT_MISMATCH', 'Preset does not support this format');
  }
  return preset;
}

export function resolvePreset(input: {
  format: ProjectFormat;
  presetId: string;
  style?: StyleProfile;
}): Omit<SeriesState, 'format'> {
  const preset = presetFor(input.format, input.presetId);
  if (input.style && !sameStyle(input.style, preset.style)) {
    return { presetId: null, basedOnPresetId: preset.id, style: input.style };
  }
  return {
    presetId: preset.id,
    basedOnPresetId: preset.id,
    style: cloneStyle(input.style ?? preset.style),
  };
}

export function applyFormatChange(state: SeriesState): SeriesState {
  if (state.presetId === null) return state;
  const preset = getPreset(state.presetId);
  if (preset && preset.formats.includes(state.format)) return state;
  return { ...state, presetId: null };
}

export function resolveSeriesUpdate(current: SeriesState, patch: SeriesPatch): SeriesState {
  const format = patch.format ?? current.format;

  if (typeof patch.presetId === 'string') {
    return { format, ...resolvePreset({ format, presetId: patch.presetId, style: patch.style }) };
  }

  if (patch.presetId === null) {
    return {
      format,
      presetId: null,
      basedOnPresetId: current.basedOnPresetId,
      style: patch.style ?? current.style,
    };
  }

  if (patch.style) {
    const kept = current.presetId ? getPreset(current.presetId) : undefined;
    return applyFormatChange({
      format,
      presetId: kept && sameStyle(patch.style, kept.style) ? kept.id : null,
      basedOnPresetId: current.basedOnPresetId,
      style: patch.style,
    });
  }

  return applyFormatChange({ ...current, format });
}

export function komaVariantFor(format: ProjectFormat): KomaVariant | null {
  return format === '4koma' ? 'classic_vertical' : null;
}
