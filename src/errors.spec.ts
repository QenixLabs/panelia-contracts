import { describe, expect, it } from 'vitest';
import { apiErrorSchema } from './envelope.js';
import { apiErrorCodeSchema, apiErrorDetailsSchemas, errorDetails } from './errors.js';
import type { ApiErrorDetails } from './errors.js';

type DetailedCode = keyof typeof apiErrorDetailsSchemas;

const SAVE_ID = '9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d';

// One valid and one malformed `details` per code that carries details.
const DETAILS: { [C in DetailedCode]: { valid: ApiErrorDetails<C>; invalid: unknown } } = {
  SCRIPT_TOO_SHORT: { valid: { words: 12, limit: 20 }, invalid: { words: '12', limit: 20 } },
  SCRIPT_TOO_LONG: { valid: { words: 3240, limit: 3000 }, invalid: { words: 3240 } },
  INSUFFICIENT_CREDITS: {
    valid: { required: 70, available: 60 },
    invalid: { required: 70.5, available: 60 },
  },
  PLAN_CONFLICT: {
    valid: { currentRevision: 4, lastSaveId: SAVE_ID },
    invalid: { currentRevision: 4, lastSaveId: 'save-1' },
  },
  CHARACTER_IN_USE: { valid: { chapterNumbers: [3] }, invalid: { chapterNumbers: [] } },
  PLAN_UNRESOLVED: { valid: { count: 2, names: ['Kaito', 'Mina'] }, invalid: { count: 0, names: [] } },
  PLAN_INCOMPLETE: { valid: { emptyPanels: 2 }, invalid: { emptyPanels: 0 } },
};

describe('apiErrorCodeSchema', () => {
  it('lists the Phase 2 codes, then the Phase 3 codes', () => {
    expect(apiErrorCodeSchema.options).toEqual([
      'RATING_LOCKED',
      'PRESET_FORMAT_MISMATCH',
      'PRESET_UNKNOWN',
      'REF_LIMIT',
      'UPLOAD_MISMATCH',
      'UNSUPPORTED_TYPE',
      'FILE_TOO_LARGE',
      'INVALID_ID',
      'RATE_LIMITED',
      'SCRIPT_TOO_SHORT',
      'SCRIPT_TOO_LONG',
      'INSUFFICIENT_CREDITS',
      'PLAN_CONFLICT',
      'PLAN_LOCKED',
      'PARSE_IN_PROGRESS',
      'PLAN_EXISTS',
      'FORMAT_LOCKED',
      'IDEMPOTENCY_CONFLICT',
      'CHARACTER_IN_USE',
      'PLAN_UNRESOLVED',
      'PLAN_INCOMPLETE',
    ]);
  });
});

describe('apiErrorDetailsSchemas', () => {
  it('covers exactly the codes that carry details', () => {
    expect(Object.keys(apiErrorDetailsSchemas)).toEqual([
      'SCRIPT_TOO_SHORT',
      'SCRIPT_TOO_LONG',
      'INSUFFICIENT_CREDITS',
      'PLAN_CONFLICT',
      'CHARACTER_IN_USE',
      'PLAN_UNRESOLVED',
      'PLAN_INCOMPLETE',
    ]);
  });

  it.each(Object.entries(DETAILS))('%s parses its details and rejects malformed ones', (code, cases) => {
    const schema = apiErrorDetailsSchemas[code as DetailedCode];
    expect(schema.parse(cases.valid)).toEqual(cases.valid);
    expect(schema.safeParse(cases.invalid).success).toBe(false);
  });

  it('allows a null lastSaveId on PLAN_CONFLICT', () => {
    const details = { currentRevision: 4, lastSaveId: null };
    expect(apiErrorDetailsSchemas.PLAN_CONFLICT.parse(details)).toEqual(details);
  });
});

describe('errorDetails', () => {
  it('returns typed details for the matching code', () => {
    const error = { code: 'INSUFFICIENT_CREDITS', details: { required: 70, available: 60 } } as const;
    const details = errorDetails(error, 'INSUFFICIENT_CREDITS');
    expect(details).toEqual({ required: 70, available: 60 });
    expect(details?.required).toBe(70);
  });

  it('returns null when the code differs or is missing', () => {
    expect(errorDetails({ code: 'PLAN_LOCKED' }, 'PLAN_CONFLICT')).toBeNull();
    expect(errorDetails({ details: { emptyPanels: 2 } }, 'PLAN_INCOMPLETE')).toBeNull();
  });

  it('returns null when the details are missing or malformed', () => {
    expect(errorDetails({ code: 'PLAN_CONFLICT' }, 'PLAN_CONFLICT')).toBeNull();
    const malformed = { code: 'PLAN_CONFLICT', details: { currentRevision: 'four' } } as const;
    expect(errorDetails(malformed, 'PLAN_CONFLICT')).toBeNull();
  });

  it('reads details straight from a parsed error envelope', () => {
    const envelope = apiErrorSchema.parse({
      message: 'This plan was changed in another tab. Reload to get the latest version',
      data: null,
      success: false,
      code: 'PLAN_CONFLICT',
      details: { currentRevision: 5, lastSaveId: null },
    });
    expect(errorDetails(envelope, 'PLAN_CONFLICT')).toEqual({ currentRevision: 5, lastSaveId: null });
  });
});
