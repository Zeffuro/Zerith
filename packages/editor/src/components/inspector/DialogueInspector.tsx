import { Bold, Clock, FastForward, Italic, Palette, Underline } from 'lucide-react';
import type { DialogueCommand } from 'core';
import { useRef } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { FieldError } from './FieldError';

export function DialogueInspector({ index, node }: { index?: null | number; node: DialogueCommand, }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, uiScale } = useInspectorFieldEditor(index);
    const speakerErrors = getFieldErrors('speaker');
    const textErrors = getFieldErrors('text');
    const textareaReference = useRef<HTMLTextAreaElement>(null);

    const { characters } = useProjectStore();
    const charKeys = Object.keys(characters);

    const insertTag = (before: string, after = '') => {
        const element = textareaReference.current;
        if (!element) return;
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const currentText = node.text || '';

        const newText = currentText.slice(0, Math.max(0, start)) + before + currentText.slice(start, end) + after + currentText.slice(Math.max(0, end));
        handleChange('text', newText);

        setTimeout(() => {
            element.focus();
            element.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const renderPreview = (text: string) => {
        if (!text) return null;
        const html = text
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll(/\{wait:(\d+)}/gi, '<span style="color: #fbbf24; font-size: 10px; border: 1px solid #fbbf24; padding: 0 2px; border-radius: 3px;">WAIT $1</span>')
            .replaceAll(/\{speed:(\d+)}/gi, '<span style="color: #34d399; font-size: 10px; border: 1px solid #34d399; padding: 0 2px; border-radius: 3px;">SPEED $1</span>')
            .replaceAll(/\{color=['"]?([^'"}]+)['"]?}(.*?)\{\/color}/gi, '<span style="color: $1">$2</span>')
            .replaceAll(/\{u color=['"]?([^'"}]+)['"]?}(.*?)\{\/u}/gi, '<span style="text-decoration: underline; text-decoration-color: $1; color: $1">$2</span>')
            .replaceAll(/\{u}(.*?)\{\/u}/gi, '<span style="text-decoration: underline;">$1</span>')
            .replaceAll(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<b>$1</b>')
            .replaceAll(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<i>$1</i>');

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const labelStyle = { color: '#888', display: 'block', fontSize: `${11 * uiScale}px`, marginBottom: `${6 * uiScale}px` };
    const buttonStyle = { alignItems: 'center', background: t.bg.panel, border: `1px solid ${t.border.subtle}`, borderRadius: '3px', color: t.text.normal, cursor: 'pointer', display: 'flex', padding: `${4 * uiScale}px` };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Speaker</label>
                <input
                    list="dialogue-character-ids"
                    onChange={(event) => handleChange('speaker', event.target.value)}
                    style={getFieldInputStyle('speaker')}
                    type="text"
                    value={node.speaker || ''}
                />
                <FieldError errors={speakerErrors} />
                <datalist id="dialogue-character-ids">
                    {charKeys.map((k) => <option key={k} value={k} />)}
                </datalist>
            </div>

            <div>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: `${6 * uiScale}px` }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Text</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => insertTag('<b>', '</b>')} style={buttonStyle} title="Bold"><Bold size={12 * uiScale} /></button>
                        <button onClick={() => insertTag('<i>', '</i>')} style={buttonStyle} title="Italic"><Italic size={12 * uiScale} /></button>
                        <button onClick={() => insertTag('{u}', '{/u}')} style={buttonStyle} title="Underline"><Underline size={12 * uiScale} /></button>
                        <button onClick={() => insertTag("{color='red'}", "{/color}")} style={buttonStyle} title="Color"><Palette size={12 * uiScale} /></button>
                        <button onClick={() => insertTag('{wait:1000}')} style={buttonStyle} title="Wait Delay"><Clock size={12 * uiScale} /></button>
                        <button onClick={() => insertTag('{speed:50}')} style={buttonStyle} title="Change Speed"><FastForward size={12 * uiScale} /></button>
                    </div>
                </div>
                <textarea
                    onChange={(event) => handleChange('text', event.target.value)}
                    ref={textareaReference}
                    rows={5}
                    style={{ ...getFieldInputStyle('text'), fontFamily: 'monospace' }}
                    value={node.text || ''}
                />
                <FieldError errors={textErrors} />
            </div>

            <div style={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '4px', padding: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: '4px' }}>Text Preview</label>
                <div style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.4' }}>
                    {renderPreview(node.text)}
                </div>
            </div>
        </div>
    );
}