import { z } from 'zod';

export const registerInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80),
});

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
