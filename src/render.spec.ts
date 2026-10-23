import { describe, expect, it, vi } from 'vitest';
import type { PanelPlanInput } from './chapter.js';
import { autoLayout } from './layout.js';
import {
  ACTIVE_RUN_STATES,
  MAX_BLOCKED_ATTEMPTS,
  chapterRenderSchema,
  isRunActive,
  moderationReasonSchema,
  panelRenderSchema,
  renderAttemptStatusSchema,
  renderCountsSchema,
  renderErrorCodeSchema,
  renderImageSchema,
  renderRunSchema,
  renderRunStateSchema,
  retryRenderInputSchema,
} from './render.js';
import type {
  ChapterRender,
  PanelRender,
  RenderCounts,
  RenderImage,
  RenderRun,
  RenderRunState,
  RetryRenderInput,
} from './render.js';

// ---------- fixtures ----------

const RUN_ID = '3f2b8c1e-9a4d-4f6b-8c2a-1d5e7f9a0b3c';
const KEY = '9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d';
const PANEL = '00000000-0000-4000-8000-000000000001';
const ATTEMPT = '64b7f0c2a1b2c3d4e5f60730';
const AT = '2026-10-23T09:30:00.000Z';
const LATER = '2026-10-23T09:31:10.000Z';

const counts: RenderCounts = { total: 14, rendered: 9, failed: 1, notRendered: 0, active: 4 };

function run(over: Partial<RenderRun> = {}): RenderRun {
  return {
    runId: RUN_ID,
    state: 'rendering',
    tier: 'draft',
    counts,
    credits: { charged: 45, reserved: 20, released: 5 },
    providerHealthy: true,
    startedAt: AT,
    finishedAt: null,
    ...over,
  };
}

const image: RenderImage = {
  thumbUrl: 'https://cdn.example.com/u/1/thumb.webp?Expires=1761215400&Signature=abc&Key-Pair-Id=K1',
  previewUrl: 'https://cdn.example.com/u/1/preview.webp?Expires=1761215400&Signature=abc&Key-Pair-Id=K1',
  fullUrl: 'https://cdn.example.com/u/1/original.png?Expires=1761215400&Signature=abc&Key-Pair-Id=K1',
  width: 1024,
  height: 1280,
  expiresAt: '2026-10-23T10:30:00.000Z',
};

function panelRender(over: Partial<PanelRender> = {}): PanelRender {
  return {
    panelId: PANEL,
    attemptId: ATTEMPT,
    seq: 1,
    status: 'rendered',
    credits: 5,
    errorCode: null,
    blockedAttempts: 0,
    image,
    queuedAt: AT,
    startedAt: AT,
    finishedAt: LATER,
    ...over,
  };
}

// ---------- module graph ----------

describe('render.ts in the module graph', () => {
  it('loads first in a fresh module graph (it never imports chapter.ts)', async () => {
    vi.resetModules();
    const fresh = await import('./render.js');
    expect(fresh.renderRunSchema.parse(run())).toEqual(run());
    expect(fresh.retryRenderInputSchema.safeParse({ idempotencyKey: KEY, panelIds: [PANEL] }).success).toBe(true);
  });
});

// ---------- enums and constants ----------

describe('render enums', () => {
  it('lists the run states, attempt statuses, error codes and moderation reasons', () => {
    expect(renderRunStateSchema.options).toEqual([
      'queued', 'rendering', 'stopping', 'done', 'partial', 'stopped', 'stalled',
    ]);
    expect(renderAttemptStatusSchema.options).toEqual(['queued', 'rendering', 'rendered', 'failed', 'canceled']);
    expect(renderErrorCodeSchema.options).toEqual([
      'PROVIDER_ERROR', 'PROVIDER_UNAVAILABLE', 'TIMEOUT', 'CONTENT_BLOCKED',
      'NSFW_FLAGGED', 'REFS_UNAVAILABLE', 'CANCELED',
    ]);
    expect(moderationReasonSchema.options).toEqual([
      'sexual', 'sexual_minors', 'graphic_violence', 'self_harm', 'hate', 'violent_wrongdoing', 'artist_style',
    ]);
  });

  it('never exposes the server-only CHAPTER_GONE code', () => {
    expect(renderErrorCodeSchema.safeParse('CHAPTER_GONE').success).toBe(false);
  });

  it('allows 2 safety blocks per panel', () => {
    expect(MAX_BLOCKED_ATTEMPTS).toBe(2);
  });
});

describe('ACTIVE_RUN_STATES / isRunActive', () => {
  it('treats queued, rendering and stopping as active', () => {
    expect(ACTIVE_RUN_STATES).toEqual(['queued', 'rendering', 'stopping']);
    const active = renderRunStateSchema.options.filter((state) => isRunActive(state));
    expect(active).toEqual(['queued', 'rendering', 'stopping']);
  });

  it('treats finished and stalled runs, and no run, as inactive', () => {
    const inactive: Array<RenderRunState | null | undefined> = ['done', 'partial', 'stopped', 'stalled', null, undefined];
    for (const state of inactive) expect(isRunActive(state)).toBe(false);
  });
});

// ---------- run, image, panel ----------

