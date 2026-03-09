import type { BaseCommand } from './Commands';

export type RuntimeEntry =
    | { command: BaseCommand; kind: 'injected' }
    | { command: BaseCommand; kind: 'original'; originalIndex: number };

