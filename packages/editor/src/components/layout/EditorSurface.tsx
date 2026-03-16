import { lazy, Suspense } from 'react';

import type { ScriptViewMode } from '../../store/workbench/types';

import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { Timeline } from './timeline/Timeline';

const ScriptJsonEditor = lazy(() => import('./workbench/ScriptJsonEditor').then((m) => ({ default: m.ScriptJsonEditor })));
const ManifestEditor = lazy(() => import('./workbench/ManifestEditor').then((m) => ({ default: m.ManifestEditor })));
const ItemsEditor = lazy(() => import('./workbench/ItemsEditor').then((m) => ({ default: m.ItemsEditor })));
const CharactersEditor = lazy(() => import('./workbench/CharactersEditor').then((m) => ({ default: m.CharactersEditor })));
const SpritesheetEditorPanel = lazy(() => import('../editors/SpritesheetEditorPanel').then((m) => ({ default: m.SpritesheetEditorPanel })));
const AudiosheetEditorPanel = lazy(() => import('../editors/AudiosheetEditorPanel').then((m) => ({ default: m.AudiosheetEditorPanel })));

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
    const lastItemsView = useWorkbenchStore((s) => s.lastItemsView);
    const lastCharactersView = useWorkbenchStore((s) => s.lastCharactersView);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);
    const setLastManifestView = useWorkbenchStore((s) => s.setLastManifestView);
    const setLastItemsView = useWorkbenchStore((s) => s.setLastItemsView);
    const setLastCharactersView = useWorkbenchStore((s) => s.setLastCharactersView);

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

    const charactersEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Characters editor...</div>}>
            <CharactersEditor uiScale={uiScale} />
        </Suspense>
    );

    if (!activeTab) return <div style={{ opacity: 0.7, padding: 16 }}>Open a file from Explorer.</div>;

    const renderModeToggle = (kind: 'characters' | 'items' | 'macros' | 'manifest' | 'script') => {
        const currentViewByKind = {
            characters: lastCharactersView,
            items: lastItemsView,
            macros: lastMacrosView,
            manifest: lastManifestView,
            script: lastScriptView,
        } as const;
        const onToggleByKind = {
            characters: setLastCharactersView,
            items: setLastItemsView,
            macros: setLastMacrosView,
            manifest: setLastManifestView,
            script: setLastScriptView,
        } as const;

        const currentView = currentViewByKind[kind];
        const onToggle = onToggleByKind[kind];
        const timelineLabel = kind === 'script' || kind === 'macros' ? 'Timeline' : 'Visual';

        return <ViewToggleToolbar currentView={currentView} onToggle={onToggle} timelineLabel={timelineLabel} uiScale={uiScale} />;
    };

    if (activeTab.kind === 'asset') return <AssetPreviewPanel uiScale={uiScale} />;

    if (activeTab.kind === 'script') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                {renderModeToggle('script')}
                {lastScriptView === 'json' ? jsonEditor : <Timeline />}
            </div>
        );
    }

    if (activeTab.kind === 'macros') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                {renderModeToggle('macros')}
                {lastMacrosView === 'json' ? jsonEditor : <Timeline />}
            </div>
        );
    }

    if (activeTab.kind === 'manifest') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                {renderModeToggle('manifest')}
                {lastManifestView === 'json' ? jsonEditor : manifestEditor}
            </div>
        );
    }

    if (activeTab.kind === 'items') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                {renderModeToggle('items')}
                {lastItemsView === 'json' ? jsonEditor : itemsEditor}
            </div>
        );
    }

    if (activeTab.kind === 'characters') {
        return (
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
                {renderModeToggle('characters')}
                {lastCharactersView === 'json' ? jsonEditor : charactersEditor}
            </div>
        );
    }

    if (activeTab.kind === 'spritesheet') {
        return (
            <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Spritesheet editor...</div>}>
                <SpritesheetEditorPanel tab={activeTab} />
            </Suspense>
        );
    }

    if (activeTab.kind === 'audiosheet') {
        return (
            <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading Audiosheet editor...</div>}>
                <AudiosheetEditorPanel tab={activeTab} />
            </Suspense>
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

