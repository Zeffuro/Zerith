import { lazy, type ReactNode, Suspense } from 'react';

import type { ScriptViewMode, WorkbenchResourceKind } from '../../store/workbench/types';

import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { Timeline } from './timeline/Timeline';

const ScriptJsonEditor = lazy(() => import('./workbench/ScriptJsonEditor').then((m) => ({ default: m.ScriptJsonEditor })));
const ManifestEditor = lazy(() => import('./workbench/ManifestEditor').then((m) => ({ default: m.ManifestEditor })));
const EngineConfigEditor = lazy(() => import('./workbench/EngineConfigEditor').then((m) => ({ default: m.EngineConfigEditor })));
const ItemsEditor = lazy(() => import('./workbench/ItemsEditor').then((m) => ({ default: m.ItemsEditor })));
const CharactersEditor = lazy(() => import('./workbench/CharactersEditor').then((m) => ({ default: m.CharactersEditor })));
const SpritesheetEditorPanel = lazy(() => import('../editors/SpritesheetEditorPanel').then((m) => ({ default: m.SpritesheetEditorPanel })));
const AudiosheetEditorPanel = lazy(() => import('../editors/AudiosheetEditorPanel').then((m) => ({ default: m.AudiosheetEditorPanel })));

type ToggleableWorkbenchKind = Extract<WorkbenchResourceKind, 'characters' | 'engineConfig' | 'items' | 'macros' | 'manifest' | 'script'>;

type ViewToggleToolbarProperties = {
    currentView: ScriptViewMode;
    onToggle: (view: ScriptViewMode) => void;
    timelineLabel?: 'Timeline' | 'Visual';
    uiScale: number;
};


export function EditorSurface() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const activeTab = useWorkbenchStore((s) => s.activeTab());
    const lastScriptView = useWorkbenchStore((s) => s.lastScriptView);
    const lastMacrosView = useWorkbenchStore((s) => s.lastMacrosView);
    const lastManifestView = useWorkbenchStore((s) => s.lastManifestView);
    const lastEngineConfigView = useWorkbenchStore((s) => s.lastEngineConfigView);
    const lastItemsView = useWorkbenchStore((s) => s.lastItemsView);
    const lastCharactersView = useWorkbenchStore((s) => s.lastCharactersView);
    const lastSpritesheetView = useWorkbenchStore((s) => s.lastSpritesheetView);
    const lastAudiosheetView = useWorkbenchStore((s) => s.lastAudiosheetView);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);
    const setLastManifestView = useWorkbenchStore((s) => s.setLastManifestView);
    const setLastEngineConfigView = useWorkbenchStore((s) => s.setLastEngineConfigView);
    const setLastItemsView = useWorkbenchStore((s) => s.setLastItemsView);
    const setLastCharactersView = useWorkbenchStore((s) => s.setLastCharactersView);
    const setLastSpritesheetView = useWorkbenchStore((s) => s.setLastSpritesheetView);
    const setLastAudiosheetView = useWorkbenchStore((s) => s.setLastAudiosheetView);

    const jsonEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading JSON editor...</div>}>
            <ScriptJsonEditor uiScale={uiScale} />
        </Suspense>
    );

    const manifestEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Manifest editor...</div>}>
            <ManifestEditor uiScale={uiScale} />
        </Suspense>
    );

    const itemsEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Items editor...</div>}>
            <ItemsEditor uiScale={uiScale} />
        </Suspense>
    );

    const engineConfigEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Engine Config editor...</div>}>
            <EngineConfigEditor uiScale={uiScale} />
        </Suspense>
    );

    const charactersEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Characters editor...</div>}>
            <CharactersEditor uiScale={uiScale} />
        </Suspense>
    );

    if (!activeTab) return <div style={{ opacity: 0.7, padding: 16 }}>Open a file from Explorer.</div>;

    const kindEditorMap: Record<
        ToggleableWorkbenchKind,
        {
            currentView: ScriptViewMode;
            editor: ReactNode;
            onToggle: (view: ScriptViewMode) => void;
            timelineLabel: 'Timeline' | 'Visual';
        }
    > = {
        characters: {
            currentView: lastCharactersView,
            editor: charactersEditor,
            onToggle: setLastCharactersView,
            timelineLabel: 'Visual',
        },
        engineConfig: {
            currentView: lastEngineConfigView,
            editor: engineConfigEditor,
            onToggle: setLastEngineConfigView,
            timelineLabel: 'Visual',
        },
        items: {
            currentView: lastItemsView,
            editor: itemsEditor,
            onToggle: setLastItemsView,
            timelineLabel: 'Visual',
        },
        macros: {
            currentView: lastMacrosView,
            editor: <Timeline />,
            onToggle: setLastMacrosView,
            timelineLabel: 'Timeline',
        },
        manifest: {
            currentView: lastManifestView,
            editor: manifestEditor,
            onToggle: setLastManifestView,
            timelineLabel: 'Visual',
        },
        script: {
            currentView: lastScriptView,
            editor: <Timeline />,
            onToggle: setLastScriptView,
            timelineLabel: 'Timeline',
        },
    };

    if (activeTab.kind === 'asset') return <AssetPreviewPanel uiScale={uiScale} />;

    if (activeTab.kind in kindEditorMap) {
        const kindEditor = kindEditorMap[activeTab.kind as ToggleableWorkbenchKind];

        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                <ViewToggleToolbar
                    currentView={kindEditor.currentView}
                    onToggle={kindEditor.onToggle}
                    timelineLabel={kindEditor.timelineLabel}
                    uiScale={uiScale}
                />
                {kindEditor.currentView === 'json' ? jsonEditor : kindEditor.editor}
            </div>
        );
    }

    if (activeTab.kind === 'spritesheet') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                <ViewToggleToolbar currentView={lastSpritesheetView} onToggle={setLastSpritesheetView} timelineLabel="Visual" uiScale={uiScale} />
                {lastSpritesheetView === 'json' ? (
                    jsonEditor
                ) : (
                    <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Spritesheet editor...</div>}>
                        <SpritesheetEditorPanel tab={activeTab} />
                    </Suspense>
                )}
            </div>
        );
    }

    if (activeTab.kind === 'audiosheet') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                <ViewToggleToolbar currentView={lastAudiosheetView} onToggle={setLastAudiosheetView} timelineLabel="Visual" uiScale={uiScale} />
                {lastAudiosheetView === 'json' ? (
                    jsonEditor
                ) : (
                    <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Audiosheet editor...</div>}>
                        <AudiosheetEditorPanel tab={activeTab} />
                    </Suspense>
                )}
            </div>
        );
    }

    return jsonEditor;
}

function ViewToggleToolbar({ currentView, onToggle, timelineLabel = 'Timeline', uiScale }: ViewToggleToolbarProperties) {
    const viewButton = (active: boolean) => ({
        background: active ? t.bg.selected : t.bg.panel,
        border: `1px solid ${active ? t.border.accent : t.border.button}`,
        borderRadius: t.radius.sm,
        color: active ? t.text.primary : t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${4 * uiScale}px ${10 * uiScale}px`,
    });

    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.panel,
                borderBottom: `1px solid ${t.border.subtle}`,
                display: 'flex',
                gap: `${6 * uiScale}px`,
                padding: `${6 * uiScale}px`,
            }}
        >
            <button onClick={() => onToggle('timeline')} style={viewButton(currentView === 'timeline')}>
                {timelineLabel}
            </button>
            <button onClick={() => onToggle('json')} style={viewButton(currentView === 'json')}>
                JSON
            </button>
            <span style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginLeft: 8 }}>Current: {currentView}</span>
        </div>
    );
}

