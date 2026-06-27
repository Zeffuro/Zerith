import { describe, expect, it } from 'vitest';

import { createPreviewSceneNavigationHandler } from '../previewSceneNavigation';

describe('createPreviewSceneNavigationHandler', () => {
    it('executes jumps to loaded scenes', () => {
        const handler = createPreviewSceneNavigationHandler({
            ending: [],
            intro: [],
        });

        expect(handler('ending', 'jump')).toBe('execute');
    });

    it('skips jumps to missing scenes', () => {
        const handler = createPreviewSceneNavigationHandler({
            intro: [],
        });

        expect(handler('ending', 'jump')).toBe('skip');
    });

    it('keeps scene_change commands executable as visual transitions', () => {
        const handler = createPreviewSceneNavigationHandler({});

        expect(handler('/assets/bg/studio.svg', 'scene_change')).toBe('execute');
    });
});
