import { z } from 'zod';

export const entityIdSchema = z.string().min(1).max(64);
export const isoDateTimeSchema = z.iso.datetime();
export const urlSchema = z.url();

// Mongo ids in new schemas, so a malformed id fails at the boundary instead of reaching Mongo.
// entityIdSchema stays for the existing schemas.
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

// Scene, panel, line, save and job ids. Clients mint them with crypto.randomUUID().
export const uuidSchema = z.uuid();
