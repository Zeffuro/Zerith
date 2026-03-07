import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { useEditorStore } from '../../store/useEditorStore';
import { Timeline } from './Timeline';
import { ScriptJsonEditor } from './ScriptJsonEditor';
import { AssetPreviewPanel } from '../tools/AssetPreviewPanel';
import { editorTheme as t } from '../../theme/editorTheme';

export function EditorSurface() {
    const uiScale = useEditorStore((s) => s.uiScale);
    const activeTab = useWorkbenchStore((s) => s.activeTab());
    const lastScriptView = useWorkbenchStore((s) => s.lastScriptView);
    const lastMacrosView = useWorkbenchStore((s) => s.lastMacrosView);
    const setLastScriptView = useWorkbenchStore((s) => s.setLastScriptView);
    const setLastMacrosView = useWorkbenchStore((s) => s.setLastMacrosView);

    if (!activeTab) return <div style={{ padding: 16, opacity: 0.7 }}>Open a file from Explorer.</div>;

    const viewBtn = (active: boolean) => ({
        border: `1px solid ${active ? t.border.accent : t.border.button}`,
        background: active ? t.bg.selected : t.bg.panel,
        color: active ? t.text.primary : t.text.normal,
        borderRadius: t.radius.sm,
        padding: `${4 * uiScale}px ${10 * uiScale}px`,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
    });

    const renderModeToggle = (kind: 'script' | 'macros') => {
        const mode = kind === 'script' ? lastScriptView : lastMacrosView;
        const setMode = kind === 'script' ? setLastScriptView : setLastMacrosView;

        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${6 * uiScale}px`,
                    padding: `${6 * uiScale}px`,
                    borderBottom: `1px solid ${t.border.subtle}`,
                    background: t.bg.panel,
                }}
            >
                <button onClick={() => setMode('timeline')} style={viewBtn(mode === 'timeline')}>
                    Timeline
                </button>
                <button onClick={() => setMode('json')} style={viewBtn(mode === 'json')}>
                    JSON
                </button>
                <span style={{ marginLeft: 8, color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Current: {mode}
            </span>
            </div>
        );
    };

    if (activeTab.kind === 'asset') return <AssetPreviewPanel uiScale={uiScale} />;

    if (activeTab.kind === 'script') {
        return (
            <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                {renderModeToggle('script')}
                {lastScriptView === 'json' ? <ScriptJsonEditor uiScale={uiScale} /> : <Timeline />}
            </div>
        );
    }

    if (activeTab.kind === 'macros') {
        return (
            <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                {renderModeToggle('macros')}
                {lastMacrosView === 'json' ? <ScriptJsonEditor uiScale={uiScale} /> : <Timeline />}
            </div>
        );
    }

    return <ScriptJsonEditor uiScale={uiScale} />;
}