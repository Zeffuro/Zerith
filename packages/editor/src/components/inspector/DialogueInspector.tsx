import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';

export function DialogueInspector({ node, index }: { node: any, index: number }) {
    const { getActiveScript, updateActiveScript } = useScriptStore();
    const uiScale = useEditorStore(state => state.uiScale);

    const handleChange = (field: string, value: any) => {
        const script = getActiveScript();
        const newScript = script.map((n, i) => i === index ? { ...n, [field]: value } : n);
        updateActiveScript(newScript);
    };

    const renderPreview = (text: string) => {
        if (!text) return null;
        let html = text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\{wait:(\d+)}/g, '<span style="color: #fbbf24; font-size: 10px; border: 1px solid #fbbf24; padding: 0 2px; border-radius: 3px;">WAIT $1</span>')
            .replace(/\{color='(.+?)'}(.*?)\{\/color}/g, '<span style="color: $1">$2</span>')
            .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
            .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>');

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: `${11 * uiScale}px` };
    const inputStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', fontSize: 'inherit', outline: 'none' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Speaker</label>
                <input
                    type="text" value={node.speaker || ''}
                    onChange={e => handleChange('speaker', e.target.value)}
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>Text</label>
                <textarea
                    value={node.text || ''}
                    onChange={e => handleChange('text', e.target.value)}
                    rows={5}
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
            </div>

            <div style={{ padding: '8px', backgroundColor: '#111', border: '1px solid #333', borderRadius: '4px' }}>
                <label style={{ ...labelStyle, marginBottom: '4px' }}>Text Preview</label>
                <div style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.4' }}>
                    {renderPreview(node.text)}
                </div>
            </div>
        </div>
    );
}

