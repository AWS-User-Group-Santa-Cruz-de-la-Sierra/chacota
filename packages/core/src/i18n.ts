import { z } from 'zod';

/** Languages Chacota speaks: interface and content. */
export const Language = z.enum(['es', 'en']);
export type Language = z.infer<typeof Language>;
