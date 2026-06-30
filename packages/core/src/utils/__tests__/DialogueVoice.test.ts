import { describe, expect, it } from 'vitest';

import {
    describeDialogueVoiceAttachment,
    normalizeDialogueVoiceAttachment,
    toDialogueVoiceAssetReference,
} from '../DialogueVoice';

describe('DialogueVoice utilities', () => {
    it('normalizes legacy string and structured voice attachments', () => {
        expect(normalizeDialogueVoiceAttachment(' /assets/voice/line.ogg ')).toEqual({
            assetUrl: '/assets/voice/line.ogg',
        });

        expect(normalizeDialogueVoiceAttachment({
            assetUrl: ' /assets/voice/lines.sheet.json ',
            cue: ' intro.001 ',
            volume: 0.75,
        })).toEqual({
            assetUrl: '/assets/voice/lines.sheet.json',
            cue: 'intro.001',
            volume: 0.75,
        });
    });

    it('creates stable asset references for compiler and review tooling', () => {
        expect(toDialogueVoiceAssetReference({
            assetUrl: '/assets/voice/lines.sheet.json',
            cue: 'intro.001',
        })).toBe('/assets/voice/lines.sheet.json:intro.001');
        expect(describeDialogueVoiceAttachment('/assets/voice/line.ogg')).toBe('/assets/voice/line.ogg');
        expect(normalizeDialogueVoiceAttachment({ cue: 'missing asset' })).toBeUndefined();
    });
});
