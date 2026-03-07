import { useMemo, useRef, useState } from 'react';
import { MenuButton } from './MenuButton';
import { MenuDropdown, type MenuItem } from './MenuDropdown';
import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { open } from '@tauri-apps/plugin-dialog';
import { editorTheme as t } from '../../../theme/editorTheme';

type MenuKey = 'File' | 'Edit' | 'View' | 'Run' | 'Help';

export function MenuBar({ uiScale }: { uiScale: number }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const[openMenu, setOpenMenu] = useState<MenuKey | null>(null);

    const {
        setUiScale,
        uiScale: currentScale,
        triggerPlay,
        triggerStop,
        resetDockLayout,
        themeKey,
        setThemeKey,
    } = useEditorStore();

    const { openProjectFromManifest, activeFile, saveActiveFileFromCurrentScript } = useProjectStore();

    useDismissiblePopup(!!openMenu, rootRef, () => setOpenMenu(null));

    const handleOpenProject = async () => {
        try {
            const selectedFile = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'Game Manifest', extensions: ['json'] }],
                title: 'Select game.json',
            });

            if (selectedFile && typeof selectedFile === 'string') {
                await openProjectFromManifest(selectedFile);
            }
        } catch (err) {
            console.error('Failed to open project dialog:', err);
        }
    };

    const handleSave = async () => {
        if (!activeFile) return;
        await saveActiveFileFromCurrentScript();
    };

    const fileItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Open Project…', shortcut: 'Ctrl+O', onClick: handleOpenProject },
            { label: 'Save', shortcut: 'Ctrl+S', onClick: handleSave, disabled: !activeFile },
            { separator: true, label: 'sep-1' },
            { label: 'Reset Layout', onClick: resetDockLayout },
        ],[activeFile, handleOpenProject, handleSave, resetDockLayout]
    );

    const editItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Undo', shortcut: 'Ctrl+Z', disabled: false },
            { label: 'Redo', shortcut: 'Ctrl+Y', disabled: false },
            { separator: true, label: 'sep-2' },
            { label: 'Copy', shortcut: 'Ctrl+C', disabled: false },
            { label: 'Paste', shortcut: 'Ctrl+V', disabled: false },
        ],[]
    );

    const viewItems = useMemo<MenuItem[]>(
        () =>[
            { separator: true, label: 'sep-3' },
            { label: 'Zoom In', shortcut: 'Ctrl+=', onClick: () => setUiScale(Math.min(1.5, currentScale + 0.1)) },
            { label: 'Zoom Out', shortcut: 'Ctrl+-', onClick: () => setUiScale(Math.max(0.8, currentScale - 0.1)) },
            { label: 'Reset Zoom', shortcut: 'Ctrl+0', onClick: () => setUiScale(1.0) },
            { separator: true, label: 'sep-4' },
            { label: `Theme: ${themeKey}`, submenuLabel: 'Select' },
            { label: 'Classic', onClick: () => setThemeKey('classic') },
            { label: 'Classic Soft', onClick: () => setThemeKey('classicSoft') },
        ],
        [currentScale, themeKey, setUiScale, setThemeKey]
    );

    const runItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Play', shortcut: 'F5', onClick: triggerPlay },
            { label: 'Stop', shortcut: 'Shift+F5', onClick: triggerStop },
        ],
        [triggerPlay, triggerStop]
    );

    const helpItems = useMemo<MenuItem[]>(
        () =>[{ label: 'About Zerith Editor', disabled: true }],
        []
    );

    const menuMap: Record<MenuKey, MenuItem[]> = {
        File: fileItems,
        Edit: editItems,
        View: viewItems,
        Run: runItems,
        Help: helpItems,
    };

    const keys: MenuKey[] =['File', 'Edit', 'View', 'Run', 'Help'];

    return (
        <div
            ref={rootRef}
            style={{
                height: `${28 * uiScale}px`,
                minHeight: `${28 * uiScale}px`,
                display: 'flex',
                alignItems: 'center',
                gap: `${2 * uiScale}px`,
                padding: `0 ${8 * uiScale}px`,
                background: t.bg.panelAlt,
                borderBottom: `1px solid ${t.border.subtle}`,
                position: 'relative',
                zIndex: 3000,
            }}
        >
            {keys.map((k) => (
                <MenuButton
                    key={k}
                    uiScale={uiScale}
                    label={k}
                    active={openMenu === k}
                    onClick={() => setOpenMenu((prev) => (prev === k ? null : k))}
                >
                    <MenuDropdown uiScale={uiScale} items={menuMap[k]} />
                </MenuButton>
            ))}
        </div>
    );
}