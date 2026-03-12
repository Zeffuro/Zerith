import { lazy, Suspense } from 'react';

import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { Timeline } from './timeline/Timeline';

const ScriptJsonEditor = lazy(() => import('./workbench/ScriptJsonEditor').then((m) => ({ default: m.ScriptJsonEditor })));
const ManifestEditor = lazy(() => import('./workbench/ManifestEditor').then((m) => ({ default: m.ManifestEditor })));
const ItemsEditor = lazy(() => import('./workbench/ItemsEditor').then((m) => ({ default: m.ItemsEditor })));
const CharactersEditor = lazy(() => import('./workbench/CharactersEditor').then((m) => ({ default: m.CharactersEditor })));

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

    const viewButton = (active: boolean) => ({
        background: active ? t.bg.selected : t.bg.panel,
        border: `1px solid ${active ? t.border.accent : t.border.button}`,
        borderRadius: t.radius.sm,
        color: active ? t.text.primary : t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${4 * uiScale}px ${10 * uiScale}px`,
    });

    const renderModeToggle = (kind: 'characters' | 'items' | 'macros' | 'manifest' | 'script') => {
        const mode = getMode(kind, {
            characters: lastCharactersView,
            items: lastItemsView,
            macros: lastMacrosView,
            manifest: lastManifestView,
            script: lastScriptView,
        });
        const setMode = getModeSetter(kind, {
            characters: setLastCharactersView,
            items: setLastItemsView,
            macros: setLastMacrosView,
            manifest: setLastManifestView,
            script: setLastScriptView,
        });
        const visualLabel = kind === 'script' || kind === 'macros' ? 'Timeline' : 'Visual';

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
                <button onClick={() => setMode('timeline')} style={viewButton(mode === 'timeline')}>
                    {visualLabel}
                </button>
                <button onClick={() => setMode('json')} style={viewButton(mode === 'json')}>
                    JSON
                </button>
                <span style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginLeft: 8 }}>
                Current: {mode}
            </span>
            </div>
        );
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

    return jsonEditor;
}

function getMode(
    kind: 'characters' | 'items' | 'macros' | 'manifest' | 'script',
    modeByKind: Record<'characters' | 'items' | 'macros' | 'manifest' | 'script', 'json' | 'timeline'>
) {
    return modeByKind[kind];
}

function getModeSetter(
    kind: 'characters' | 'items' | 'macros' | 'manifest' | 'script',
    setterByKind: Record<'characters' | 'items' | 'macros' | 'manifest' | 'script', (view: 'json' | 'timeline') => void>
) {
    return setterByKind[kind];
}
