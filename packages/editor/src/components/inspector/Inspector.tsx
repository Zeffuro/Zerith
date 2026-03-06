import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { getPlugin } from '../../editor/commandPlugins';
import { SchemaFallbackInspector } from './SchemaFallbackInspector';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

export function Inspector() {
    const uiScale = useEditorStore(state => state.uiScale);
    const {
        getActiveScript,
        selectedNodeIndex,
        selectedNodePath,
        getNodeAtPath,
    } = useScriptStore();

    const script = getActiveScript();

    let node: any = null;
    if (selectedNodePath) node = getNodeAtPath(selectedNodePath);
    else if (selectedNodeIndex !== null && script[selectedNodeIndex]) node = script[selectedNodeIndex];

    if (!node) {
        return (
            <p
                style={{
                    fontSize: 'inherit',
                    color: t.text.faint,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    marginTop: '20px'
                }}
            >
                Select a node to edit.
            </p>
        );
    }

    const plugin = getPlugin(node.type);
    const PluginInspector = plugin.Inspector;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${16 * uiScale}px`, fontSize: 'inherit' }}>
            <div style={styles.panelHeaderRow}>
                <span style={{ color: t.text.faint, fontSize: '0.85em', fontWeight: 'bold' }}>NODE TYPE</span>
                <span
                    style={{
                        color: '#aaa',
                        fontSize: '0.85em',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}
                >
                    {node.type}
                </span>
            </div>

            {PluginInspector ? (
                <PluginInspector node={node} index={selectedNodeIndex} />
            ) : (
                <SchemaFallbackInspector node={node} index={selectedNodeIndex} />
            )}
        </div>
    );
}