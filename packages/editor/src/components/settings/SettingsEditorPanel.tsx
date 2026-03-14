import { editorTheme as t } from '../../theme/editorTheme';
import { getVisibleSettingsControls } from './settingsControlRegistry';

type SettingsEditorPanelProperties = {
    panelId: string;
    searchQuery: string;
    showChangedOnly: boolean;
    uiScale: number;
};

export function SettingsEditorPanel({ panelId, searchQuery, showChangedOnly, uiScale }: SettingsEditorPanelProperties) {
    const visibleControlIds = getVisibleSettingsControls(panelId);

    if (visibleControlIds.length === 0) {
        return (
            <div style={{ color: t.text.muted, display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${8 * uiScale}px` }}>
                <span>
                    {showChangedOnly
                        ? 'No changed settings are visible in this panel for the current search.'
                        : `No settings in this panel match "${searchQuery.trim()}".`}
                </span>
                <span>Editor behavior and code editor settings are not available yet.</span>
            </div>
        );
    }

    return (
        <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
            Editor settings are coming soon.
        </div>
    );
}

