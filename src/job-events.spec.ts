import { describe, expect, it } from 'vitest';
import {
  chapterRenderEventSchema,
  jobEventSchema,
  panelRenderEventSchema,
  scriptParseEventSchema,
} from './job-events.js';
import type { ChapterRenderEvent, JobEvent, PanelRenderEvent, ScriptParseEvent } from './job-events.js';

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
    expect(jobEventSchema.safeParse({ ...queued, kind: 'panel_upscale' }).success).toBe(false);
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

const RUN_ID = '3f2b8c1e-9a4d-4f6b-8c2a-1d5e7f9a0b3c';

const panelEvent: PanelRenderEvent = {
  kind: 'panel_render',
  projectId: '64b7f0c2a1b2c3d4e5f60700',
  chapterId: '64b7f0c2a1b2c3d4e5f60701',
  runId: RUN_ID,
  panelId: '00000000-0000-4000-8000-000000000007',
  attemptId: '64b7f0c2a1b2c3d4e5f60730',
  status: 'rendering',
};

const chapterEvent: ChapterRenderEvent = {
  kind: 'chapter_render',
  projectId: '64b7f0c2a1b2c3d4e5f60700',
  chapterId: '64b7f0c2a1b2c3d4e5f60701',
  runId: RUN_ID,
  state: 'partial',
  counts: { total: 14, rendered: 13, failed: 1, notRendered: 0, active: 0 },
  providerHealthy: true,
};

describe('panelRenderEventSchema', () => {
  it('parses claim, settle and cancel events through the union', () => {
    expect(jobEventSchema.parse(panelEvent)).toEqual(panelEvent);
    const failed: JobEvent = { ...panelEvent, status: 'failed', errorCode: 'CONTENT_BLOCKED' };
    expect(jobEventSchema.parse(failed)).toEqual(failed);
    const canceled: JobEvent = { ...panelEvent, status: 'canceled', errorCode: 'CANCELED' };
    expect(panelRenderEventSchema.parse(canceled)).toEqual(canceled);
  });

  it('rejects an unknown status or error code and a malformed attempt id', () => {
    expect(jobEventSchema.safeParse({ ...panelEvent, status: 'done' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...panelEvent, errorCode: 'CHAPTER_GONE' }).success).toBe(false);
    expect(jobEventSchema.safeParse({ ...panelEvent, attemptId: RUN_ID }).success).toBe(false);
  });
});

describe('chapterRenderEventSchema', () => {
  it('parses a run state change with its counts and the provider health', () => {
    expect(jobEventSchema.parse(chapterEvent)).toEqual(chapterEvent);
    const outage: JobEvent = { ...chapterEvent, state: 'rendering', providerHealthy: false };
    expect(chapterRenderEventSchema.parse(outage)).toEqual(outage);
  });

  it('requires the counts and the provider health', () => {
    const { providerHealthy: _, ...noHealth } = chapterEvent;
    expect(jobEventSchema.safeParse(noHealth).success).toBe(false);
    const { counts: __, ...noCounts } = chapterEvent;
    expect(jobEventSchema.safeParse(noCounts).success).toBe(false);
  });
});

describe('jobEventSchema', () => {
  it('discriminates the three kinds', () => {
    expect([queued, panelEvent, chapterEvent].map((e) => jobEventSchema.parse(e).kind)).toEqual([
      'script_parse', 'panel_render', 'chapter_render',
    ]);
  });
});
