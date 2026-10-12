import { describe, expect, it } from 'vitest';
import {
  createProjectInputSchema,
  projectFormatSchema,
  projectListSchema,
  projectSchema,
  updateProjectInputSchema,
} from './project.js';
import type {
  CreateProjectInput,
  Project,
  ProjectFormat,
  ProjectList,
  UpdateProjectInput,
} from './project.js';
import {
  authTokensSchema,
  loginInputSchema,
  registerInputSchema,
} from './auth.js';
import type { AuthTokens, LoginInput, RegisterInput } from './auth.js';

const baseProject = {
  id: 'prj_1',
  title: 'My Manga',
  coverUrl: 'https://example.com/cover.png',
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
  it('defaults format to manga', () => {
    const input = createProjectInputSchema.parse({ title: 'Hello' });
    expect(input.format).toBe('manga');
  });

  it('accepts an explicit format', () => {
    const input = createProjectInputSchema.parse({
      title: 'Hello',
      format: 'manhwa',
    });
    expect(input.format).toBe('manhwa');
  });

  it('rejects an empty title', () => {
    expect(() => createProjectInputSchema.parse({ title: '' })).toThrow();
  });

  it('rejects a whitespace-only title', () => {
    expect(() => createProjectInputSchema.parse({ title: '  ' })).toThrow();
  });

  it('trims a padded title', () => {
    const input = createProjectInputSchema.parse({ title: '  Hello  ' });
    expect(input.title).toBe('Hello');
  });

  it('carries the CreateProjectInput type', () => {
    const input: CreateProjectInput = { title: 'Hello' };
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

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      updateProjectInputSchema.parse({ title: 'x', format: 'manga' }),
    ).toThrow();
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
