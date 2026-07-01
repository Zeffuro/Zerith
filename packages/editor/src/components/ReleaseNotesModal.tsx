import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { useBackdropDismissal } from '../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import {
    EDITOR_RELEASES_PAGE_URL,
    type EditorReleaseNotesLoadResult,
    loadEditorReleaseNotes,
} from '../services/editorReleaseNotes';
import { openExternalUrl } from '../services/runtime/windowControls';
import { useEditorStore } from '../store/useEditorStore';
import { editorTheme as t } from '../theme/editorTheme';
import { styles } from '../theme/styleHelpers';

type ReleaseNotesState = { status: 'loading' } | EditorReleaseNotesLoadResult;

export function ReleaseNotesModal() {
    const closeReleaseNotesModal = useEditorStore((state) => state.closeReleaseNotesModal);
    const isOpen = useEditorStore((state) => state.isReleaseNotesModalOpen);
    const uiScale = useEditorStore((state) => state.uiScale);
    const dialogReference = useRef<HTMLDivElement | null>(null);
    const statusId = useId();
    const titleId = useId();
    const [loadState, setLoadState] = useState<ReleaseNotesState>({ status: 'loading' });

    const loadNotes = useCallback(() => {
        setLoadState({ status: 'loading' });
        void loadEditorReleaseNotes().then((result) => {
            setLoadState(result);
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        setLoadState({ status: 'loading' });
        void loadEditorReleaseNotes().then((result) => {
            if (active) setLoadState(result);
        });

        return () => {
            active = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeReleaseNotesModal();
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [closeReleaseNotesModal, isOpen]);

    useDialogFocusTrap({ active: isOpen, containerReference: dialogReference });
    const backdropDismissal = useBackdropDismissal(closeReleaseNotesModal);

    if (!isOpen) return;

    return (
        <div
            {...backdropDismissal}
            style={{
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'grid',
                inset: 0,
                placeItems: 'center',
                position: 'fixed',
                zIndex: 5450,
            }}
        >
            <div
                aria-describedby={statusId}
                aria-labelledby={titleId}
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                ref={dialogReference}
                role="dialog"
                style={{
                    background: t.bg.panel,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gap: `${12 * uiScale}px`,
                    maxHeight: `calc(100vh - ${32 * uiScale}px)`,
                    overflow: 'hidden',
                    padding: `${16 * uiScale}px`,
                    width: `min(${720 * uiScale}px, calc(100vw - ${32 * uiScale}px))`,
                }}
                tabIndex={-1}
            >
                <header
                    style={{
                        alignItems: 'center',
                        display: 'grid',
                        gap: `${12 * uiScale}px`,
                        gridTemplateColumns: '1fr auto',
                    }}
                >
                    <div style={{ display: 'grid', gap: `${3 * uiScale}px` }}>
                        <div id={titleId} style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>
                            Release Notes
                        </div>
                        <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                            Zerith Editor {__ZERITH_EDITOR_VERSION__}
                        </div>
                    </div>
                    <button
                        aria-label="Close release notes"
                        onClick={closeReleaseNotesModal}
                        style={styles.iconButton(uiScale)}
                        type="button"
                    >
                        <X aria-hidden size={16 * uiScale} />
                    </button>
                </header>

                <div
                    className="zerith-scrollbar"
                    id={statusId}
                    style={{
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.md,
                        maxHeight: `min(64vh, ${520 * uiScale}px)`,
                        overflowY: 'auto',
                        padding: `${12 * uiScale}px`,
                    }}
                >
                    {renderReleaseNotes(loadState, uiScale)}
                </div>

                <footer style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => {
                            void openExternalUrl(EDITOR_RELEASES_PAGE_URL);
                        }}
                        style={{ ...styles.buttonBase(uiScale) }}
                        type="button"
                    >
                        <ExternalLink aria-hidden size={14 * uiScale} />
                        Open GitHub Releases
                    </button>
                    <button
                        onClick={() => {
                            loadNotes();
                        }}
                        style={{ ...styles.buttonBase(uiScale) }}
                        type="button"
                    >
                        <RefreshCw aria-hidden size={14 * uiScale} />
                        Refresh
                    </button>
                </footer>
            </div>
        </div>
    );
}

function formatPublishedAt(value: string | undefined): string {
    if (!value) return 'Unpublished date';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function renderReleaseNotes(loadState: ReleaseNotesState, uiScale: number) {
    if (loadState.status === 'loading') {
        return <div style={{ color: t.text.muted }}>Loading release notes...</div>;
    }

    if (loadState.status === 'empty') {
        return (
            <div style={{ color: t.text.normal }}>
                No published editor release notes yet. The first published `editor-v*` GitHub Release will appear here.
            </div>
        );
    }

    if (loadState.status === 'unavailable') {
        return (
            <div style={{ color: t.accent.yellow }}>
                Release notes unavailable: {loadState.message}
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: `${14 * uiScale}px` }}>
            {loadState.notes.map((note) => (
                <article
                    key={note.tagName}
                    style={{
                        borderBottom: `1px solid ${t.border.subtle}`,
                        display: 'grid',
                        gap: `${6 * uiScale}px`,
                        paddingBottom: `${12 * uiScale}px`,
                    }}
                >
                    <div style={{ display: 'grid', gap: `${2 * uiScale}px` }}>
                        <a
                            href={note.url}
                            onClick={(event) => {
                                event.preventDefault();
                                void openExternalUrl(note.url);
                            }}
                            style={{ color: t.text.primary, fontWeight: 700, textDecoration: 'none' }}
                        >
                            {note.name}
                        </a>
                        <div style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                            {note.tagName} - {formatPublishedAt(note.publishedAt)}
                        </div>
                    </div>
                    <div
                        style={{
                            color: t.text.normal,
                            fontSize: `${12 * uiScale}px`,
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {note.body}
                    </div>
                </article>
            ))}
        </div>
    );
}
