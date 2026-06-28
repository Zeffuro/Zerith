import { describe, expect, it } from 'vitest';

import {
    createEmptyAssetLibraryMetadata,
    setAssetLibraryAssetMetadata,
} from '../../../services/assetLibraryMetadata';
import {
    applyAssetAudioRoleMetadataToLibrary,
    classifyAssetLibraryAudioRole,
    collectAssetAudioRoleAssetGroups,
    createAssetAudioRoleSummary,
    filterAssetDependencyGraphByAudioRole,
} from '../assetAudioRoleModel';

describe('assetAudioRoleModel', () => {
    const graph = {
        missing: [
            {
                assetUrl: '/assets/audio/missing-theme.ogg',
                references: [{ commandType: 'play_bgm', filePath: '/project/scripts/intro.json', path: [1, 'assetUrl'], sceneName: 'intro' }],
            },
        ],
        unused: [
            '/assets/audio-regions/line_001.wav',
            '/assets/bgm/title.ogg',
            '/assets/sfx/click.wav',
            '/assets/sheets/ui.sheet.json',
            '/assets/voice/phoenix_001.ogg',
            '/assets/misc/noise.wav',
            '/assets/bg/court.png',
        ],
        used: [
            {
                assetUrl: '/assets/audio/cue.sheet.json',
                references: [{ commandType: 'play_sfx', filePath: '/project/scripts/intro.json', path: [2, 'assetUrl'], sceneName: 'intro' }],
            },
            {
                assetUrl: '/assets/audio/narrator.ogg',
                references: [{ commandType: 'dialogue_voice', filePath: '/project/scripts/intro.json', path: [3, 'voice'], sceneName: 'intro' }],
            },
        ],
    };

    it('classifies and filters audio library roles from references and asset paths', () => {
        expect(classifyAssetLibraryAudioRole('/assets/bg/court.png')).toBeUndefined();
        expect(classifyAssetLibraryAudioRole('/assets/audio/cue.sheet.json')).toBe('audiosheet');
        expect(classifyAssetLibraryAudioRole('/assets/audio/cue.sheet.json', graph.used[0].references)).toBe('sfx');
        expect(classifyAssetLibraryAudioRole('/assets/audio-regions/line_001.wav')).toBe('audio-region');
        expect(classifyAssetLibraryAudioRole('/assets/voice/phoenix_001.ogg')).toBe('voice');

        expect(createAssetAudioRoleSummary(graph)).toEqual([
            { missing: 1, role: 'bgm', total: 2, unused: 1, used: 0 },
            { missing: 0, role: 'sfx', total: 2, unused: 1, used: 1 },
            { missing: 0, role: 'voice', total: 2, unused: 1, used: 1 },
            { missing: 0, role: 'audio-region', total: 1, unused: 1, used: 0 },
            { missing: 0, role: 'audiosheet', total: 1, unused: 1, used: 0 },
            { missing: 0, role: 'other', total: 1, unused: 1, used: 0 },
        ]);

        expect(filterAssetDependencyGraphByAudioRole(graph, 'voice')).toEqual({
            missing: [],
            unused: ['/assets/voice/phoenix_001.ogg'],
            used: [graph.used[1]],
        });
    });

    it('plans and applies persistent audio role metadata', () => {
        const roleGroups = collectAssetAudioRoleAssetGroups(graph);
        expect(roleGroups).toEqual([
            { assetUrls: ['/assets/audio/missing-theme.ogg', '/assets/bgm/title.ogg'], label: 'BGM', role: 'bgm' },
            { assetUrls: ['/assets/audio/cue.sheet.json', '/assets/sfx/click.wav'], label: 'SFX', role: 'sfx' },
            { assetUrls: ['/assets/audio/narrator.ogg', '/assets/voice/phoenix_001.ogg'], label: 'Voice', role: 'voice' },
            { assetUrls: ['/assets/audio-regions/line_001.wav'], label: 'Audio Region', role: 'audio-region' },
            { assetUrls: ['/assets/sheets/ui.sheet.json'], label: 'Audiosheet', role: 'audiosheet' },
            { assetUrls: ['/assets/misc/noise.wav'], label: 'Other Audio', role: 'other' },
        ]);

        const metadata = setAssetLibraryAssetMetadata(
            createEmptyAssetLibraryMetadata(),
            '/assets/bgm/title.ogg',
            { collections: ['Reviewed'], tags: ['loop'] },
        );
        const result = applyAssetAudioRoleMetadataToLibrary(metadata, roleGroups);

        expect(result.assetCount).toBe(9);
        expect(result.metadata.assets['/assets/bgm/title.ogg']).toEqual({
            collections: ['Audio', 'Reviewed'],
            tags: ['BGM', 'loop'],
        });
        expect(result.metadata.assets['/assets/audio/cue.sheet.json']).toEqual({
            collections: ['Audio'],
            tags: ['SFX'],
        });
        expect(result.metadata.assets['/assets/bg/court.png']).toBeUndefined();
    });
});
