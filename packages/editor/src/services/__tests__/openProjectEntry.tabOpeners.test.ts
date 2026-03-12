import { beforeEach, describe, expect, it } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
} from '../../test-utils/registerOpenProjectEntryMocks';
import { openMacrosTab, openScriptTab } from '../openProjectEntry/index';

const openProjectEntryMocks = getOpenProjectEntryMocks();

describe('openProjectEntry tabOpeners', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('opens script tab and applies forced script view', () => {
        openScriptTab('/project/scripts/intro.json', 'timeline');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setScriptView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'script:/project/scripts/intro.json',
                kind: 'script',
                path: '/project/scripts/intro.json',
                preferredView: 'timeline',
                title: 'intro.json',
            },
        });
    });

    it('opens macros tab without forcing view when not provided', () => {
        openMacrosTab('/project/scripts/macros.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledTimes(1);
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'macros:/project/scripts/macros.json',
                kind: 'macros',
                path: '/project/scripts/macros.json',
                preferredView: 'timeline',
                title: 'macros.json',
            },
        });
    });
});

