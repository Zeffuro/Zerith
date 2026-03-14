import { beforeEach, describe, expect, it, vi } from 'vitest';

type OpenInitialProjectEntryCall = {
    expandToPath: (path: string) => void;
    manifest: { scenes?: Record<string, unknown>; startScene?: string } | undefined;
    openProjectEntry: (path: string, name: string) => Promise<void>;
    projectPath: string | undefined;
};

const { openInitialProjectEntryMock } = vi.hoisted(() => ({
    openInitialProjectEntryMock: vi.fn<(arguments_: OpenInitialProjectEntryCall) => Promise<void>>(async () => {}),
}));

vi.mock('../commandPaletteProjectEntry', () => ({
    openInitialProjectEntry: openInitialProjectEntryMock,
}));

import { buildCommandPaletteInitialProjectEntryHandler } from '../commandPaletteInitialProjectEntryAdapterModel';

describe('commandPaletteInitialProjectEntryAdapterModel', () => {
    beforeEach(() => {
        openInitialProjectEntryMock.mockReset();
    });

    it('reads current project state each call and passes state through to openInitialProjectEntry', async () => {
        const getProjectState = vi.fn()
            .mockReturnValueOnce({
                expandToPath: vi.fn(),
                manifest: { scenes: { intro: 'scripts/intro.json' }, startScene: 'intro' },
                projectPath: '/project-a',
            })
            .mockReturnValueOnce({
                expandToPath: vi.fn(),
                manifest: { scenes: { intro: 'scripts/intro.json' }, startScene: 'intro' },
                projectPath: '/project-b',
            });

        const openProjectEntryService = vi.fn(async () => {});
        const handler = buildCommandPaletteInitialProjectEntryHandler({
            getProjectState,
            openProjectEntryService,
        });

        await handler();
        await handler();

        expect(getProjectState).toHaveBeenCalledTimes(2);
        expect(openInitialProjectEntryMock).toHaveBeenCalledTimes(2);
        const firstCall = openInitialProjectEntryMock.mock.calls.at(0)?.[0];
        const secondCall = openInitialProjectEntryMock.mock.calls.at(1)?.[0];

        expect(firstCall).toMatchObject({
            projectPath: '/project-a',
        });
        expect(secondCall).toMatchObject({
            projectPath: '/project-b',
        });
    });

    it('forwards openProjectEntry callback arguments to service unchanged', async () => {
        const expandToPath = vi.fn();
        const getProjectState = vi.fn(() => ({
            expandToPath,
            manifest: undefined,
            projectPath: '/project',
        }));
        const openProjectEntryService = vi.fn(async () => {});

        openInitialProjectEntryMock.mockImplementationOnce(async ({ openProjectEntry }: OpenInitialProjectEntryCall) => {
            await openProjectEntry('/project/game.json', 'game.json');
        });

        const handler = buildCommandPaletteInitialProjectEntryHandler({
            getProjectState,
            openProjectEntryService,
        });

        await handler();

        expect(openProjectEntryService).toHaveBeenCalledTimes(1);
        expect(openProjectEntryService).toHaveBeenCalledWith('/project/game.json', 'game.json');
    });

    it('does not call service before openInitialProjectEntry invokes callback', async () => {
        const getProjectState = vi.fn(() => ({
            expandToPath: vi.fn(),
            manifest: undefined,
            projectPath: '/project',
        }));
        const openProjectEntryService = vi.fn(async () => {});

        openInitialProjectEntryMock.mockImplementationOnce(async () => {
            // no-op; callback intentionally not invoked
        });

        const handler = buildCommandPaletteInitialProjectEntryHandler({
            getProjectState,
            openProjectEntryService,
        });

        await handler();

        expect(openProjectEntryService).not.toHaveBeenCalled();
    });
});

