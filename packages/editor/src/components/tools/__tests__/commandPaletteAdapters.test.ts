import { describe, expect, it } from 'vitest';

import * as actionClickAdapter from '../commandPaletteActionClickAdapterModel';
import * as actionDepsAdapter from '../commandPaletteActionsDepsAdapterModel';
import {
    buildCommandPaletteActionClickHandler,
    buildCommandPaletteActionsDeps,
    buildCommandPaletteControllerInteractions,
    buildCommandPaletteFilteredActions,
    buildCommandPaletteInitialProjectEntryHandler,
    buildCommandPaletteInputKeyDownHandler,
    buildCommandPaletteIsRunning,
    buildCommandPaletteOpenProjectEntryServiceHandler,
    buildCommandPaletteSaveHandlers,
    buildCommandPaletteViewProperties,
} from '../commandPaletteAdapters';
import * as controllerInteractionAdapter from '../commandPaletteControllerInteractionAdapterModel';
import * as filteredActionsAdapter from '../commandPaletteFilteredActionsAdapterModel';
import * as initialProjectEntryAdapter from '../commandPaletteInitialProjectEntryAdapterModel';
import * as keydownAdapter from '../commandPaletteKeydownAdapterModel';
import * as openProjectEntryServiceAdapter from '../commandPaletteOpenProjectEntryServiceAdapterModel';
import * as runningStateAdapter from '../commandPaletteRunningStateAdapterModel';
import * as saveAdapter from '../commandPaletteSaveAdapterModel';
import * as viewAdapter from '../commandPaletteViewAdapterModel';

describe('commandPaletteAdapters', () => {
    it('re-exports adapter builders as exact module references', () => {
        expect(buildCommandPaletteActionClickHandler).toBe(actionClickAdapter.buildCommandPaletteActionClickHandler);
        expect(buildCommandPaletteActionsDeps).toBe(actionDepsAdapter.buildCommandPaletteActionsDeps);
        expect(buildCommandPaletteControllerInteractions).toBe(controllerInteractionAdapter.buildCommandPaletteControllerInteractions);
        expect(buildCommandPaletteFilteredActions).toBe(filteredActionsAdapter.buildCommandPaletteFilteredActions);
        expect(buildCommandPaletteInitialProjectEntryHandler).toBe(initialProjectEntryAdapter.buildCommandPaletteInitialProjectEntryHandler);
        expect(buildCommandPaletteInputKeyDownHandler).toBe(keydownAdapter.buildCommandPaletteInputKeyDownHandler);
        expect(buildCommandPaletteOpenProjectEntryServiceHandler).toBe(openProjectEntryServiceAdapter.buildCommandPaletteOpenProjectEntryServiceHandler);
        expect(buildCommandPaletteIsRunning).toBe(runningStateAdapter.buildCommandPaletteIsRunning);
        expect(buildCommandPaletteSaveHandlers).toBe(saveAdapter.buildCommandPaletteSaveHandlers);
        expect(buildCommandPaletteViewProperties).toBe(viewAdapter.buildCommandPaletteViewProperties);
    });
});

