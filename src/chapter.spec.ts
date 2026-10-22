import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEAT_LABELS,
  PLAN_LIMITS,
  castRefSchema,
  countPanels,
  dialogueKindSchema,
  dialogueLineSchema,
  panelPlanInputSchema,
  panelPlanSchema,
  panelSchema,
  planTierSchema,
  refKey,
  sceneCastSchema,
  sceneSchema,
  shotTypeSchema,
} from './chapter.js';
import type { CastRef, DialogueLine, Panel, PanelPlanInput, Scene, SceneCast } from './chapter.js';

// ---------- fixtures ----------

const AOI = '64b7f0c2a1b2c3d4e5f60718';
const REN = '64b7f0c2a1b2c3d4e5f60719';
const aoi: CastRef = { characterId: AOI };
const ren: CastRef = { characterId: REN };
const kaito: CastRef = { name: 'Kaito', extra: false }; // unresolved name
const crowd: CastRef = { name: 'Crowd', extra: true }; // unnamed background people

let nextId = 1;
// z.uuid() checks the version and variant nibbles, so mint well-formed v4 ids.
const uid = () => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

const castOf = (ref: CastRef): SceneCast => ({ ref, outfitId: null, notes: '' });

function line(over: Partial<DialogueLine> = {}): DialogueLine {
  return { id: uid(), kind: 'speech', speaker: aoi, text: 'We have to move. Now.', ...over };
}

function panel(over: Partial<Panel> = {}): Panel {
  return {
    id: uid(),
    shot: 'medium',
    subject: 'Aoi at the rooftop door',
    cast: [aoi],
    action: 'Aoi shoulders the door open and steps into the wind.',
    mood: 'tense',
    dialogue: [line()],
    ...over,
  };
}

const panels = (n: number): Panel[] => Array.from({ length: n }, () => panel());

// A manga or manhwa scene: Aoi in the cast, one panel, no beat labels.
function scene(over: Partial<Scene> = {}): Scene {
  return {
    id: uid(),
    heading: 'The Rooftop',
    location: 'School rooftop, dusk',
    cast: [castOf(aoi)],
    beatLabels: null,
    panels: [panel()],
    ...over,
  };
}

// A 4-koma strip: exactly 4 panels and the default beat labels.
function strip(over: Partial<Scene> = {}): Scene {
  return scene({ beatLabels: [...DEFAULT_BEAT_LABELS], panels: panels(4), ...over });
}

function plan(...scenes: Scene[]): PanelPlanInput {
  return { tier: 'draft', scenes: scenes.length > 0 ? scenes : [scene()] };
}

// ---------- building blocks ----------

describe('plan enums and limits', () => {
  it('exposes shot types, dialogue kinds and tiers', () => {
    expect(shotTypeSchema.options).toEqual([
      'establishing', 'wide', 'medium', 'close_up',
      'extreme_close_up', 'over_shoulder', 'pov', 'insert',
    ]);
    expect(dialogueKindSchema.options).toEqual(['speech', 'thought', 'caption', 'sfx']);
    expect(planTierSchema.options).toEqual(['draft', 'hq']);
  });

  it('pins the plan limits and the default beat labels', () => {
    expect(PLAN_LIMITS).toEqual({
      scenes: 30, panels: 60, panelsPerScene: 40, dialogueLines: 8, panelCast: 8, sceneCast: 12,
    });
    expect(DEFAULT_BEAT_LABELS).toEqual(['Setup', 'Development', 'Turn', 'Punchline']);
  });
});

describe('castRefSchema', () => {
  const ok = (input: unknown) => castRefSchema.safeParse(input).success;

  it('accepts a roster character ref', () => {
    expect(castRefSchema.parse(aoi)).toEqual(aoi);
  });

  it('accepts an unresolved name and an extra, trimming the name', () => {
    expect(castRefSchema.parse({ name: '  Kaito ', extra: false })).toEqual(kaito);
    expect(castRefSchema.parse(crowd)).toEqual(crowd);
  });

  it('rejects a character id that is not a Mongo id', () => {
    expect(ok({ characterId: 'chr_1' })).toBe(false);
  });

  it('rejects a ref that mixes both shapes', () => {
    expect(ok({ characterId: AOI, name: 'Aoi', extra: false })).toBe(false);
  });

  it('rejects a blank name, a missing extra flag and a name over 80 chars', () => {
    expect(ok({ name: '   ', extra: false })).toBe(false);
    expect(ok({ name: 'Kaito' })).toBe(false);
    expect(ok({ name: 'K'.repeat(80), extra: true })).toBe(true);
    expect(ok({ name: 'K'.repeat(81), extra: true })).toBe(false);
  });
});

