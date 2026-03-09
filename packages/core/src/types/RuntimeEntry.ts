import type { BaseCommand } from './Commands';

export type RuntimeEntry =
    | { kind: 'original'; originalIndex: number; command: BaseCommand }
    | { kind: 'injected'; command: BaseCommand };

