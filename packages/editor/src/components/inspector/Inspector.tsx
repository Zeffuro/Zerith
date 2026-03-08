import { getPlugin } from '../../plugins/commandPlugins';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useScriptStore } from '../../store/useScriptStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';
import { getAtPath, type ScriptPath } from '../../utils/scriptPathUtils';
import { SchemaFallbackInspector } from './SchemaFallbackInspector';

export function Inspector() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const { getActiveScript, getNodeAtPath, selectedNodeIndex, selectedNodePath } = useScriptStore();

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);

    const script = getActiveScript();

    let node: any = null;

    if (editingAllMacrosFile) {
        const path = selectedNodePaths[0] ?? selectedNodePath;
        if (path && typeof path[0] === 'number') {
            const macroIndex = path[0];
            const macro = macroEntries[macroIndex];
            if (macro) {
                const syntheticRoot = { commands: macro.commands };
                node = path.length === 1 ? syntheticRoot : getAtPath(syntheticRoot, path.slice(1));
            }
        }
    } else if (selectedNodePath) {
        node = getNodeAtPath(selectedNodePath);
    } else if (selectedNodeIndex !== null && script[selectedNodeIndex]) {
        node = script[selectedNodeIndex];
    }

    if (!node) {
        return (
            <div style={{ backgroundColor: t.bg.app, height: '100%', padding: `${16 * uiScale}px` }}>
                <p
                    style={{
                        color: t.text.faint,
                        fontSize: 'inherit',
                        fontStyle: 'italic',
                        marginTop: '20px',
                        textAlign: 'center',
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
                backgroundColor: t.bg.app,
                height: '100%',
                overflowY: 'auto',
                padding: `${16 * uiScale}px`
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 'inherit', gap: `${16 * uiScale}px` }}>
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

                {PluginInspector ? <PluginInspector index={selectedNodeIndex} node={node} /> : <SchemaFallbackInspector index={selectedNodeIndex} node={node} />}
            </div>
        </div>
    );
}


export default Inspector;