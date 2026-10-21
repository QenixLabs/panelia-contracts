import { describe, expect, it } from 'vitest';
import {
  TRAIT_KEYS,
  characterListSchema,
  characterRoleSchema,
  characterSchema,
  createCharacterInputSchema,
  updateCharacterInputSchema,
} from './character.js';
import type { Character, CharacterTraits } from './character.js';

const emptyTraits = Object.fromEntries(
  TRAIT_KEYS.map((k) => [k, { value: '', locked: false }]),
) as CharacterTraits;

const character: Character = {
  id: 'chr_1',
  projectId: 'prj_1',
  name: 'Ren Kurosawa',
  role: 'protagonist',
  traits: { ...emptyTraits, hair: { value: 'black, spiky', locked: true } },
  outfits: [
    { id: 'out_1', name: 'School uniform', description: 'Navy blazer', isDefault: true },
  ],
  references: [],
  createdAt: '2026-10-21T10:00:00Z',
  updatedAt: '2026-10-21T10:00:00Z',
};

describe('traits', () => {
  it('has the 8 fixed CH-01 trait keys in display order', () => {
    expect(TRAIT_KEYS).toEqual([
      'ageRange', 'build', 'hair', 'eyes', 'face', 'skinTone', 'identifyingMarks', 'personality',
    ]);
  });
});

describe('characterSchema', () => {
  it('round-trips a character', () => {
    expect(characterSchema.parse(character)).toEqual(character);
  });

  it('rejects a trait value over 200 chars', () => {
    expect(() =>
      characterSchema.parse({
        ...character,
        traits: { ...character.traits, hair: { value: 'x'.repeat(201), locked: false } },
      }),
    ).toThrow();
  });

  it('rejects two default outfits', () => {
    const o = character.outfits[0]!;
    expect(() =>
      characterSchema.parse({ ...character, outfits: [o, { ...o, id: 'out_2' }] }),
    ).toThrow();
  });

  it('rejects more than 20 references (valid assets, count only)', () => {
    const ref = {
      id: 'ast_1', projectId: 'prj_1', kind: 'character_ref', contentType: 'image/png',
      sizeBytes: 1024, status: 'ready', url: null,
      rights: { basis: 'own_work', attestedAt: '2026-10-21T10:00:00Z', reviewStatus: 'unreviewed' },
      createdAt: '2026-10-21T10:00:00Z',
    };
    expect(characterSchema.safeParse({ ...character, references: new Array(20).fill(ref) }).success).toBe(true);
    expect(characterSchema.safeParse({ ...character, references: new Array(21).fill(ref) }).success).toBe(false);
  });
});

describe('characterListSchema', () => {
  it('parses summaries', () => {
    const list = characterListSchema.parse({
      items: [{ id: 'chr_1', name: 'Ren', role: 'protagonist', thumbnailUrl: null, referenceCount: 0 }],
      total: 1,
    });
    expect(list.items[0]?.referenceCount).toBe(0);
  });
});

describe('createCharacterInputSchema', () => {
  it('defaults role to supporting', () => {
    expect(createCharacterInputSchema.parse({ name: 'Aiko' }).role).toBe('supporting');
  });

  it('rejects blank name', () => {
    expect(() => createCharacterInputSchema.parse({ name: '  ' })).toThrow();
  });

  it('roles enum', () => {
    expect(characterRoleSchema.options).toEqual(['protagonist', 'antagonist', 'supporting', 'minor']);
  });
});

describe('updateCharacterInputSchema', () => {
  it('accepts a single partial trait patch', () => {
    const u = updateCharacterInputSchema.parse({ traits: { hair: { locked: true } } });
    expect(u.traits?.hair?.locked).toBe(true);
    expect(u.traits?.hair?.value).toBeUndefined();
  });

  it('accepts new outfits without id', () => {
    const u = updateCharacterInputSchema.parse({
      outfits: [{ name: 'Battle coat', description: '', isDefault: true }],
    });
    expect(u.outfits?.[0]?.id).toBeUndefined();
  });

  it('rejects outfits with no default', () => {
    expect(() =>
      updateCharacterInputSchema.parse({
        outfits: [{ name: 'A', description: '', isDefault: false }],
      }),
    ).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() => updateCharacterInputSchema.parse({ references: [] })).toThrow();
  });
});
