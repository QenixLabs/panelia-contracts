import { z } from 'zod';

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

const successBase = apiSuccessSchema(z.unknown());
export type ApiSuccess<T> = Omit<z.infer<typeof successBase>, 'data'> & {
  data: T;
};
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;
