import { describe, expect, it } from 'vitest';

import {
    buildGeneratedDialogueLineId,
    createDialogueVoiceValue,
    readDialogueBacklogVisibility,
    readDialogueVoiceDraft,
    summarizeDialogueLineId,
} from '../dialogueInspectorModel';

describe('dialogueInspectorModel', () => {
    it('builds deterministic line IDs from scene namespaces and selected command paths', () => {
        expect(buildGeneratedDialogueLineId('scene.intro', [0])).toBe('scene.intro.line.001');
        expect(buildGeneratedDialogueLineId('scene intro', [1, 'options', 0, 'commands', 0]))
            .toBe('scene.intro.line.002.001.001');
        expect(buildGeneratedDialogueLineId(void 0, [0])).toBeUndefined();
    });

    it('summarizes generated, missing, and preserved line ID states', () => {
        expect(summarizeDialogueLineId('', 'scene.intro.line.001')).toMatchObject({
            status: 'missing',
            title: 'Missing ID',
        });
        expect(summarizeDialogueLineId('scene.intro.line.001', 'scene.intro.line.001')).toMatchObject({
            status: 'generated',
        });
        expect(summarizeDialogueLineId('custom.line', 'scene.intro.line.001')).toMatchObject({
            status: 'custom',
            title: 'Preserved custom ID',
        });
    });

    it('reads old and structured dialogue voice values and writes the structured form', () => {
        expect(readDialogueVoiceDraft('/assets/voice/line.ogg')).toEqual({
            assetUrl: '/assets/voice/line.ogg',
            cue: '',
            volume: '',
        });
        expect(readDialogueVoiceDraft({
            assetUrl: '/assets/voice/lines.sheet.json',
            cue: 'intro.001',
            volume: 0.8,
        })).toEqual({
            assetUrl: '/assets/voice/lines.sheet.json',
            cue: 'intro.001',
            volume: '0.8',
        });

        expect(createDialogueVoiceValue({
            assetUrl: '/assets/voice/lines.sheet.json:intro.001',
            cue: '',
            volume: '0.75',
        })).toEqual({
            assetUrl: '/assets/voice/lines.sheet.json',
            cue: 'intro.001',
            volume: 0.75,
        });
    });

    it('defaults backlog visibility to show for old projects', () => {
        expect(readDialogueBacklogVisibility(void 0)).toBe('show');
        expect(readDialogueBacklogVisibility('hide')).toBe('hide');
    });
});
