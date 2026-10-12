import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiErrorSchema, apiSuccessSchema } from './envelope.js';
import type { ApiSuccess } from './envelope.js';

describe('apiSuccessSchema', () => {
  const payload = z.object({ id: z.string() });

  it('parses a success envelope', () => {
    const schema = apiSuccessSchema(payload);
    const result = schema.parse({
      message: 'ok',
      data: { id: 'usr_1' },
      success: true,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'usr_1' });
  });

  it('rejects a success envelope with success=false', () => {
    const schema = apiSuccessSchema(payload);
    expect(() =>
      schema.parse({ message: 'ok', data: { id: 'usr_1' }, success: false }),
    ).toThrow();
  });
});

describe('apiErrorSchema', () => {
  it('parses an error envelope', () => {
    const result = apiErrorSchema.parse({
      message: 'boom',
      data: null,
      success: false,
    });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });
});

describe('ApiSuccess type', () => {
  it('carries the generic data type', () => {
    const envelope: ApiSuccess<{ id: string }> = {
      message: 'ok',
      data: { id: 'usr_1' },
      success: true,
    };
    expect(envelope.data.id).toBe('usr_1');
  });
});
