import type { DialogueCommand } from 'core';

import { resolveLocalizedText } from 'core/utils/Localization';
import { Archive, Bold, Clock, FastForward, Italic, Languages, Palette, Underline, Volume2, Wand2, X } from 'lucide-react';
import { type ReactNode, useMemo, useRef } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { resolvePreviewLocaleBundle } from '../../services/localizationPreview';
import { openLocalizationWorkbenchTab } from '../../services/localizationWorkbench';
import { useProjectStore, useScriptStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { minimumInteractiveTargetSize } from '../../theme/styleHelpers';
import {
    buildGeneratedDialogueLineId,
    createDialogueVoiceValue,
    readDialogueBacklogVisibility,
    readDialogueVoiceDraft,
    summarizeDialogueLineId,
} from './dialogueInspectorModel';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function DialogueInspector({ index, node }: { index?: null | number; node: DialogueCommand, }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const lineIdErrors = getFieldErrors('lineId');
    const speakerErrors = getFieldErrors('speaker');
    const textErrors = getFieldErrors('text');
    const textareaReference = useRef<HTMLTextAreaElement>(null);
    const selectedNodePath = useScriptStore((state) => state.selectedNodePath);

    const {
        activeFile,
        characters,
        locales,
        manifest,
        projectPath,
        sceneNamespaces,
        scenePaths,
    } = useProjectStore();
    const previewLocale = useEditorStore((state) => state.previewLocale);
    const charKeys = Object.keys(characters);
    const dialogueMetadata = node as DialogueCommand & Record<string, unknown>;
    const lineId = typeof node.lineId === 'string' ? node.lineId : '';
    const backlogVisibility = readDialogueBacklogVisibility(dialogueMetadata.backlogVisibility);
    const voiceDraft = readDialogueVoiceDraft(dialogueMetadata.voice);
    const hasVoiceAttachment = Boolean(voiceDraft.assetUrl.trim());
    const activeSceneName = useMemo(
        () => findSceneNameByPath(scenePaths, activeFile),
        [activeFile, scenePaths],
    );
    const namespace = activeSceneName
        ? sceneNamespaces[activeSceneName] ?? `scene.${activeSceneName}`
        : undefined;
    const previewBundle = useMemo(
        () => resolvePreviewLocaleBundle(locales, previewLocale, manifest?.localization?.defaultLocale),
        [locales, manifest?.localization?.defaultLocale, previewLocale],
    );
    const localizedText = lineId && previewBundle.bundle
        ? resolveLocalizedText(previewBundle.bundle, lineId, { namespace })
        : undefined;
    const generatedLineId = useMemo(
        () => buildGeneratedDialogueLineId(namespace, selectedNodePath),
        [namespace, selectedNodePath],
    );
    const lineIdSummary = useMemo(
        () => summarizeDialogueLineId(lineId, generatedLineId),
        [generatedLineId, lineId],
    );

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
        if (!text) return;
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

    const buttonStyle = { alignItems: 'center', background: t.bg.panel, border: `1px solid ${t.border.subtle}`, borderRadius: '3px', color: t.text.normal, cursor: 'pointer', display: 'flex', minHeight: `${minimumInteractiveTargetSize(uiScale)}px`, minWidth: `${minimumInteractiveTargetSize(uiScale)}px`, padding: `${4 * uiScale}px` };
    const compactButtonStyle = {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${4 * uiScale}px ${7 * uiScale}px`,
    };
    const disabledCompactButtonStyle = {
        ...compactButtonStyle,
        color: t.text.faint,
        cursor: 'not-allowed',
    };
    const lineIdStatusColor = getLineIdStatusColor(lineIdSummary.status);
    const openLocalization = () => {
        openLocalizationWorkbenchTab({
            namespace,
            query: (lineId.trim() || generatedLineId) ?? '',
            status: lineId.trim() ? undefined : 'missing',
        });
    };
    const applyGeneratedLineId = () => {
        if (!generatedLineId) return;
        handleChange('lineId', generatedLineId);
    };
    const updateBacklogVisibility = (value: 'hide' | 'show') => {
        handleChange('backlogVisibility', value === 'hide' ? 'hide' : void 0);
    };
    const updateVoiceDraft = (patch: Partial<typeof voiceDraft>) => {
        handleChange('voice', createDialogueVoiceValue({ ...voiceDraft, ...patch }));
    };

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
                <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between', marginBottom: `${6 * uiScale}px` }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Line ID</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px`, justifyContent: 'flex-end' }}>
                        <button
                            className="toolbar-btn"
                            disabled={!generatedLineId || generatedLineId === lineId}
                            onClick={applyGeneratedLineId}
                            style={generatedLineId && generatedLineId !== lineId ? compactButtonStyle : disabledCompactButtonStyle}
                            title={generatedLineId ? 'Use deterministic line ID' : 'No deterministic ID available'}
                            type="button"
                        >
                            <Wand2 size={12 * uiScale} />
                            <span>{lineId ? 'Regenerate' : 'Generate'}</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            disabled={!projectPath}
                            onClick={openLocalization}
                            style={projectPath ? compactButtonStyle : disabledCompactButtonStyle}
                            title={lineId ? 'Open localization for this line' : 'Open localization'}
                            type="button"
                        >
                            <Languages size={12 * uiScale} />
                            <span>Open</span>
                        </button>
                    </div>
                </div>
                <input
                    onChange={(event) => handleChange('lineId', event.target.value.trim() || undefined)}
                    placeholder="scene.line.001"
                    style={getFieldInputStyle('lineId')}
                    type="text"
                    value={lineId}
                />
                <FieldError errors={lineIdErrors} />
                <div
                    style={{
                        background: t.bg.panel,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.sm,
                        color: t.text.muted,
                        display: 'grid',
                        gap: `${6 * uiScale}px`,
                        marginTop: `${6 * uiScale}px`,
                        padding: `${7 * uiScale}px ${8 * uiScale}px`,
                    }}
                >
                    <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px`, justifyContent: 'space-between' }}>
                        <span style={{ color: lineIdStatusColor, fontSize: `${11 * uiScale}px`, fontWeight: 700 }}>{lineIdSummary.title}</span>
                        <span style={{ color: t.text.faint, fontSize: `${10 * uiScale}px`, overflowWrap: 'anywhere' }}>
                            {lineIdSummary.expectedLineId ? `Expected ${lineIdSummary.expectedLineId}` : 'No generated path'}
                        </span>
                    </div>
                    <div style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>{lineIdSummary.detail}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px` }}>
                        <ContextChip icon={<Archive size={11 * uiScale} />} label={`Backlog: ${backlogVisibility === 'hide' ? 'hidden' : 'visible'}`} uiScale={uiScale} />
                        <ContextChip icon={<Volume2 size={11 * uiScale} />} label={hasVoiceAttachment ? `Voice: ${voiceDraft.cue || voiceDraft.assetUrl}` : 'Voice: none'} uiScale={uiScale} />
                    </div>
                </div>
                {(previewBundle.locale || namespace) && (
                    <div
                        style={{
                            background: t.bg.panel,
                            border: `1px solid ${localizedText ? t.border.subtle : t.accent.orange}`,
                            borderRadius: t.radius.sm,
                            color: localizedText ? t.text.muted : t.accent.orange,
                            fontSize: `${11 * uiScale}px`,
                            marginTop: `${6 * uiScale}px`,
                            overflowWrap: 'anywhere',
                            padding: `${6 * uiScale}px ${8 * uiScale}px`,
                        }}
                    >
                        <strong style={{ color: t.text.faint }}>
                            {previewBundle.locale ?? 'source'}
                            {namespace ? ` / ${namespace}` : ''}
                        </strong>
                        <div style={{ color: localizedText ? t.text.primary : t.accent.orange, marginTop: `${3 * uiScale}px` }}>
                            {lineId
                                ? (localizedText ?? 'Missing locale entry')
                                : 'No line ID'}
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label style={labelStyle}>Backlog</label>
                <select
                    onChange={(event) => updateBacklogVisibility(event.target.value === 'hide' ? 'hide' : 'show')}
                    style={getFieldInputStyle('backlogVisibility')}
                    value={backlogVisibility}
                >
                    <option value="show">Visible</option>
                    <option value="hide">Hidden</option>
                </select>
            </div>

            <div>
                <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between', marginBottom: `${6 * uiScale}px` }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Voice</label>
                    <button
                        disabled={!hasVoiceAttachment}
                        onClick={() => handleChange('voice', void 0)}
                        style={hasVoiceAttachment ? compactButtonStyle : disabledCompactButtonStyle}
                        title="Clear voice attachment"
                        type="button"
                    >
                        <X size={12 * uiScale} />
                        <span>Clear</span>
                    </button>
                </div>
                <div style={{ display: 'grid', gap: `${8 * uiScale}px` }}>
                    <AssetPickerField
                        inputStyle={getFieldInputStyle('voice')}
                        kind="voice"
                        listId="dialogue-voice-asset-options"
                        onChange={(assetUrl) => updateVoiceDraft({ assetUrl })}
                        placeholder="/assets/voice/line.ogg or /assets/voice/lines.sheet.json:cue"
                        value={voiceDraft.assetUrl}
                    />
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: 'minmax(0, 1fr) 96px' }}>
                        <input
                            onChange={(event) => updateVoiceDraft({ cue: event.target.value })}
                            placeholder="cue"
                            style={getFieldInputStyle('voice')}
                            type="text"
                            value={voiceDraft.cue}
                        />
                        <input
                            max="2"
                            min="0"
                            onChange={(event) => updateVoiceDraft({ volume: event.target.value })}
                            placeholder="volume"
                            step="0.1"
                            style={getFieldInputStyle('voice')}
                            type="number"
                            value={voiceDraft.volume}
                        />
                    </div>
                </div>
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

