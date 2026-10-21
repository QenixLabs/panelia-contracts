import { describe, expect, it } from 'vitest';
import { apiErrorCodeSchema } from './errors.js';

describe('apiErrorCodeSchema', () => {
  it('lists the Phase 2 domain codes', () => {
    expect(apiErrorCodeSchema.options).toEqual([
      'RATING_LOCKED',
      'PRESET_FORMAT_MISMATCH',
      'PRESET_UNKNOWN',
      'REF_LIMIT',
      'UPLOAD_MISMATCH',
      'UNSUPPORTED_TYPE',
      'FILE_TOO_LARGE',
    ]);
  });
});
