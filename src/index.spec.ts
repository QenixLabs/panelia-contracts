import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';

const EXPECTED_EXPORTS = [
  'apiErrorSchema',
  'apiSuccessSchema',
  'authResponseSchema',
  'authTokensSchema',
  'createProjectInputSchema',
  'entityIdSchema',
  'isoDateTimeSchema',
  'jobStateSchema',
  'jobStatusEventSchema',
  'loginInputSchema',
  'projectFormatSchema',
  'projectListSchema',
  'projectSchema',
  'registerInputSchema',
  'updateProjectInputSchema',
  'urlSchema',
  'userPlanSchema',
  'userSchema',
].sort();

describe('barrel exports', () => {
  it('exposes the full public schema surface and nothing extra', () => {
    const actual = Object.keys(contracts).sort();
    expect(actual).toEqual(EXPECTED_EXPORTS);
  });
});
