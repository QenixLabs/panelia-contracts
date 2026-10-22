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
  panelPlanSchemaFor,
  panelSchema,
  planTierSchema,
  refKey,
  sceneCastSchema,
  sceneSchema,
  shotTypeSchema,
} from './chapter.js';
import type { CastRef, DialogueLine, Panel, PanelPlanInput, Scene, SceneCast } from './chapter.js';
import type { ProjectFormat } from './project.js';

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

// ---------- panelPlanSchemaFor ----------

// The path of every issue; [] when the plan is valid.
function issuePaths(format: ProjectFormat, input: unknown): PropertyKey[][] {
  const result = panelPlanSchemaFor(format).safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

// n distinct unnamed extras.
const extras = (n: number): CastRef[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Bystander ${i + 1}`, extra: true }));

describe('panelPlanSchemaFor: caps', () => {
  it('accepts a valid plan in every format', () => {
    expect(issuePaths('manga', plan(scene(), scene()))).toEqual([]);
    expect(issuePaths('manhwa', plan(scene()))).toEqual([]);
    expect(issuePaths('4koma', plan(strip(), strip()))).toEqual([]);
  });

  it('caps the plan at 60 panels in total', () => {
    const sixty = plan(scene({ panels: panels(30) }), scene({ panels: panels(30) }));
    expect(issuePaths('manga', sixty)).toEqual([]);
    const sixtyOne = plan(scene({ panels: panels(30) }), scene({ panels: panels(31) }));
    expect(panelPlanSchemaFor('manga').safeParse(sixtyOne).error?.issues).toEqual([
      expect.objectContaining({
        code: 'custom',
        path: ['scenes'],
        message: 'Plans hold up to 60 panels',
      }),
    ]);
  });

  it('caps the plan at 30 scenes', () => {
    const scenes = (n: number) => Array.from({ length: n }, () => scene());
    expect(issuePaths('manga', plan(...scenes(30)))).toEqual([]);
    expect(issuePaths('manga', plan(...scenes(31)))).toEqual([['scenes']]);
  });

  it('caps a scene at 40 panels', () => {
    expect(issuePaths('manga', plan(scene({ panels: panels(40) })))).toEqual([]);
    expect(issuePaths('manga', plan(scene({ panels: panels(41) })))).toEqual([['scenes', 0, 'panels']]);
  });

  it('caps a panel at 8 dialogue lines', () => {
    const withLines = (n: number) =>
      plan(scene({ panels: [panel({ dialogue: Array.from({ length: n }, () => line()) })] }));
    expect(issuePaths('manga', withLines(8))).toEqual([]);
    expect(issuePaths('manga', withLines(9))).toEqual([['scenes', 0, 'panels', 0, 'dialogue']]);
  });

  it('caps a panel cast at 8', () => {
    const withPanelCast = (n: number) => {
      const refs = extras(n);
      return plan(scene({ cast: refs.map(castOf), panels: [panel({ cast: refs, dialogue: [] })] }));
    };
    expect(issuePaths('manga', withPanelCast(8))).toEqual([]);
    expect(issuePaths('manga', withPanelCast(9))).toEqual([['scenes', 0, 'panels', 0, 'cast']]);
  });

  it('caps a scene cast at 12', () => {
    const withSceneCast = (n: number) =>
      plan(scene({ cast: extras(n).map(castOf), panels: [panel({ cast: [], dialogue: [] })] }));
    expect(issuePaths('manga', withSceneCast(12))).toEqual([]);
    expect(issuePaths('manga', withSceneCast(13))).toEqual([['scenes', 0, 'cast']]);
  });

  it('runs the cross-field rules only on a well-typed plan', () => {
    const malformed = { tier: 'draft', scenes: [{ ...scene(), panels: 'not an array' }] };
    expect(() => panelPlanSchemaFor('manga').safeParse(malformed)).not.toThrow();
    expect(issuePaths('manga', malformed)).toEqual([['scenes', 0, 'panels']]);
  });

  it('leaves panelPlanInputSchema itself without cross-field rules', () => {
    const sixtyOne = plan(scene({ panels: panels(30) }), scene({ panels: panels(31) }));
    expect(panelPlanInputSchema.safeParse(sixtyOne).success).toBe(true);
  });
});

describe('panelPlanSchemaFor: unique ids', () => {
  it('flags a panel id reused in another scene', () => {
    const first = scene();
    const second = scene({ panels: [panel({ id: first.panels[0]!.id })] });
    expect(issuePaths('manga', plan(first, second))).toEqual([['scenes', 1, 'panels', 0, 'id']]);
  });

  it('flags a dialogue line id reused in another panel', () => {
    const first = panel();
    const second = panel({ dialogue: [line({ id: first.dialogue[0]!.id })] });
    expect(issuePaths('manga', plan(scene({ panels: [first, second] })))).toEqual([
      ['scenes', 0, 'panels', 1, 'dialogue', 0, 'id'],
    ]);
  });

  it('flags a panel that reuses its scene id', () => {
    const id = uid();
    expect(issuePaths('manga', plan(scene({ id, panels: [panel({ id })] })))).toEqual([
      ['scenes', 0, 'panels', 0, 'id'],
    ]);
  });
});

describe('panelPlanSchemaFor: scene cast', () => {
  it('flags a character listed twice in one scene', () => {
    expect(issuePaths('manga', plan(scene({ cast: [castOf(aoi), castOf(aoi)] })))).toEqual([
      ['scenes', 0, 'cast', 1, 'ref'],
    ]);
  });

  it('flags names that match after trimming and case-folding, extra or not', () => {
    const cast = [castOf(aoi), castOf(kaito), castOf({ name: ' KAITO ', extra: true })];
    expect(issuePaths('manga', plan(scene({ cast })))).toEqual([['scenes', 0, 'cast', 2, 'ref']]);
  });

  it('allows the same character in different scenes', () => {
    expect(issuePaths('manga', plan(scene(), scene()))).toEqual([]);
  });

  it('allows an outfit on a character ref but not on a name ref', () => {
    const withOutfit = scene({ cast: [{ ref: aoi, outfitId: 'out_1', notes: 'Bandaged left arm' }] });
    expect(issuePaths('manga', plan(withOutfit))).toEqual([]);
    const nameWithOutfit = scene({ cast: [castOf(aoi), { ref: kaito, outfitId: 'out_2', notes: '' }] });
    expect(issuePaths('manga', plan(nameWithOutfit))).toEqual([['scenes', 0, 'cast', 1, 'outfitId']]);
  });
});

describe('panelPlanSchemaFor: closure', () => {
  it('flags a panel cast member missing from the scene cast', () => {
    const s = scene({ panels: [panel({ cast: [aoi, ren] })] });
    expect(issuePaths('manga', plan(s))).toEqual([['scenes', 0, 'panels', 0, 'cast', 1]]);
  });

  it('flags a speaker missing from the scene cast', () => {
    const s = scene({ panels: [panel({ dialogue: [line({ speaker: ren })] })] });
    expect(issuePaths('manga', plan(s))).toEqual([['scenes', 0, 'panels', 0, 'dialogue', 0, 'speaker']]);
  });

  it('matches refs by refKey', () => {
    const s = scene({
      cast: [castOf(aoi), castOf(kaito)],
      panels: [panel({ cast: [aoi, { name: 'KAITO', extra: false }] })],
    });
    expect(issuePaths('manga', plan(s))).toEqual([]);
  });

  it('allows an off-panel speaker who is in the scene cast', () => {
    const s = scene({
      cast: [castOf(aoi), castOf(ren)],
      panels: [panel({ cast: [aoi], dialogue: [line({ speaker: ren })] })],
    });
    expect(issuePaths('manga', plan(s))).toEqual([]);
  });
});

describe('panelPlanSchemaFor: speakers', () => {
  it('flags a caption or a sound effect with a speaker', () => {
    const dialogue = [line({ kind: 'caption', speaker: aoi }), line({ kind: 'sfx', speaker: aoi })];
    expect(issuePaths('manga', plan(scene({ panels: [panel({ dialogue })] })))).toEqual([
      ['scenes', 0, 'panels', 0, 'dialogue', 0, 'speaker'],
      ['scenes', 0, 'panels', 0, 'dialogue', 1, 'speaker'],
    ]);
  });

  it('accepts captions and sound effects without a speaker, and speech from an unknown voice', () => {
    const dialogue = [
      line({ kind: 'caption', speaker: null, text: 'Three days later.' }),
      line({ kind: 'sfx', speaker: null, text: 'KRAK' }),
      line({ kind: 'speech', speaker: null, text: 'Who goes there?' }),
      line({ kind: 'thought', speaker: aoi, text: 'Not again.' }),
    ];
    expect(issuePaths('manga', plan(scene({ panels: [panel({ dialogue })] })))).toEqual([]);
  });
});

describe('panelPlanSchemaFor: 4-koma', () => {
  it('accepts strips of exactly 4 panels with beat labels', () => {
    const custom = strip({ beatLabels: ['Ask', 'Wait', 'Twist', 'Laugh'] });
    expect(issuePaths('4koma', plan(strip(), custom))).toEqual([]);
  });

  it('flags a strip with 3 or 5 panels', () => {
    const p = plan(strip({ panels: panels(3) }), strip({ panels: panels(5) }));
    expect(issuePaths('4koma', p)).toEqual([
      ['scenes', 0, 'panels'],
      ['scenes', 1, 'panels'],
    ]);
  });

  it('flags a strip without beat labels', () => {
    const p = plan(strip({ beatLabels: null }));
    expect(issuePaths('4koma', p)).toEqual([['scenes', 0, 'beatLabels']]);
  });

  it('caps a 4-koma plan at 15 strips (60 panels)', () => {
    const strips = (n: number) => Array.from({ length: n }, () => strip());
    expect(issuePaths('4koma', plan(...strips(15)))).toEqual([]);
    expect(issuePaths('4koma', plan(...strips(16)))).toEqual([['scenes']]);
  });

  it('requires beatLabels: null in manga and manhwa', () => {
    expect(issuePaths('manga', plan(strip()))).toEqual([['scenes', 0, 'beatLabels']]);
    expect(issuePaths('manhwa', plan(scene(), strip()))).toEqual([['scenes', 1, 'beatLabels']]);
  });
});
