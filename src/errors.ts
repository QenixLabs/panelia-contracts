import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'RATING_LOCKED',
  'PRESET_FORMAT_MISMATCH',
  'PRESET_UNKNOWN',
  'REF_LIMIT',
  'UPLOAD_MISMATCH',
  'UNSUPPORTED_TYPE',
  'FILE_TOO_LARGE',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
