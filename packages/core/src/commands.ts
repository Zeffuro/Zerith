import { z } from 'zod';

import { CommandSchema } from './schemas';

export type Command = z.infer<typeof CommandSchema>;

export type TypedScript = Command[];