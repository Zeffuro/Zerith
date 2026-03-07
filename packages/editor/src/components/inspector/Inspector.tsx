import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useProjectStore } from '../../store/useProjectStore';
import { getPlugin } from '../../editor/commandPlugins';
import { SchemaFallbackInspector } from './SchemaFallbackInspector';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

function getAtPath(root: any, path: Array<string | number>) {
    let cur = root;
    for (const key of path) {
        if (cur == null) return null;
        cur = cur[key as any];
    }
    return cur ?? null;
}

export function Inspector() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const { getActiveScript, selectedNodeIndex, selectedNodePath, getNodeAtPath } = useScriptStore();

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);

    const script = getActiveScript();

    let node: any = null;

    if (editingAllMacrosFile) {
        const path = selectedNodePaths[0] ?? selectedNodePath;
        if (path && typeof path[0] === 'number') {
            const macroIdx = path[0] as number;
            const macro = macroEntries[macroIdx];
            if (macro) {
                const syntheticRoot = { type: 'macro_header', name: macro.name, body: macro.commands };
                node = path.length === 1 ? syntheticRoot : getAtPath(syntheticRoot, path.slice(1));
            }
        }
    } else {
        if (selectedNodePath) node = getNodeAtPath(selectedNodePath);
        else if (selectedNodeIndex !== null && script[selectedNodeIndex]) node = script[selectedNodeIndex];
    }

    if (!node) {
        return (
            <div style={{ padding: `${16 * uiScale}px`, height: '100%', backgroundColor: t.bg.app }}>
                <p
                    style={{
                        fontSize: 'inherit',
                        color: t.text.faint,
                        fontStyle: 'italic',
                        textAlign: 'center',
                        marginTop: '20px',
                    }}
                >
                    Select a node to edit.
                </p>
            </div>
        );
    }

    const plugin = getPlugin(node.type);
    const PluginInspector = plugin.Inspector;

    return (
        <div
            className="zerith-scrollbar"
            style={{
                padding: `${16 * uiScale}px`,
                height: '100%',
                overflowY: 'auto',
                backgroundColor: t.bg.app
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${16 * uiScale}px`, fontSize: 'inherit' }}>
                <div style={styles.panelHeaderRow}>
                    <span style={{ color: t.text.faint, fontSize: '0.85em', fontWeight: 'bold' }}>NODE TYPE</span>
                    <span
                        style={{
                            color: '#aaa',
                            fontSize: '0.85em',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                        }}
                    >
                        {node.type}
                    </span>
                </div>

                {PluginInspector ? <PluginInspector node={node} index={selectedNodeIndex} /> : <SchemaFallbackInspector node={node} index={selectedNodeIndex} />}
            </div>
        </div>
    );
}

export default Inspector;