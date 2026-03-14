import type { OpenProjectEntryOptions } from './contracts';

import { AUDIO_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../../utils/assetTypes';
import { openJsonEntry } from './jsonCoordinator';
import { openAssetEntry, openTextEntry, openUnknownEntry } from './nonJsonHandlers';

export async function openProjectEntry(fullPath: string, entryName: string, options?: OpenProjectEntryOptions) {
    const extension = getExtension(entryName);

    try {
        if (IMG_EXT.has(extension) || AUDIO_EXT.has(extension)) {
            openAssetEntry(fullPath);
            return;
        }

        if (extension === '.json') {
            await openJsonEntry(fullPath, options);
            return;
        }

        if (TEXT_EXT.has(extension)) {
            await openTextEntry(fullPath);
            focusMainEditorFor('text');
            return;
        }

        openUnknownEntry(fullPath);
    } catch (error) {
        console.error('Failed to open entry:', error);
    }
}

function focusMainEditorFor(kind: 'asset' | 'scriptLike' | 'text') {
    // TODO: integrate with Dock model to select center tabset tab.
    void kind;
}

