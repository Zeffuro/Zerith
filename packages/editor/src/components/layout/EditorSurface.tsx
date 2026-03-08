import { lazy, Suspense } from 'react';

import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { Timeline } from './timeline/Timeline';

const ScriptJsonEditor = lazy(() => import('./workbench/ScriptJsonEditor').then((m) => ({ default: m.ScriptJsonEditor })));

export function EditorSurface() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const activeTab = useWorkbenchStore((s) => s.activeTab());
    const lastScriptView = useWorkbenchStore((s) => s.lastScriptView);
    const lastMacrosView = useWorkbenchStore((s) => s.lastMacrosView);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);

    const jsonEditor = (
        <Suspense fallback={<div style={{ opacity: 0.7, padding: 12 }}>Loading JSON editor...</div>}>
            <ScriptJsonEditor uiScale={uiScale} />
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

    const renderModeToggle = (kind: 'macros' | 'script') => {
        const mode = kind === 'script' ? lastScriptView : lastMacrosView;
        const setMode = kind === 'script' ? setLastScriptView : setLastMacrosView;

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
                    Timeline
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

    return jsonEditor;
}