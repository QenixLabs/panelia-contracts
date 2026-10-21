import { describe, expect, it } from 'vitest';
import {
  createProjectInputSchema,
  komaVariantSchema,
  projectFormatSchema,
  projectListSchema,
  projectSchema,
  ratingSchema,
  updateProjectInputSchema,
} from './project.js';
import type {
  CreateProjectInput,
  Project,
  ProjectFormat,
  ProjectList,
  Rating,
  UpdateProjectInput,
} from './project.js';
import type { StyleProfile } from './style.js';
import {
  authTokensSchema,
  loginInputSchema,
  registerInputSchema,
} from './auth.js';
import type { AuthTokens, LoginInput, RegisterInput } from './auth.js';

const style: StyleProfile = {
  renderFamily: 'bw_ink',
  artDirection: 'shonen_action',
  mood: 'cinematic',
  fine: {
    lineWeight: 70, realism: 30, saturation: 0, shadingHardness: 75,
    detail: 70, eyeExaggeration: 55, texture: 40, lightingStrength: 70,
  },
};

const baseProject = {
  id: 'prj_1',
  title: 'My Manga',
  coverUrl: 'https://example.com/cover.png',
  rating: 'teen',
  presetId: 'shonen_action_manga',
  basedOnPresetId: 'shonen_action_manga',
  style,
  komaVariant: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
};

describe('projectSchema', () => {
  it('parses a project with format manga', () => {
    const project = projectSchema.parse({ ...baseProject, format: 'manga' });
    expect(project.format).toBe('manga');
  });

  it("parses a project with format '4koma'", () => {
    const project = projectSchema.parse({ ...baseProject, format: '4koma' });
    expect(project.format).toBe('4koma');
  });

  it('rejects mixed-case format "Manga"', () => {
    expect(() =>
      projectSchema.parse({ ...baseProject, format: 'Manga' }),
    ).toThrow();
  });

  it('allows a null coverUrl', () => {
    const project = projectSchema.parse({
      ...baseProject,
      format: 'manga',
      coverUrl: null,
    });
    expect(project.coverUrl).toBeNull();
  });

  it('rejects an empty title', () => {
    expect(() => projectSchema.parse({ ...baseProject, title: '' })).toThrow();
  });

  it('rejects a whitespace-only title', () => {
    expect(() =>
      projectSchema.parse({ ...baseProject, title: '   ' }),
    ).toThrow();
  });

  it('trims a padded title', () => {
    const project = projectSchema.parse({
      ...baseProject,
      format: 'manga',
      title: '  My Manga  ',
    });
    expect(project.title).toBe('My Manga');
  });

  it('carries the Project / ProjectFormat types', () => {
    const project: Project = projectSchema.parse({
      ...baseProject,
      format: 'manhwa',
    });
    const format: ProjectFormat = project.format;
    expect(format).toBe('manhwa');
  });
});

describe('projectFormatSchema', () => {
  it('exposes the three formats', () => {
    expect(projectFormatSchema.options).toEqual(['manga', 'manhwa', '4koma']);
  });
});

describe('projectListSchema', () => {
  it('parses a list of projects', () => {
    const list: ProjectList = projectListSchema.parse({
      items: [projectSchema.parse({ ...baseProject, format: 'manga' })],
      total: 1,
    });
    expect(list.items).toHaveLength(1);
    expect(list.total).toBe(1);
  });

  it('rejects a negative total', () => {
    expect(() => projectListSchema.parse({ items: [], total: -1 })).toThrow();
  });
});

describe('createProjectInputSchema', () => {
  it('defaults format to manga and rating to teen', () => {
    const input = createProjectInputSchema.parse({
      title: 'Hello',
      presetId: 'shonen_action_manga',
    });
    expect(input.format).toBe('manga');
    expect(input.rating).toBe('teen');
    expect(input.style).toBeUndefined();
  });

  it('accepts an explicit format, rating and style override', () => {
    const input = createProjectInputSchema.parse({
      title: 'Hello',
      format: 'manhwa',
      presetId: 'clean_webtoon',
      rating: 'mature',
      style,
    });
    expect(input.format).toBe('manhwa');
    expect(input.style?.mood).toBe('cinematic');
  });

  it('requires presetId', () => {
    expect(() => createProjectInputSchema.parse({ title: 'Hello' })).toThrow();
  });

  it('rejects an empty title', () => {
    expect(() =>
      createProjectInputSchema.parse({ title: '', presetId: 'clean_webtoon' }),
    ).toThrow();
  });

  it('rejects a whitespace-only title', () => {
    expect(() =>
      createProjectInputSchema.parse({ title: '  ', presetId: 'clean_webtoon' }),
    ).toThrow();
  });

  it('trims a padded title', () => {
    const input = createProjectInputSchema.parse({
      title: '  Hello  ',
      presetId: 'clean_webtoon',
    });
    expect(input.title).toBe('Hello');
  });

  it('carries the CreateProjectInput type', () => {
    const input: CreateProjectInput = { title: 'Hello', presetId: 'clean_webtoon' };
    expect(input.title).toBe('Hello');
  });
});