describe('renderCountsSchema', () => {
  it('round-trips counts and rejects negative or fractional ones', () => {
    expect(renderCountsSchema.parse(counts)).toEqual(counts);
    expect(renderCountsSchema.safeParse({ ...counts, active: -1 }).success).toBe(false);
    expect(renderCountsSchema.safeParse({ ...counts, rendered: 1.5 }).success).toBe(false);
    expect(renderCountsSchema.safeParse({ ...counts, notRendered: undefined }).success).toBe(false);
  });
});

describe('renderRunSchema', () => {
  it('round-trips an active run and a finished one', () => {
    expect(renderRunSchema.parse(run())).toEqual(run());
    const done = run({ state: 'partial', finishedAt: LATER, providerHealthy: false });
    expect(renderRunSchema.parse(done)).toEqual(done);
  });

  it('rejects an unknown state or tier, a malformed run id, fractional credits and a missing health flag', () => {
    const ok = (input: unknown) => renderRunSchema.safeParse(input).success;
    expect(ok({ ...run(), state: 'paused' })).toBe(false);
    expect(ok({ ...run(), tier: 'ultra' })).toBe(false);
    expect(ok({ ...run(), runId: 'run-1' })).toBe(false);
    expect(ok({ ...run(), credits: { charged: 4.5, reserved: 20, released: 5 } })).toBe(false);
    const { providerHealthy: _, ...unhealthy } = run();
    expect(ok(unhealthy)).toBe(false);
  });
});

describe('renderImageSchema', () => {
  it('round-trips signed CloudFront URLs and accepts data URLs (MSW placeholders)', () => {
    expect(renderImageSchema.parse(image)).toEqual(image);
    const svg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
    const placeholder = { ...image, thumbUrl: svg, previewUrl: svg, fullUrl: svg };
    expect(renderImageSchema.parse(placeholder)).toEqual(placeholder);
  });

  it('rejects a relative URL and an empty size', () => {
    expect(renderImageSchema.safeParse({ ...image, thumbUrl: '/thumb.webp' }).success).toBe(false);
    expect(renderImageSchema.safeParse({ ...image, width: 0 }).success).toBe(false);
  });
});

describe('panelRenderSchema', () => {
  it('round-trips a rendered, a failed and a queued attempt', () => {
    const rendered = panelRender();
    const failed = panelRender({ status: 'failed', errorCode: 'NSFW_FLAGGED', blockedAttempts: 1, image: null });
    const queued = panelRender({
      status: 'queued', seq: 2, image: null, startedAt: null, finishedAt: null,
    });
    for (const p of [rendered, failed, queued]) expect(panelRenderSchema.parse(p)).toEqual(p);
  });

  it('rejects seq 0, zero credits, a non-ObjectId attempt id and an unknown error code', () => {
    const ok = (over: Partial<PanelRender>) => panelRenderSchema.safeParse(panelRender(over)).success;
    expect(ok({ seq: 0 })).toBe(false);
    expect(ok({ credits: 0 })).toBe(false);
    expect(ok({ attemptId: RUN_ID })).toBe(false);
    expect(ok({ errorCode: 'CHAPTER_GONE' as PanelRender['errorCode'] })).toBe(false);
  });
});

describe('chapterRenderSchema', () => {
  it('parses an approved chapter that has no run yet', () => {
    const empty: ChapterRender = { run: null, layout: null, panels: [] };
    expect(chapterRenderSchema.parse(empty)).toEqual(empty);
  });

  it('parses a run with its autoLayout layout and the latest attempt per panel', () => {
    const plan: PanelPlanInput = {
      tier: 'draft',
      scenes: [
        {
          id: '00000000-0000-4000-8000-0000000000aa',
          heading: 'The Rooftop',
          location: 'School rooftop, dusk',
          cast: [],
          beatLabels: null,
          panels: [
            { id: PANEL, shot: 'medium', subject: 'Aoi', cast: [], action: 'Aoi waits.', mood: 'tense', dialogue: [] },
          ],
        },
      ],
    };
    const render: ChapterRender = {
      run: run(),
      layout: { revision: 1, ...autoLayout(plan, 'manga', null) },
      panels: [panelRender()],
    };
    expect(chapterRenderSchema.parse(render)).toEqual(render);
  });
});

describe('retryRenderInputSchema', () => {
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);

  it('accepts 1 to 60 panel ids with an idempotency key', () => {
    const input: RetryRenderInput = { idempotencyKey: KEY, panelIds: ids(1) };
    expect(retryRenderInputSchema.parse(input)).toEqual(input);
    expect(retryRenderInputSchema.safeParse({ idempotencyKey: KEY, panelIds: ids(60) }).success).toBe(true);
  });

  it('rejects no ids, 61 ids, a malformed id or key, and unknown keys', () => {
    const ok = (input: unknown) => retryRenderInputSchema.safeParse(input).success;
    expect(ok({ idempotencyKey: KEY, panelIds: [] })).toBe(false);
    expect(ok({ idempotencyKey: KEY, panelIds: ids(61) })).toBe(false);
    expect(ok({ idempotencyKey: KEY, panelIds: ['p7'] })).toBe(false);
    expect(ok({ idempotencyKey: 'retry-1', panelIds: ids(1) })).toBe(false);
    expect(ok({ idempotencyKey: KEY, panelIds: ids(1), tier: 'hq' })).toBe(false);
  });
});
