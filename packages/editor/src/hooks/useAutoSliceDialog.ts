import { useCallback, useEffect, useRef, useState } from 'react';

import { fsWriteTextFile } from '../services/fs';
import { openSpritesheetEntry, setMissingSpritesheetDescriptorHandler } from '../services/openProjectEntry';
import { releaseEditorAssetUrl, resolveEditorAssetUrl } from '../services/runtime/assetUrls';

type AutoSliceRequest = {
    entryName: string;
    imagePath: string;
};

type PendingAutoSlice = {
    resolve: (handled: boolean) => void;
} & AutoSliceRequest;

type UseAutoSliceDialogResult = {
    autoSliceImage: HTMLImageElement | undefined;
    finalizeAutoSlice: (handled: boolean) => void;
    handleAutoSliceCreate: (descriptorText: string, descriptorPath: string) => Promise<void>;
    pendingAutoSlice: PendingAutoSlice | undefined;
};

export function useAutoSliceDialog(): UseAutoSliceDialogResult {
    const [pendingAutoSlice, setPendingAutoSlice] = useState<PendingAutoSlice>();
    const [autoSliceImage, setAutoSliceImage] = useState<HTMLImageElement>();
    const pendingAutoSliceReference = useRef<PendingAutoSlice | undefined>(undefined);

    useEffect(() => {
        pendingAutoSliceReference.current = pendingAutoSlice;
    }, [pendingAutoSlice]);

    useEffect(() => {
        setMissingSpritesheetDescriptorHandler((request) => new Promise<boolean>((resolve) => {
            const activeRequest = pendingAutoSliceReference.current;
            if (activeRequest) {
                activeRequest.resolve(false);
            }

            setAutoSliceImage(undefined);
            setPendingAutoSlice({ ...request, resolve });
        }));

        return () => {
            setMissingSpritesheetDescriptorHandler(undefined);
            const activeRequest = pendingAutoSliceReference.current;
            if (activeRequest) {
                activeRequest.resolve(false);
                pendingAutoSliceReference.current = undefined;
            }
        };
    }, []);

    useEffect(() => {
        if (!pendingAutoSlice) return;

        let disposed = false;
        let resolvedImageUrl: string | undefined;
        const image = new Image();

        image.addEventListener('load', () => {
            if (disposed) return;
            setAutoSliceImage(image);
        });

        image.addEventListener('error', () => {
            if (disposed) return;
            pendingAutoSlice.resolve(false);
            setPendingAutoSlice(undefined);
            setAutoSliceImage(undefined);
        });

        void (async () => {
            try {
                resolvedImageUrl = await resolveEditorAssetUrl(pendingAutoSlice.imagePath);
                if (disposed) {
                    releaseEditorAssetUrl(resolvedImageUrl);
                    return;
                }
                image.src = resolvedImageUrl;
            } catch {
                if (disposed) return;
                pendingAutoSlice.resolve(false);
                setPendingAutoSlice(undefined);
                setAutoSliceImage(undefined);
            }
        })();

        return () => {
            disposed = true;
            if (resolvedImageUrl) {
                releaseEditorAssetUrl(resolvedImageUrl);
            }
        };
    }, [pendingAutoSlice]);

    const finalizeAutoSlice = useCallback((handled: boolean) => {
        const activeRequest = pendingAutoSliceReference.current;
        if (!activeRequest) return;

        activeRequest.resolve(handled);
        pendingAutoSliceReference.current = undefined;
        setPendingAutoSlice(undefined);
        setAutoSliceImage(undefined);
    }, []);

    const handleAutoSliceCreate = useCallback(async (descriptorText: string, descriptorPath: string) => {
        try {
            await fsWriteTextFile(descriptorPath, descriptorText);
            await openSpritesheetEntry(descriptorPath);
            finalizeAutoSlice(true);
        } catch {
            finalizeAutoSlice(false);
        }
    }, [finalizeAutoSlice]);

    return {
        autoSliceImage,
        finalizeAutoSlice,
        handleAutoSliceCreate,
        pendingAutoSlice,
    };
}

