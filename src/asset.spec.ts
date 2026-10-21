import { describe, expect, it } from 'vitest';
import {
  MAX_ASSET_BYTES,
  MAX_REFS_PER_CHARACTER,
  assetContentTypeSchema,
  assetSchema,
  createUploadInputSchema,
  createUploadResultSchema,
} from './asset.js';
import type { Asset } from './asset.js';

const readyAsset: Asset = {
  id: 'ast_1',
  projectId: 'prj_1',
  kind: 'character_ref',
  contentType: 'image/png',
  sizeBytes: 204_800,
  status: 'ready',
  url: 'https://cdn.example.com/u/1/p/1/a/1?Signature=x',
  rights: {
    basis: 'own_work',
    attestedAt: '2026-10-21T10:00:00Z',
    reviewStatus: 'unreviewed',
  },
  createdAt: '2026-10-21T10:00:00Z',
};

const uploadInput = {
  kind: 'character_ref',
  characterId: 'chr_1',
  contentType: 'image/webp',
  sizeBytes: 1024,
  rights: { attested: true, basis: 'licensed' },
};

describe('limits', () => {
  it('caps at 10 MB and 20 refs', () => {
    expect(MAX_ASSET_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_REFS_PER_CHARACTER).toBe(20);
  });

  it('allows only jpeg/png/webp', () => {
    expect(assetContentTypeSchema.options).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('assetSchema', () => {
  it('round-trips a ready asset', () => {
    expect(assetSchema.parse(readyAsset)).toEqual(readyAsset);
  });

  it('allows null url while pending', () => {
    expect(assetSchema.parse({ ...readyAsset, status: 'pending', url: null }).url).toBeNull();
  });
});

describe('createUploadInputSchema', () => {
  it('parses a valid request', () => {
    expect(createUploadInputSchema.parse(uploadInput).rights.basis).toBe('licensed');
  });

  it('rejects attested: false', () => {
    expect(() =>
      createUploadInputSchema.parse({ ...uploadInput, rights: { attested: false, basis: 'own_work' } }),
    ).toThrow();
  });

  it('rejects files over 10 MB', () => {
    expect(() =>
      createUploadInputSchema.parse({ ...uploadInput, sizeBytes: MAX_ASSET_BYTES + 1 }),
    ).toThrow();
  });

  it('rejects gif', () => {
    expect(() =>
      createUploadInputSchema.parse({ ...uploadInput, contentType: 'image/gif' }),
    ).toThrow();
  });
});

describe('createUploadResultSchema', () => {
  it('parses presign output', () => {
    const r = createUploadResultSchema.parse({
      asset: { ...readyAsset, status: 'pending', url: null },
      uploadUrl: 'http://localhost:9000/panelia-assets/u/1?X-Amz-Signature=y',
      uploadHeaders: { 'Content-Type': 'image/png' },
      expiresAt: '2026-10-21T10:10:00Z',
    });
    expect(r.uploadHeaders['Content-Type']).toBe('image/png');
  });
});
