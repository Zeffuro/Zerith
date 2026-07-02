import { editorTheme as t } from '../../theme/editorTheme';
import {
    createPluginMarketplaceReadinessReport,
    type PluginMarketplaceRequirementStatus,
} from './pluginSettingsModel';

type PluginMarketplaceReadinessPanelProperties = {
    uiScale: number;
};

export function PluginMarketplaceReadinessPanel({ uiScale }: PluginMarketplaceReadinessPanelProperties) {
    const report = createPluginMarketplaceReadinessReport();

    return (
        <section
            aria-label="Plugin marketplace status"
            style={{
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                display: 'grid',
                gap: `${8 * uiScale}px`,
                padding: `${10 * uiScale}px`,
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    color: t.text.primary,
                    display: 'flex',
                    fontWeight: 700,
                    gap: `${8 * uiScale}px`,
                    justifyContent: 'space-between',
                }}
            >
                <span>Marketplace Status</span>
                <span style={statusPillStyle(uiScale, report.status)}>Marketplace {report.status}</span>
            </div>
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                {report.ready} ready / {report.limited} limited / {report.blocked} blocked
            </div>
            <div style={{ display: 'grid', gap: `${5 * uiScale}px` }}>
                {report.requirements.map((requirement) => (
                    <div
                        key={requirement.id}
                        style={{
                            alignItems: 'start',
                            display: 'grid',
                            gap: `${5 * uiScale}px`,
                            gridTemplateColumns: `${82 * uiScale}px minmax(0, 1fr)`,
                        }}
                    >
                        <span style={statusPillStyle(uiScale, requirement.status)}>
                            {requirement.status}
                        </span>
                        <span style={{ color: t.text.normal, fontSize: `${11 * uiScale}px` }}>
                            <strong>{requirement.label}:</strong> {requirement.summary}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

function statusPillStyle(uiScale: number, status: PluginMarketplaceRequirementStatus) {
    const color = status === 'ready'
        ? t.accent.green
        : (status === 'limited' ? t.accent.yellow : t.accent.orange);

    return {
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        flexShrink: 0,
        fontSize: `${11 * uiScale}px`,
        lineHeight: 1.3,
        padding: `${2 * uiScale}px ${6 * uiScale}px`,
        textTransform: 'capitalize' as const,
        whiteSpace: 'nowrap' as const,
    };
}
