import { describe, expect, it } from 'vitest';

import {
    formatAssetMetadataEditorDraft,
    parseAssetMetadataEditorDraft,
} from '../assetMetadataEditorModel';

describe('assetMetadataEditorModel', () => {
    it('formats and parses metadata editor drafts deterministically', () => {
        expect(formatAssetMetadataEditorDraft({
            collections: ['Backgrounds', 'Characters'],
            tags: ['hero', 'needs cleanup'],
        })).toEqual({
            collectionsInput: 'Backgrounds, Characters',
            tagsInput: 'hero, needs cleanup',
        });

        expect(parseAssetMetadataEditorDraft({
            collectionsInput: ' Characters, backgrounds\ncharacters ',
            tagsInput: ' hero, needs   cleanup,Hero ',
        })).toEqual({
            collections: ['backgrounds', 'Characters'],
            tags: ['hero', 'needs cleanup'],
        });
    });
});