describe('refKey', () => {
  it('keys a character ref by its id', () => {
    expect(refKey(aoi)).toBe(`c:${AOI}`);
    expect(refKey(ren)).not.toBe(refKey(aoi));
  });

  it('keys a name case-insensitively and ignores the extra flag', () => {
    expect(refKey({ name: ' Kaito ', extra: false })).toBe('n:kaito');
    expect(refKey({ name: 'KAITO', extra: true })).toBe('n:kaito');
  });
});

describe('dialogueLineSchema / panelSchema', () => {
  it('round-trips a panel with a speech line', () => {
    const p = panel();
    expect(panelSchema.parse(p)).toEqual(p);
  });

  it('rejects an unknown shot type and dialogue kind', () => {
    expect(panelSchema.safeParse({ ...panel(), shot: 'dutch_angle' }).success).toBe(false);
    expect(dialogueLineSchema.safeParse({ ...line(), kind: 'whisper' }).success).toBe(false);
  });

  it('rejects panel and line ids that are not uuids', () => {
    expect(panelSchema.safeParse(panel({ id: 'p1' })).success).toBe(false);
    expect(dialogueLineSchema.safeParse(line({ id: 'l1' })).success).toBe(false);
  });

  it('caps text fields at their limits', () => {
    const ok = (over: Partial<Panel>) => panelSchema.safeParse(panel(over)).success;
    expect(ok({ subject: 's'.repeat(200) })).toBe(true);
    expect(ok({ subject: 's'.repeat(201) })).toBe(false);
    expect(ok({ action: 'a'.repeat(1000) })).toBe(true);
    expect(ok({ action: 'a'.repeat(1001) })).toBe(false);
    expect(ok({ mood: 'm'.repeat(80) })).toBe(true);
    expect(ok({ mood: 'm'.repeat(81) })).toBe(false);
    expect(ok({ dialogue: [line({ text: 't'.repeat(300) })] })).toBe(true);
    expect(ok({ dialogue: [line({ text: 't'.repeat(301) })] })).toBe(false);
  });
});

describe('sceneSchema', () => {
  const ok = (input: unknown) => sceneSchema.safeParse(input).success;

  it('round-trips a scene whose cast entry has an outfit and notes', () => {
    const s = scene({ cast: [{ ref: aoi, outfitId: 'out_1', notes: 'Bandaged left arm' }] });
    expect(sceneSchema.parse(s)).toEqual(s);
  });

  it('accepts four beat labels of up to 40 chars', () => {
    const s = strip();
    expect(sceneSchema.parse(s)).toEqual(s);
    expect(ok(strip({ beatLabels: ['Setup', 'Development', 'Turn', 'x'.repeat(40)] }))).toBe(true);
    expect(ok(strip({ beatLabels: ['Setup', 'Development', 'Turn', 'x'.repeat(41)] }))).toBe(false);
  });

  it('caps heading, location and cast notes', () => {
    expect(ok(scene({ heading: 'h'.repeat(120), location: 'l'.repeat(120) }))).toBe(true);
    expect(ok(scene({ heading: 'h'.repeat(121) }))).toBe(false);
    expect(ok(scene({ location: 'l'.repeat(121) }))).toBe(false);
    const notes = (n: number) =>
      sceneCastSchema.safeParse({ ref: aoi, outfitId: null, notes: 'n'.repeat(n) }).success;
    expect(notes(200)).toBe(true);
    expect(notes(201)).toBe(false);
  });

  it('rejects beat labels that are not exactly four', () => {
    expect(ok({ ...strip(), beatLabels: ['Setup', 'Development', 'Turn'] })).toBe(false);
  });

  it('needs at least one panel', () => {
    expect(ok(scene({ panels: [] }))).toBe(false);
  });
});

describe('panelPlanInputSchema / panelPlanSchema', () => {
  it('round-trips a plan, and the stored plan adds a positive revision', () => {
    const p = plan(scene(), scene());
    expect(panelPlanInputSchema.parse(p)).toEqual(p);
    expect(panelPlanSchema.parse({ ...p, revision: 1 })).toEqual({ ...p, revision: 1 });
    expect(panelPlanSchema.safeParse({ ...p, revision: 0 }).success).toBe(false);
  });

  it('needs at least one scene and a known tier', () => {
    expect(panelPlanInputSchema.safeParse({ tier: 'draft', scenes: [] }).success).toBe(false);
    expect(panelPlanInputSchema.safeParse({ ...plan(), tier: 'ultra' }).success).toBe(false);
  });
});

describe('countPanels', () => {
  it('sums panels across scenes', () => {
    expect(countPanels(plan(scene({ panels: panels(3) }), scene({ panels: panels(4) })))).toBe(7);
  });

  it('is 0 for a plan with no scenes', () => {
    expect(countPanels({ scenes: [] })).toBe(0);
  });
});
