import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';

export function DialogueInspector({ node, index }: { node: any, index?: number | null }) {
    const { uiScale, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const speakerErrors = getFieldErrors('speaker');
    const textErrors = getFieldErrors('text');

    const labelStyle = {
        display: 'block',
        marginBottom: `${6 * uiScale}px`,
        color: '#888',
        fontSize: `${11 * uiScale}px`
    };

    const { characters } = useProjectStore();
    const charKeys = Object.keys(characters);

    const renderPreview = (text: string) => {
        if (!text) return null;
        const html = text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\{wait:(\d+)}/g, '<span style="color: #fbbf24; font-size: 10px; border: 1px solid #fbbf24; padding: 0 2px; border-radius: 3px;">WAIT $1</span>')
            .replace(/\{color='(.+?)'}(.*?)\{\/color}/g, '<span style="color: $1">$2</span>')
            .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
            .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>');

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Speaker</label>
                <input
                    type="text"
                    value={node.speaker || ''}
                    onChange={e => handleChange('speaker', e.target.value)}
                    list="dialogue-character-ids"
                    style={getFieldInputStyle('speaker')}
                />
                <FieldError errors={speakerErrors} />
                <datalist id="dialogue-character-ids">
                    {charKeys.map(k => <option key={k} value={k} />)}
                </datalist>
            </div>

            <div>
                <label style={labelStyle}>Text</label>
                <textarea
                    value={node.text || ''}
                    onChange={e => handleChange('text', e.target.value)}
                    rows={5}
                    style={{ ...getFieldInputStyle('text'), fontFamily: 'monospace' }}
                />
                <FieldError errors={textErrors} />
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