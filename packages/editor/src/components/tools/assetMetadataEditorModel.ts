import {
    parseAssetLibraryLabelInput,
    type AssetLibraryAssetMetadata,
} from '../../services/assetLibraryMetadata';

export type AssetMetadataEditorDraft = {
    collectionsInput: string;
    tagsInput: string;
};

export function formatAssetMetadataEditorDraft(
    metadata: AssetLibraryAssetMetadata,
): AssetMetadataEditorDraft {
    return {
        collectionsInput: metadata.collections.join(', '),
        tagsInput: metadata.tags.join(', '),
    };
}

export function parseAssetMetadataEditorDraft(
    draft: AssetMetadataEditorDraft,
): AssetLibraryAssetMetadata {
    return {
        collections: parseAssetLibraryLabelInput(draft.collectionsInput),
        tags: parseAssetLibraryLabelInput(draft.tagsInput),
    };
}
