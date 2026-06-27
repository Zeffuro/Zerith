import { describe, expect, it } from 'vitest';

import type { BaseCommand } from '../types';

import { collectDialogueBacklogEntries } from '../utils/Backlog';

describe('dialogue backlog', () => {
    it('collects visible dialogue metadata from nested command scripts', () => {
        const script: BaseCommand[] = [
            {
                expressionRef: 'aria.smile',
                lineId: 'intro.line.001',
                speaker: 'aria',
                tags: ['opening'],
                text: 'Opening line.',
                type: 'dialogue',
                voice: {
                    assetUrl: '/voice/intro.ogg',
                    cue: 'intro.line.001',
                },
            },
            {
                options: [
                    {
                        commands: [
                            {
                                lineId: 'intro.branch.001',
                                speaker: 'cove',
                                text: 'Branch line.',
                                type: 'dialogue',
                            },
                        ],
                        label: 'Branch',
                    },
                ],
                type: 'choice',
            },
            {
                backlogVisibility: 'hide',
                lineId: 'intro.hidden.001',
                speaker: 'aria',
                text: 'Hidden line.',
                type: 'dialogue',
            },
        ];

        const entries = collectDialogueBacklogEntries(script, {
            namespace: 'scene.intro',
            sceneName: 'intro',
        });

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            backlogVisibility: 'show',
            expressionRef: 'aria.smile',
            lineId: 'intro.line.001',
            namespace: 'scene.intro',
            path: [0],
            sceneName: 'intro',
            speaker: 'aria',
            tags: ['opening'],
            text: 'Opening line.',
        });
        expect(entries[0]?.voice).toEqual({
            assetUrl: '/voice/intro.ogg',
            cue: 'intro.line.001',
        });
        expect(entries[1]).toMatchObject({
            lineId: 'intro.branch.001',
            path: [1, 4, 0, 0],
            speaker: 'cove',
        });
    });

    it('can include hidden dialogue lines for audit tooling', () => {
        const script: BaseCommand[] = [
            {
                backlogVisibility: 'hide',
                lineId: 'intro.hidden.001',
                speaker: 'aria',
                text: 'Hidden line.',
                type: 'dialogue',
            },
        ];

        expect(collectDialogueBacklogEntries(script)).toEqual([]);
        expect(collectDialogueBacklogEntries(script, { includeHidden: true })).toMatchObject([
            {
                backlogVisibility: 'hide',
                lineId: 'intro.hidden.001',
            },
        ]);
    });
});
