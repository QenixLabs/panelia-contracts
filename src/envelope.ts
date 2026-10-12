import { z } from 'zod';

export interface ApiSuccess<T> {
  message: string;
  data: T;
  success: true;
}

export interface ApiError {
  message: string;
  data: null;
  success: false;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({
    message: z.string(),
    data,
    success: z.literal(true),
  });
}

export const apiErrorSchema = z.object({
  message: z.string(),
  data: z.null(),
  success: z.literal(false),
});