describe('updateProjectInputSchema', () => {
  it('parses a partial update', () => {
    const update: UpdateProjectInput = updateProjectInputSchema.parse({
      title: 'New title',
    });
    expect(update.title).toBe('New title');
  });

  it('accepts format, presetId null, style and rating', () => {
    const update = updateProjectInputSchema.parse({
      format: 'manhwa',
      presetId: null,
      style,
      rating: 'all_ages',
    });
    expect(update.presetId).toBeNull();
    expect(update.rating).toBe('all_ages');
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      updateProjectInputSchema.parse({ title: 'x', komaVariant: 'classic_vertical' }),
    ).toThrow();
  });
});

describe('ratingSchema', () => {
  it('exposes four ratings in ascending order', () => {
    const ratings: Rating[] = ratingSchema.options;
    expect(ratings).toEqual(['all_ages', 'teen', 'mature', 'adult_18plus']);
  });
});

describe('komaVariantSchema', () => {
  it('has the single MVP variant', () => {
    expect(komaVariantSchema.options).toEqual(['classic_vertical']);
  });
});

describe('projectSchema Phase 2 fields', () => {
  it('allows presetId null with basedOnPresetId kept', () => {
    const project = projectSchema.parse({ ...baseProject, format: 'manga', presetId: null });
    expect(project.presetId).toBeNull();
    expect(project.basedOnPresetId).toBe('shonen_action_manga');
  });

  it('requires style', () => {
    const { style: _s, ...rest } = baseProject;
    expect(() => projectSchema.parse({ ...rest, format: 'manga' })).toThrow();
  });
});

describe('registerInputSchema', () => {
  it('parses a valid register payload', () => {
    const input: RegisterInput = registerInputSchema.parse({
      email: 'nilesh@example.com',
      password: 'supersecret1',
      name: 'Nilesh',
    });
    expect(input.email).toBe('nilesh@example.com');
  });

  it('rejects a password shorter than 8 chars', () => {
    expect(() =>
      registerInputSchema.parse({
        email: 'nilesh@example.com',
        password: 'short',
        name: 'Nilesh',
      }),
    ).toThrow();
  });

  it('rejects a bad email', () => {
    expect(() =>
      registerInputSchema.parse({
        email: 'nope',
        password: 'supersecret1',
        name: 'Nilesh',
      }),
    ).toThrow();
  });

  it('rejects a whitespace-only name', () => {
    expect(() =>
      registerInputSchema.parse({
        email: 'nilesh@example.com',
        password: 'supersecret1',
        name: '   ',
      }),
    ).toThrow();
  });

  it('trims a padded name', () => {
    const input = registerInputSchema.parse({
      email: 'nilesh@example.com',
      password: 'supersecret1',
      name: '  Nilesh  ',
    });
    expect(input.name).toBe('Nilesh');
  });
});

describe('loginInputSchema', () => {
  it('parses a valid login payload', () => {
    const input: LoginInput = loginInputSchema.parse({
      email: 'nilesh@example.com',
      password: 'anything',
    });
    expect(input.email).toBe('nilesh@example.com');
  });

  it('requires both email and password', () => {
    expect(() =>
      loginInputSchema.parse({ email: 'nilesh@example.com' }),
    ).toThrow();
    expect(() =>
      loginInputSchema.parse({ password: 'anything' }),
    ).toThrow();
  });
});

describe('authTokensSchema', () => {
  it('parses auth tokens', () => {
    const tokens: AuthTokens = authTokensSchema.parse({
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect(tokens.accessToken).toBe('a');
  });

  it('rejects empty accessToken', () => {
    expect(() =>
      authTokensSchema.parse({ accessToken: '', refreshToken: 'r' }),
    ).toThrow();
  });

  it('rejects empty refreshToken', () => {
    expect(() =>
      authTokensSchema.parse({ accessToken: 'a', refreshToken: '' }),
    ).toThrow();
  });
});
