import { describe, expect, it } from 'vitest';

import {
    createAssetAudioCueReviewEntry,
    createAssetAudioCueReviewSummary,
    filterAssetAudioCueReviewEntries,
    isAssetAudioCueReviewEntryExportable,
    loadAssetAudioCueReview,
    resolveAudiosheetSourceAssetUrl,
} from '../assetAudioCueReview';

describe('assetAudioCueReview', () => {
    it('resolves audiosheet source asset URLs relative to descriptor paths', () => {
        expect(resolveAudiosheetSourceAssetUrl('/assets/sfx/ui.sheet.json', 'ui.wav')).toBe('/assets/sfx/ui.wav');
        expect(resolveAudiosheetSourceAssetUrl('/assets/sfx/nested/ui.sheet.json', '../shared/ui.wav')).toBe('/assets/sfx/shared/ui.wav');
        expect(resolveAudiosheetSourceAssetUrl('/assets/sfx/ui.sheet.json', '/assets/audio/ui.wav')).toBe('/assets/audio/ui.wav');
        expect(resolveAudiosheetSourceAssetUrl('/assets/sfx/ui.sheet.json', 'https://example.com/ui.wav')).toBeUndefined();
    });

    it('creates cue summary entries with cue issues and source availability', () => {
        const entry = createAssetAudioCueReviewEntry('/assets/sfx/ui.sheet.json', {
            cues: {
                click: { duration: 0.25, start: 0, volume: 0.75 },
                loop: { loop: true, start: 1 },
            },
            source: 'ui.wav',
        }, ['/assets/sfx/ui.wav']);

        expect(entry).toEqual({
            cueCount: 2,
            descriptorAssetUrl: '/assets/sfx/ui.sheet.json',
            finiteDurationSeconds: 0.25,
            issueMessages: ['Cue "loop" has no duration.'],
            loopCueCount: 1,
            openEndedCueCount: 1,
            sourceAssetUrl: '/assets/sfx/ui.wav',
            sourceAvailable: true,
            volumeOverrideCueCount: 1,
        });
        expect(isAssetAudioCueReviewEntryExportable(entry)).toBe(true);
    });

    it('summarizes and filters cue review entries by export and source state', () => {
        const exportable = createAssetAudioCueReviewEntry('/assets/sfx/ui.sheet.json', {
            cues: {
                click: { duration: 0.25, start: 0 },
            },
            source: 'ui.wav',
        }, ['/assets/sfx/ui.wav']);
        const missingSource = createAssetAudioCueReviewEntry('/assets/voice/lines.sheet.json', {
            cues: {
                line: { duration: 1.2, start: 0 },
            },
            source: 'lines.wav',
        }, ['/assets/sfx/ui.wav']);
        const issueOnly = createAssetAudioCueReviewEntry('/assets/sfx/empty.sheet.json', {
            cues: {},
            source: 'https://example.test/remote.wav',
        }, []);
        const entries = [exportable, missingSource, issueOnly];

        expect(createAssetAudioCueReviewSummary(entries)).toEqual({
            exportableCueCount: 1,
            exportableEntryCount: 1,
            issueEntryCount: 2,
            missingSourceEntryCount: 1,
            totalCueCount: 2,
            totalEntryCount: 3,
        });
        expect(filterAssetAudioCueReviewEntries(entries, 'exportable')).toEqual([exportable]);
        expect(filterAssetAudioCueReviewEntries(entries, 'issues')).toEqual([missingSource, issueOnly]);
        expect(filterAssetAudioCueReviewEntries(entries, 'missing-source')).toEqual([missingSource]);
        expect(isAssetAudioCueReviewEntryExportable(missingSource)).toBe(false);
    });

    it('loads visible audiosheet descriptors and skips spritesheets', async () => {
        const files = new Map<string, string>([
            ['F:/project/assets/sfx/broken.sheet.json', JSON.stringify({
                cues: {
                    bad: { start: -1 },
                },
                source: 'missing.wav',
            })],
            ['F:/project/assets/sfx/invalid.sheet.json', '{'],
            ['F:/project/assets/sfx/ui.sheet.json', JSON.stringify({
                cues: {
                    click: { duration: 0.2, start: 0, volume: 0.6 },
                    loop: { duration: 1.5, loop: true, start: 1 },
                },
                source: 'ui.wav',
            })],
            ['F:/project/assets/sprites/hero.sheet.json', JSON.stringify({
                format: 'atlas',
                frames: {},
                source: 'hero.png',
            })],
        ]);

        const review = await loadAssetAudioCueReview(
            'F:/project',
            [
                '/assets/sfx/ui.sheet.json',
                '/assets/sfx/broken.sheet.json',
                '/assets/sfx/invalid.sheet.json',
                '/assets/sprites/hero.sheet.json',
                '/assets/sfx/ui.wav',
            ],
            ['/assets/sfx/ui.wav'],
            {
                join: (...parts) => Promise.resolve(parts.join('/')),
                readTextFile: (path) => {
                    const value = files.get(path);
                    if (value === undefined) throw new Error('missing file');
                    return Promise.resolve(value);
                },
            },
        );

        expect(review.totalCues).toBe(2);
        expect(review.issueCount).toBe(2);
        expect(review.entries.map((entry) => entry.descriptorAssetUrl)).toEqual([
            '/assets/sfx/broken.sheet.json',
            '/assets/sfx/invalid.sheet.json',
            '/assets/sfx/ui.sheet.json',
        ]);
        expect(review.entries[0].issueMessages[0]).toContain('Invalid audiosheet');
        expect(review.entries[1].issueMessages[0]).toContain('Descriptor JSON invalid');
        expect(review.entries[2]).toMatchObject({
            cueCount: 2,
            finiteDurationSeconds: 1.7,
            loopCueCount: 1,
            sourceAssetUrl: '/assets/sfx/ui.wav',
            sourceAvailable: true,
            volumeOverrideCueCount: 1,
        });
    });
});
