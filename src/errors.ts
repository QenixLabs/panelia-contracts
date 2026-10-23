import { z } from 'zod';
import { uuidSchema } from './primitives.js';

export const apiErrorCodeSchema = z.enum([
  // Phase 2
  'RATING_LOCKED',
  'PRESET_FORMAT_MISMATCH',
  'PRESET_UNKNOWN',
  'REF_LIMIT',
  'UPLOAD_MISMATCH',
  'UNSUPPORTED_TYPE',
  'FILE_TOO_LARGE',
  // Phase 3
  'INVALID_ID',
  'RATE_LIMITED',
  'SCRIPT_TOO_SHORT',
  'SCRIPT_TOO_LONG',
  'INSUFFICIENT_CREDITS',
  'PLAN_CONFLICT',
  'PLAN_LOCKED',
  'PARSE_IN_PROGRESS',
  'PLAN_EXISTS',
  'FORMAT_LOCKED',
  'IDEMPOTENCY_CONFLICT',
  'CHARACTER_IN_USE',
  'PLAN_UNRESOLVED',
  'PLAN_INCOMPLETE',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// The `details` shape of every code that carries details. Other codes carry none.
export const apiErrorDetailsSchemas = {
  SCRIPT_TOO_SHORT: z.object({ words: z.number().int(), limit: z.number().int() }),
  SCRIPT_TOO_LONG: z.object({ words: z.number().int(), limit: z.number().int() }),
  INSUFFICIENT_CREDITS: z.object({ required: z.number().int(), available: z.number().int() }),
  PLAN_CONFLICT: z.object({ currentRevision: z.number().int(), lastSaveId: uuidSchema.nullable() }),
  CHARACTER_IN_USE: z.object({ chapterNumbers: z.array(z.number().int()).min(1) }),
  PLAN_UNRESOLVED: z.object({ count: z.number().int().positive(), names: z.array(z.string()) }),
  PLAN_INCOMPLETE: z.object({ emptyPanels: z.number().int().positive() }),
} as const satisfies Partial<Record<ApiErrorCode, z.ZodType>>;

export type ApiErrorDetails<C extends keyof typeof apiErrorDetailsSchemas> = z.infer<
  (typeof apiErrorDetailsSchemas)[C]
>;

/** Typed `details` for `code`; null when the error has another code or its details don't parse. */
export function errorDetails<C extends keyof typeof apiErrorDetailsSchemas>(
  error: { code?: ApiErrorCode; details?: unknown },
  code: C,
): ApiErrorDetails<C> | null {
  if (error.code !== code) return null;
  const parsed = apiErrorDetailsSchemas[code].safeParse(error.details);
  // TS widens the generic lookup to the union of every details shape; the schema for C parsed it.
  return parsed.success ? (parsed.data as ApiErrorDetails<C>) : null;
}
