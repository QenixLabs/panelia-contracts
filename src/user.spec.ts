import { describe, expect, it } from 'vitest';
import { userSchema, userPlanSchema } from './user.js';
import type { User, UserPlan } from './user.js';
import { jobStateSchema, jobStatusEventSchema } from './job-status.js';
import type { JobState, JobStatusEvent } from './job-status.js';
import { entityIdSchema, isoDateTimeSchema, urlSchema } from './primitives.js';

describe('primitives', () => {
  it('entityIdSchema accepts a non-empty short string', () => {
    expect(entityIdSchema.parse('usr_1')).toBe('usr_1');
  });
  it('entityIdSchema rejects empty string', () => {
    expect(() => entityIdSchema.parse('')).toThrow();
  });
  it('isoDateTimeSchema accepts ISO 8601', () => {
    expect(isoDateTimeSchema.parse('2026-10-12T10:00:00Z')).toBe(
      '2026-10-12T10:00:00Z',
    );
  });
  it('urlSchema accepts https URLs', () => {
    expect(urlSchema.parse('https://example.com/x.png')).toBe(
      'https://example.com/x.png',
    );
  });
});

describe('userSchema', () => {
  const base = {
    id: 'usr_1',
    email: 'nilesh@example.com',
    name: 'Nilesh',
    createdAt: '2026-10-12T10:00:00Z',
  };

  it('parses a valid free-plan user', () => {
    const user = userSchema.parse({ ...base, plan: 'free' });
    expect(user.plan).toBe('free');
  });

  it('parses every plan tier', () => {
    for (const plan of ['free', 'pro', 'studio', 'max'] as const) {
      expect(userSchema.parse({ ...base, plan }).plan).toBe(plan);
    }
  });

  it('rejects a bad email', () => {
    expect(() => userSchema.parse({ ...base, plan: 'free', email: 'nope' })).toThrow();
  });

  it('rejects an unknown plan', () => {
    expect(() =>
      userSchema.parse({ ...base, plan: 'enterprise' as UserPlan }),
    ).toThrow();
  });

  it('carries the User type', () => {
    const user: User = userSchema.parse({ ...base, plan: 'free' });
    const plan: UserPlan = user.plan;
    expect(plan).toBe('free');
  });
});

describe('userPlanSchema', () => {
  it('exposes the four plans', () => {
    expect(userPlanSchema.options).toEqual(['free', 'pro', 'studio', 'max']);
  });
});

describe('jobStatusEventSchema', () => {
  it('parses all four states', () => {
    for (const state of ['queued', 'rendering', 'done', 'failed'] as const) {
      const event = jobStatusEventSchema.parse({ state });
      expect(event.state).toBe(state);
    }
  });

  it('accepts optional panelId and error', () => {
    const event = jobStatusEventSchema.parse({
      state: 'failed',
      panelId: 'pnl_1',
      error: 'boom',
    });
    expect(event.panelId).toBe('pnl_1');
    expect(event.error).toBe('boom');
  });

  it('rejects an unknown state', () => {
    expect(() => jobStatusEventSchema.parse({ state: 'waiting' })).toThrow();
  });

  it('exposes the JobState enum', () => {
    expect(jobStateSchema.options).toEqual([
      'queued',
      'rendering',
      'done',
      'failed',
    ]);
  });

  it('carries the JobStatusEvent type', () => {
    const event: JobStatusEvent = { state: 'queued' as JobState };
    expect(event.state).toBe('queued');
  });
});
