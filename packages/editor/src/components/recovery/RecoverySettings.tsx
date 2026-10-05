import { reviewRecoveryDrafts } from '../../services/recovery/recoverySession';
import { useRecoveryStore } from '../../services/recovery/recoveryState';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function RecoverySettings() {
    const enabled = useSettingsStore(state => state.recoveryEnabled);
    const drafts = useRecoveryStore(state => state.drafts);
    return <div style={{ color: t.text.normal, fontSize: 13, padding: 12 }}>
        <label style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
            <input checked={enabled} onChange={event => useSettingsStore.getState().setRecoveryEnabled(event.currentTarget.checked)} type="checkbox" />
            Keep recovery drafts for unsaved work
        </label>
        <p>Stores edits locally and offers recovery when you reopen a project. Game files change only when you save. Disabling recovery keeps existing drafts.</p>
        <button disabled={!enabled || drafts.length === 0} onClick={reviewRecoveryDrafts} type="button">Review recovery drafts</button>
    </div>;
}
