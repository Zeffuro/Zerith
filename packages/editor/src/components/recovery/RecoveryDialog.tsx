import { useEffect, useId, useRef, useState } from 'react';

import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { browserFsAdapter } from '../../services/fs/browserFsAdapter';
import { discardRecoveryDraft, keepRecoveryDraft, openRecoveryProject, restoreRecoveryDraft } from '../../services/recovery/recoverySession';
import { useRecoveryStore } from '../../services/recovery/recoveryState';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

export function RecoveryDialog() {
    const { drafts, error, offer, startupVisible } = useRecoveryStore();
    const path = useProjectStore(state => state.projectPath);
    const enabled = useSettingsStore(state => state.recoveryEnabled);
    const scale = useSettingsStore(state => state.uiScale);
    const reference = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const [opening, setOpening] = useState(false);
    const [openError, setOpenError] = useState<string>();
    const [projectsReady, setProjectsReady] = useState(isTauriRuntime);
    useEffect(() => {
        let active = true;
        if (!isTauriRuntime()) {
            void browserFsAdapter.recentProjects.ready().catch(error_ => {
                if (active) setOpenError(String(error_));
            }).finally(() => { if (active) setProjectsReady(true); });
        }
        return () => { active = false; };
    }, []);
    const open = enabled && Boolean(offer || (!path && startupVisible && drafts.length > 0));
    useDialogFocusTrap({ active: open, containerReference: reference });
    if (!open) return;
    const button = styles.buttonBase(scale);
    return <div style={{ background: 'rgba(0,0,0,.5)', display: 'grid', inset: 0, padding: 16, placeItems: 'center', position: 'fixed', zIndex: 2200 }}>
        <div aria-labelledby={titleId} aria-modal="true" onKeyDown={event => { if (event.key === 'Escape') keepRecoveryDraft(); }} ref={reference} role="dialog" style={{ background: t.bg.panel, border: `1px solid ${t.border.normal}`, borderRadius: t.radius.lg, color: t.text.primary, display: 'grid', gap: 12, maxHeight: '90vh', overflowY: 'auto', padding: 20, width: 'min(900px, 100%)' }} tabIndex={-1}>
            <h2 id={titleId} style={{ fontSize: 18, margin: 0 }}>Recover unsaved work</h2>
            <p style={{ margin: 0 }}>Review the saved draft before restoring. Restored edits stay unsaved until you save them.</p>
            {error || openError ? <p role="alert" style={{ color: t.accent.red }}>{openError ?? error}</p> : undefined}
            {offer ? <>
                <div style={{ overflowWrap: 'anywhere' }}>{offer.projectPath}</div>
                {offer.files.map(file => <details key={file.path} open>
                    <summary>{file.title} {file.diskError ? '(file unavailable)' : (file.diskText === file.savedText ? '' : '(disk changed)')}</summary>
                    {file.diskError || file.diskText !== file.savedText ? <p>Original disk content is preserved. Saving this recovered edit will stop if the file differs from its original version.</p> : undefined}
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
                        <Content label="Current disk content" text={file.diskText ?? file.diskError ?? 'Unavailable'} />
                        <Content label="Recovery draft" text={file.text} />
                    </div>
                </details>)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => discardRecoveryDraft(offer.projectPath, offer.draftId)} style={button} type="button">Discard draft</button>
                    <button onClick={keepRecoveryDraft} style={button} type="button">Keep for later</button>
                    <button onClick={() => restoreRecoveryDraft(offer)} style={button} type="button">Restore edits</button>
                </div>
            </> : <>
                {projectsReady ? undefined : <p role="status">Loading saved project folders...</p>}
                {drafts.map(draft => <div key={draft.id} style={{ border: `1px solid ${t.border.normal}`, display: 'grid', gap: 8, overflowWrap: 'anywhere', padding: 12 }}>
                    <span>{draft.projectPath}</span>
                    <span>{draft.files.length} unsaved files from {new Date(draft.updatedAt).toLocaleString()}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={opening || !projectsReady} onClick={() => {
                            setOpening(true);
                            setOpenError(undefined);
                            void openRecoveryProject(draft.projectPath, draft.id).then(opened => {
                                if (!opened) setOpenError('Project could not be reopened. Keep the draft and open its folder to try again.');
                            }).catch(error_ => setOpenError(String(error_))).finally(() => setOpening(false));
                        }} style={button} type="button">Open project to review</button>
                        <button disabled={opening} onClick={() => discardRecoveryDraft(draft.projectPath, draft.id)} style={button} type="button">Discard draft</button>
                    </div>
                </div>)}
                <button onClick={keepRecoveryDraft} style={button} type="button">Keep for later</button>
            </>}
        </div>
    </div>;
}

function Content({ label, text }: { label: string; text: string }) {
    return <label style={{ display: 'grid', gap: 4 }}>{label}
        <textarea aria-label={label} readOnly style={{ background: t.bg.popup, border: `1px solid ${t.border.normal}`, color: t.text.normal, fontFamily: 'monospace', minHeight: 150, resize: 'vertical', width: '100%' }} value={text} />
    </label>;
}
