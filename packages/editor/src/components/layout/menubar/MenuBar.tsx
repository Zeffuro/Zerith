import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { MenuButton } from './MenuButton';
import { MenuDropdown, type MenuItem } from './MenuDropdown';

type MenuKey = 'Edit' | 'File' | 'Help' | 'Run' | 'View';

export function MenuBar({ uiScale }: { uiScale: number }) {
    const rootReference = useRef<HTMLDivElement>(null);
    const[openMenu, setOpenMenu] = useState<MenuKey | null>(null);

    const {
        resetDockLayout,
        setThemeKey,
        setUiScale,
        themeKey,
        triggerPlay,
        triggerStop,
        uiScale: currentScale,
    } = useEditorStore();

    const { activeFile, openProjectFromManifest, saveActiveFileFromCurrentScript } = useProjectStore();

    useDismissiblePopup(!!openMenu, rootReference, () => setOpenMenu(null));

    const handleOpenProject = useCallback(async () => {
        try {
            const selectedFile = await open({
                directory: false,
                filters: [{ extensions: ['json'], name: 'Game Manifest' }],
                multiple: false,
                title: 'Select game.json',
            });

            if (selectedFile) {
                await openProjectFromManifest(selectedFile);
            }
        } catch (error) {
            console.error('Failed to open project dialog:', error);
        }
    }, [openProjectFromManifest]);

    const handleSave = useCallback(async () => {
        if (!activeFile) return;
        await saveActiveFileFromCurrentScript();
    }, [activeFile, saveActiveFileFromCurrentScript]);

    const fileItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Open Project…', onClick: handleOpenProject, shortcut: 'Ctrl+O' },
            { disabled: !activeFile, label: 'Save', onClick: handleSave, shortcut: 'Ctrl+S' },
            { label: 'sep-1', separator: true },
            { label: 'Reset Layout', onClick: resetDockLayout },
        ],[activeFile, handleOpenProject, handleSave, resetDockLayout]
    );

    const editItems = useMemo<MenuItem[]>(
        () =>[
            { disabled: false, label: 'Undo', shortcut: 'Ctrl+Z' },
            { disabled: false, label: 'Redo', shortcut: 'Ctrl+Y' },
            { label: 'sep-2', separator: true },
            { disabled: false, label: 'Copy', shortcut: 'Ctrl+C' },
            { disabled: false, label: 'Paste', shortcut: 'Ctrl+V' },
        ],[]
    );

    const viewItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'sep-3', separator: true },
            { label: 'Zoom In', onClick: () => setUiScale(Math.min(1.5, currentScale + 0.1)), shortcut: 'Ctrl+=' },
            { label: 'Zoom Out', onClick: () => setUiScale(Math.max(0.8, currentScale - 0.1)), shortcut: 'Ctrl+-' },
            { label: 'Reset Zoom', onClick: () => setUiScale(1), shortcut: 'Ctrl+0' },
            { label: 'sep-4', separator: true },
            { label: `Theme: ${themeKey}`, submenuLabel: 'Select' },
            { label: 'Classic', onClick: () => setThemeKey('classic') },
            { label: 'Classic Soft', onClick: () => setThemeKey('classicSoft') },
        ],
        [currentScale, themeKey, setUiScale, setThemeKey]
    );

    const runItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Play', onClick: triggerPlay, shortcut: 'F5' },
            { label: 'Stop', onClick: triggerStop, shortcut: 'Shift+F5' },
        ],
        [triggerPlay, triggerStop]
    );

    const helpItems = useMemo<MenuItem[]>(
        () =>[{ disabled: true, label: 'About Zerith Editor' }],
        []
    );

    const menuMap: Record<MenuKey, MenuItem[]> = {
        Edit: editItems,
        File: fileItems,
        Help: helpItems,
        Run: runItems,
        View: viewItems,
    };

    const keys: MenuKey[] =['File', 'Edit', 'View', 'Run', 'Help'];

    return (
        <div
            ref={rootReference}
            style={{
                alignItems: 'center',
                background: t.bg.panelAlt,
                borderBottom: `1px solid ${t.border.subtle}`,
                display: 'flex',
                gap: `${2 * uiScale}px`,
                height: `${28 * uiScale}px`,
                minHeight: `${28 * uiScale}px`,
                padding: `0 ${8 * uiScale}px`,
                position: 'relative',
                zIndex: 3000,
            }}
        >
            {keys.map((k) => (
                <MenuButton
                    active={openMenu === k}
                    key={k}
                    label={k}
                    onClick={() => setOpenMenu((previous) => (previous === k ? null : k))}
                    uiScale={uiScale}
                >
                    <MenuDropdown items={menuMap[k]} uiScale={uiScale} />
                </MenuButton>
            ))}
        </div>
    );
}