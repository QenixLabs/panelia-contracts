import { describe, expect, it } from 'vitest';
import { objectIdSchema, uuidSchema } from './primitives.js';

describe('objectIdSchema', () => {
  it('accepts a 24-char lowercase hex Mongo id', () => {
    expect(objectIdSchema.parse('64b7f0c2a1b2c3d4e5f60718')).toBe('64b7f0c2a1b2c3d4e5f60718');
  });

  it('rejects uppercase, short, long, non-hex and legacy mock ids', () => {
    for (const bad of [
      '64B7F0C2A1B2C3D4E5F60718',
      '64b7f0c2a1b2c3d4e5f6071',
      '64b7f0c2a1b2c3d4e5f607180',
      '64b7f0c2a1b2c3d4e5f6071g',
      'p_ashfall',
    ]) {
      expect(objectIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('uuidSchema', () => {
  it('accepts a v4 uuid like crypto.randomUUID() mints', () => {
    expect(uuidSchema.parse('3f2b8c1e-9a4d-4f6b-8c2a-1d5e7f9a0b3c')).toBe(
      '3f2b8c1e-9a4d-4f6b-8c2a-1d5e7f9a0b3c',
    );
  });

  it('rejects a malformed uuid and one with an invalid variant nibble', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(uuidSchema.safeParse('3f2b8c1e-9a4d-4f6b-0c2a-1d5e7f9a0b3c').success).toBe(false);
  });
});
