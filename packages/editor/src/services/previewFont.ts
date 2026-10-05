import { CanvasTextMetrics } from 'pixi.js';

import { releaseEditorAssetUrl, resolveProjectAssetUrl } from './runtime/assetUrls';

export function createPreviewFontOwner(projectPath: string, isCurrent: () => boolean) {
    let disposed = false;
    const ownedFaces = new Set<FontFace>();
    const fonts = globalThis.document?.fonts;
    const isActive = () => !disposed && isCurrent();

    return {
        dispose: () => {
            disposed = true;
            for (const face of ownedFaces) fonts?.delete(face);
            if (ownedFaces.size > 0) CanvasTextMetrics.clearMetrics();
            ownedFaces.clear();
        },
        load: async (fontFamily: string, fontAssetUrl: string): Promise<void> => {
            if (!isActive() || typeof FontFace !== 'function' || !fonts || !fontAssetUrl.trim()) return;

            let resolvedAssetUrl: string | undefined;
            try {
                resolvedAssetUrl = await resolveProjectAssetUrl(fontAssetUrl.trim(), projectPath);
                if (!isActive()) return;
                const face = new FontFace(fontFamily, `url(${JSON.stringify(resolvedAssetUrl)})`);
                const loadedFace = await face.load();
                if (!isActive()) return;
                fonts.add(loadedFace);
                ownedFaces.add(loadedFace);
                // Pixi retains font properties across preview engines.
                CanvasTextMetrics.clearMetrics();
            } catch (caughtError: unknown) {
                if (isActive()) console.warn('[preview] Failed to load custom font asset:', caughtError);
            } finally {
                if (resolvedAssetUrl) releaseEditorAssetUrl(resolvedAssetUrl);
            }
        },
    };
}
