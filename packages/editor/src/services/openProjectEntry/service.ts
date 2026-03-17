import type { OpenProjectEntryOptions } from './contracts';

import { DOCK_PANELS } from '../../components/layout/dock/dockPanelIds';
import { detectDescriptorType, getSheetDescriptorPath, isSheetDescriptor } from '../../utils/assetDescriptorUtilities';
import { AUDIO_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../../utils/assetTypes';
import { fsReadTextFile } from '../fs';
import { openJsonEntry } from './jsonCoordinator';
import { openAssetEntry, openAudiosheetEntry, openSpritesheetEntry, openTextEntry, openUnknownEntry } from './nonJsonHandlers';

type MissingSpritesheetDescriptorHandler = (
    request: MissingSpritesheetDescriptorRequest,
) => boolean | Promise<boolean>;

type MissingSpritesheetDescriptorRequest = {
    entryName: string;
    imagePath: string;
};

let onMissingSpritesheetDescriptor: MissingSpritesheetDescriptorHandler | undefined;

export async function openProjectEntry(fullPath: string, entryName: string, options?: OpenProjectEntryOptions) {
    const extension = getExtension(entryName);

    try {
        if (isSheetDescriptor(entryName)) {
            const contents = await fsReadTextFile(fullPath);
            const detectedType = detectDescriptorType(JSON.parse(contents));

            if (detectedType === 'spritesheet') {
                await openSpritesheetEntry(fullPath);
                return;
            }

            if (detectedType === 'audiosheet') {
                await openAudiosheetEntry(fullPath);
                return;
            }

            await openJsonEntry(fullPath, options);
            return;
        }

        if (IMG_EXT.has(extension)) {
            const descriptorPath = getSheetDescriptorPath(fullPath);
            try {
                await fsReadTextFile(descriptorPath);
                await openSpritesheetEntry(descriptorPath);
                return;
            } catch {
                if (options?.openInSpritesheetEditor) {
                    const handled = await onMissingSpritesheetDescriptor?.({
                        entryName,
                        imagePath: fullPath,
                    });

                    if (handled) {
                        return;
                    }
                }
            }

            openAssetEntry(fullPath);
            return;
        }

        if (AUDIO_EXT.has(extension)) {
            const descriptorPath = getSheetDescriptorPath(fullPath);
            try {
                await fsReadTextFile(descriptorPath);
                await openAudiosheetEntry(descriptorPath);
                return;
            } catch {
                // Missing companion descriptor should not block regular asset opening.
            }

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

export function setMissingSpritesheetDescriptorHandler(handler: MissingSpritesheetDescriptorHandler | undefined): void {
    onMissingSpritesheetDescriptor = handler;
}

function focusMainEditorFor(kind: 'asset' | 'scriptLike' | 'text') {
    void kind;
    if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') {
        return;
    }

    globalThis.dispatchEvent(new globalThis.CustomEvent('zerith:dock-select', { detail: DOCK_PANELS.editor }));
}

