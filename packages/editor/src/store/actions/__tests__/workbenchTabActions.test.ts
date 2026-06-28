import { beforeEach, describe, expect, it, vi } from 'vitest';

const actionMocks = vi.hoisted(() => ({
    activateWorkbenchTab: vi.fn(),
    workbenchState: {
        activeTabId: undefined as string | undefined,
        closeOthers: vi.fn(),
        closeTab: vi.fn(),
        closeToRight: vi.fn(),
        setActiveTab: vi.fn(),
    },
}));

vi.mock('../../../services/activateWorkbenchTab', () => ({
    activateWorkbenchTab: actionMocks.activateWorkbenchTab,
}));

vi.mock('../../useWorkbenchStore', () => ({
    useWorkbenchStore: {
        getState: () => actionMocks.workbenchState,
        setState: vi.fn(),
    },
}));

import { executeWorkbenchTabAction } from '../workbenchTabActions';

describe('workbench tab actions', () => {
    beforeEach(() => {
        actionMocks.activateWorkbenchTab.mockReset();
        actionMocks.workbenchState.activeTabId = undefined;
        actionMocks.workbenchState.closeOthers.mockReset();
        actionMocks.workbenchState.closeTab.mockReset();
        actionMocks.workbenchState.closeToRight.mockReset();
        actionMocks.workbenchState.setActiveTab.mockReset();
    });

    it('loads a tab when activating from the tab context menu', () => {
        executeWorkbenchTabAction({ action: 'activate', tabId: 'script::/project/scripts/intro.json' });

        expect(actionMocks.activateWorkbenchTab).toHaveBeenCalledWith('script::/project/scripts/intro.json');
        expect(actionMocks.workbenchState.setActiveTab).not.toHaveBeenCalled();
    });

    it('loads the remaining active tab after closing a tab', () => {
        actionMocks.workbenchState.closeTab.mockImplementation(() => {
            actionMocks.workbenchState.activeTabId = 'script::/project/scripts/day2.json';
        });

        executeWorkbenchTabAction({ action: 'close', tabId: 'script::/project/scripts/intro.json' });

        expect(actionMocks.workbenchState.closeTab).toHaveBeenCalledWith('script::/project/scripts/intro.json');
        expect(actionMocks.activateWorkbenchTab).toHaveBeenCalledWith('script::/project/scripts/day2.json');
    });
});
