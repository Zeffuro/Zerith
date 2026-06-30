import { Save, X } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import type { AssetLibraryAssetMetadata } from '../../services/assetLibraryMetadata';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { editorTheme as t } from '../../theme/editorTheme';
import { miniButtonStyle, searchInputStyle } from './assetDependencyPanelStyles';
import { AssetMetadataChips } from './AssetDependencyRows';
import {
    formatAssetMetadataEditorDraft,
    parseAssetMetadataEditorDraft,
} from './assetMetadataEditorModel';

type Properties = {
    assetUrl?: string;
    busy: boolean;
    emptyPreviewText?: string;
    metadata: AssetLibraryAssetMetadata;
    onCancel: () => void;
    onSave: (assetMetadata: AssetLibraryAssetMetadata) => void;
    saveText?: string;
    subject?: string;
    title?: string;
    uiScale: number;
};

export function AssetMetadataEditorDialog({
    assetUrl,
    busy,
    emptyPreviewText = 'No metadata labels',
    metadata,
    onCancel,
    onSave,
    saveText = 'Save metadata',
    subject,
    title = 'Organize Asset',
    uiScale,
}: Properties) {
    const [collectionsInput, setCollectionsInput] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const dialogReference = useRef<HTMLFormElement | null>(null);
    const subjectId = useId();
    const titleId = useId();
    const backdropDismissal = useBackdropDismissal(onCancel, { disabled: busy });
    const draft = formatAssetMetadataEditorDraft(metadata);

    useEffect(() => {
        setCollectionsInput(draft.collectionsInput);
        setTagsInput(draft.tagsInput);
    }, [assetUrl, draft.collectionsInput, draft.tagsInput, subject]);
    useDialogFocusTrap({ active: Boolean(assetUrl ?? subject), containerReference: dialogReference });

    const displaySubject = subject ?? assetUrl;
    if (!displaySubject) return;

    const parsedMetadata = parseAssetMetadataEditorDraft({ collectionsInput, tagsInput });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        onSave(parsedMetadata);
    };

    return (
        <div {...backdropDismissal} style={backdropStyle}>
            <form
                aria-busy={busy}
                aria-describedby={subjectId}
                aria-labelledby={titleId}
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                onSubmit={submit}
                ref={dialogReference}
                role="dialog"
                style={dialogStyle(uiScale)}
                tabIndex={-1}
            >
                <div style={titleRowStyle(uiScale)}>
                    <div style={{ minWidth: 0 }}>
                        <div id={titleId} style={{ color: t.text.primary, fontSize: `${14 * uiScale}px`, fontWeight: 700 }}>{title}</div>
                        <div id={subjectId} style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>{displaySubject}</div>
                    </div>
                    <button
                        className="toolbar-btn"
                        disabled={busy}
                        onClick={onCancel}
                        style={iconButtonStyle(uiScale, busy)}
                        title="Close asset metadata editor"
                        type="button"
                    >
                        <X size={15 * uiScale} />
                    </button>
                </div>

                <label style={fieldStyle(uiScale)}>
                    <span style={fieldLabelStyle(uiScale)}>Collections</span>
                    <input
                        autoFocus
                        disabled={busy}
                        onChange={(event) => setCollectionsInput(event.currentTarget.value)}
                        placeholder="Characters, backgrounds, UI"
                        style={dialogInputStyle(uiScale)}
                        value={collectionsInput}
                    />
                </label>

                <label style={fieldStyle(uiScale)}>
                    <span style={fieldLabelStyle(uiScale)}>Tags</span>
                    <input
                        disabled={busy}
                        onChange={(event) => setTagsInput(event.currentTarget.value)}
                        placeholder="hero, indoor, needs cleanup"
                        style={dialogInputStyle(uiScale)}
                        value={tagsInput}
                    />
                </label>

                <div style={previewStyle(uiScale)}>
                    <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>Preview</span>
                    <AssetMetadataChips metadata={parsedMetadata} uiScale={uiScale} />
                    {parsedMetadata.collections.length === 0 && parsedMetadata.tags.length === 0 ? (
                        <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, fontStyle: 'italic' }}>{emptyPreviewText}</span>
                    ) : undefined}
                </div>

                <div style={footerStyle(uiScale)}>
                    <button
                        className="toolbar-btn"
                        disabled={busy}
                        onClick={onCancel}
                        style={miniButtonStyle(uiScale, busy)}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="toolbar-btn"
                        disabled={busy}
                        style={saveButtonStyle(uiScale, busy)}
                        type="submit"
                    >
                        <Save size={14 * uiScale} />
                        <span>{busy ? 'Saving...' : saveText}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

const backdropStyle = {
    background: 'rgba(0,0,0,.45)',
    display: 'grid',
    inset: 0,
    placeItems: 'center',
    position: 'fixed' as const,
    zIndex: 2000,
};

function dialogInputStyle(uiScale: number) {
    return {
        ...searchInputStyle(uiScale),
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        minHeight: `${28 * uiScale}px`,
        padding: `${5 * uiScale}px ${7 * uiScale}px`,
    };
}

function dialogStyle(uiScale: number) {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.lg,
        boxShadow: t.shadow.popupStrong,
        color: t.text.normal,
        display: 'grid',
        gap: `${12 * uiScale}px`,
        maxWidth: 'min(92vw, 520px)',
        padding: `${16 * uiScale}px`,
        width: `${420 * uiScale}px`,
    };
}

function fieldLabelStyle(uiScale: number) {
    return {
        color: t.text.muted,
        fontSize: `${11 * uiScale}px`,
        fontWeight: 700,
    };
}

function fieldStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${4 * uiScale}px`,
    };
}

function footerStyle(uiScale: number) {
    return {
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'flex-end',
    };
}

function iconButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: 'none',
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        justifyContent: 'center',
        minHeight: `${26 * uiScale}px`,
        minWidth: `${26 * uiScale}px`,
        padding: `${3 * uiScale}px`,
    };
}

function previewStyle(uiScale: number) {
    return {
        background: t.bg.app,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${5 * uiScale}px`,
        minHeight: `${42 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function saveButtonStyle(uiScale: number, disabled: boolean) {
    return {
        ...miniButtonStyle(uiScale, disabled),
        background: disabled ? undefined : t.accent.primary,
        border: disabled ? `1px solid ${t.border.subtle}` : 'none',
        color: disabled ? t.text.faint : '#fff',
    };
}

function titleRowStyle(uiScale: number) {
    return {
        alignItems: 'flex-start',
        display: 'flex',
        gap: `${10 * uiScale}px`,
        justifyContent: 'space-between',
        minWidth: 0,
    };
}