function ContextChip({ icon, label, uiScale }: { icon: ReactNode; label: string; uiScale: number }) {
    return (
        <span
            style={{
                alignItems: 'center',
                background: t.bg.input,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                color: t.text.normal,
                display: 'inline-flex',
                fontSize: `${10 * uiScale}px`,
                gap: `${4 * uiScale}px`,
                lineHeight: 1.25,
                maxWidth: '100%',
                minHeight: `${Math.max(20 * uiScale, 18)}px`,
                overflowWrap: 'anywhere',
                padding: `${2 * uiScale}px ${6 * uiScale}px`,
            }}
        >
            {icon}
            <span>{label}</span>
        </span>
    );
}

function findSceneNameByPath(
    scenePaths: Record<string, string | undefined>,
    activeFile: string | undefined,
): string | undefined {
    if (!activeFile) return undefined;
    const normalizedActiveFile = normalizePath(activeFile);

    for (const [sceneName, scenePath] of Object.entries(scenePaths)) {
        if (!scenePath) continue;
        if (normalizePath(scenePath) === normalizedActiveFile) {
            return sceneName;
        }
    }

    return undefined;
}

function getLineIdStatusColor(status: ReturnType<typeof summarizeDialogueLineId>['status']): string {
    switch (status) {
        case 'custom': {
            return t.accent.blue;
        }
        case 'generated': {
            return t.accent.green;
        }
        case 'missing': {
            return t.accent.orange;
        }
        case 'unknown': {
            return t.text.faint;
        }
    }
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}
