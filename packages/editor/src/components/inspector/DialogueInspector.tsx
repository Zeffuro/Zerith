import { useRef } from 'react';
import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';
import { Bold, Italic, Underline, Palette, Clock, FastForward } from 'lucide-react';
import { editorTheme as t } from '../../theme/editorTheme';

export function DialogueInspector({ node, index }: { node: any, index?: number | null }) {
    const { uiScale, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const speakerErrors = getFieldErrors('speaker');
    const textErrors = getFieldErrors('text');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { characters } = useProjectStore();
    const charKeys = Object.keys(characters);

    const insertTag = (before: string, after: string = '') => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const currentText = node.text || '';

        const newText = currentText.substring(0, start) + before + currentText.substring(start, end) + after + currentText.substring(end);
        handleChange('text', newText);

        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const renderPreview = (text: string) => {
        if (!text) return null;
        let html = text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\{wait:(\d+)}/gi, '<span style="color: #fbbf24; font-size: 10px; border: 1px solid #fbbf24; padding: 0 2px; border-radius: 3px;">WAIT $1</span>')
            .replace(/\{speed:(\d+)}/gi, '<span style="color: #34d399; font-size: 10px; border: 1px solid #34d399; padding: 0 2px; border-radius: 3px;">SPEED $1</span>')
            .replace(/\{color=['"]?([^'"}]+)['"]?}(.*?)\{\/color}/gi, '<span style="color: $1">$2</span>')
            .replace(/\{u color=['"]?([^'"}]+)['"]?}(.*?)\{\/u}/gi, '<span style="text-decoration: underline; text-decoration-color: $1; color: $1">$2</span>')
            .replace(/\{u}(.*?)\{\/u}/gi, '<span style="text-decoration: underline;">$1</span>')
            .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<b>$1</b>')
            .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<i>$1</i>');

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: `${11 * uiScale}px` };
    const btnStyle = { background: t.bg.panel, border: `1px solid ${t.border.subtle}`, color: t.text.normal, borderRadius: '3px', padding: `${4 * uiScale}px`, cursor: 'pointer', display: 'flex', alignItems: 'center' };

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${6 * uiScale}px` }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Text</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button style={btnStyle} onClick={() => insertTag('<b>', '</b>')} title="Bold"><Bold size={12 * uiScale} /></button>
                        <button style={btnStyle} onClick={() => insertTag('<i>', '</i>')} title="Italic"><Italic size={12 * uiScale} /></button>
                        <button style={btnStyle} onClick={() => insertTag('{u}', '{/u}')} title="Underline"><Underline size={12 * uiScale} /></button>
                        <button style={btnStyle} onClick={() => insertTag("{color='red'}", "{/color}")} title="Color"><Palette size={12 * uiScale} /></button>
                        <button style={btnStyle} onClick={() => insertTag('{wait:1000}')} title="Wait Delay"><Clock size={12 * uiScale} /></button>
                        <button style={btnStyle} onClick={() => insertTag('{speed:50}')} title="Change Speed"><FastForward size={12 * uiScale} /></button>
                    </div>
                </div>
                <textarea
                    ref={textareaRef}
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