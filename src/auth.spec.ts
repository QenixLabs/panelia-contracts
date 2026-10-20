import { describe, expect, it } from 'vitest';
import { authResponseSchema } from './auth.js';

const validUser = {
  id: 'usr_1',
  email: 'kai@panelia.app',
  name: 'Kai',
  plan: 'free',
  avatarUrl: null,
  createdAt: '2026-10-20T00:00:00.000Z',
};

describe('authResponseSchema', () => {
  it('round-trips a login/register payload', () => {
    const parsed = authResponseSchema.parse({
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.x.y',
      user: validUser,
    });
    expect(parsed.user.plan).toBe('free');
    expect(parsed.accessToken.length).toBeGreaterThan(0);
  });

  it('rejects missing user', () => {
    expect(() =>
      authResponseSchema.parse({ accessToken: 'tok' }),
    ).toThrow();
  });

  it('rejects empty accessToken', () => {
    expect(() =>
      authResponseSchema.parse({ accessToken: '', user: validUser }),
    ).toThrow();
  });
});
