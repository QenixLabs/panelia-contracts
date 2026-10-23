import { describe, expect, it } from 'vitest';
import { jobEventSchema, scriptParseEventSchema } from './job-events.js';
import type { JobEvent, ScriptParseEvent } from './job-events.js';

const queued: ScriptParseEvent = {
  kind: 'script_parse',
  jobId: '3f2b8c1e-9a4d-4f6b-8c2a-1d5e7f9a0b3c',
  projectId: '64b7f0c2a1b2c3d4e5f60700',
  chapterId: '64b7f0c2a1b2c3d4e5f60701',
  state: 'queued',
};

describe('jobEventSchema', () => {
  it('parses queued and running script-parse events', () => {
    expect(jobEventSchema.parse(queued)).toEqual(queued);
    expect(scriptParseEventSchema.parse({ ...queued, state: 'running' }).state).toBe('running');
  });

  it('carries the new revision when done and the failure code when failed', () => {
    const done: JobEvent = { ...queued, state: 'done', revision: 3 };
    expect(jobEventSchema.parse(done)).toEqual(done);
    const failed: JobEvent = { ...queued, state: 'failed', code: 'AI_UNAVAILABLE' };
    expect(jobEventSchema.parse(failed)).toEqual(failed);
  });

  it('rejects an unknown kind', () => {
    expect(jobEventSchema.safeParse({ ...queued, kind: 'panel_render' }).success).toBe(false);
  });

  it('rejects malformed ids', () => {
    expect(jobEventSchema.safeParse({ ...queued, jobId: '42' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...queued, projectId: 'p_ashfall' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...queued, chapterId: 'ch_1' }).success).toBe(false);
  });

  it('rejects an unknown failure code, the old render state and revision 0', () => {
    expect(jobEventSchema.safeParse({ ...queued, state: 'failed', code: 'BOOM' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...queued, state: 'rendering' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...queued, state: 'done', revision: 0 }).success).toBe(false);
  });
});
