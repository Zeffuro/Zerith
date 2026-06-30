import { describe, expect, it } from 'vitest';

import {
    EDITOR_VISUAL_SMOKE_SCENARIOS,
    EDITOR_VISUAL_SMOKE_VIEWPORTS,
    type EditorVisualSmokeSurface,
    getEditorVisualSmokeScenarioIdsForSurface,
} from '../editorVisualSmokeCoverage';

const REQUIRED_SURFACES: EditorVisualSmokeSurface[] = [
    'asset-metadata-dialog',
    'command-palette',
    'dialogue-inspector',
    'export-modal',
    'git-panel',
    'global-live-status',
    'new-project-modal',
    'project-validation-panel',
    'settings-modal',
];

describe('editorVisualSmokeCoverage', () => {
    it('defines desktop and compact viewports for future screenshot smoke runs', () => {
        expect(EDITOR_VISUAL_SMOKE_VIEWPORTS).toEqual([
            { height: 844, id: 'compact', width: 390 },
            { height: 900, id: 'desktop', width: 1440 },
        ]);
    });

    it('covers every Slice 5 accessibility surface with desktop and compact scenarios', () => {
        for (const surface of REQUIRED_SURFACES) {
            const scenarioIds = getEditorVisualSmokeScenarioIdsForSurface(surface);
            expect(scenarioIds.length, surface).toBeGreaterThan(0);
        }

        for (const scenario of EDITOR_VISUAL_SMOKE_SCENARIOS) {
            expect(scenario.viewports).toEqual(['desktop', 'compact']);
            expect(scenario.assertions.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('keeps scenario ids unique and stable', () => {
        const ids = EDITOR_VISUAL_SMOKE_SCENARIOS.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
