import { z } from 'zod';

export const entityIdSchema = z.string().min(1).max(64);
export const isoDateTimeSchema = z.iso.datetime();
export const urlSchema = z.url();
