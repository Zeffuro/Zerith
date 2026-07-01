import {
    createGitHubPagesDualSiteReadinessReport,
    type GitHubPagesDualSiteRequirementStatus,
} from '../../services/githubPagesDualSiteReadiness';
import { editorTheme as t } from '../../theme/editorTheme';

type GitHubPagesReadinessPanelProperties = {
    uiScale: number;
};

export function GitHubPagesReadinessPanel({ uiScale }: GitHubPagesReadinessPanelProperties) {
    const report = createGitHubPagesDualSiteReadinessReport();

    return (
        <section
            aria-label="GitHub Pages dual-site readiness"
            style={{
                borderTop: `1px solid ${t.border.subtle}`,
                display: 'grid',
                gap: `${6 * uiScale}px`,
                paddingTop: `${8 * uiScale}px`,
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    fontSize: `${11 * uiScale}px`,
                    gap: `${6 * uiScale}px`,
                }}
            >
                <span style={statusPillStyle(uiScale, report.status)}>
                    Pages dual site {report.status}
                </span>
                <span style={{ color: t.text.muted }}>
                    {report.ready} ready / {report.blocked} blocked
                </span>
            </div>
            <div style={{ display: 'grid', gap: `${5 * uiScale}px` }}>
                {report.requirements.map((requirement) => (
                    <div
                        key={requirement.id}
                        style={{
                            alignItems: 'start',
                            display: 'grid',
                            gap: `${4 * uiScale}px`,
                            gridTemplateColumns: `${86 * uiScale}px minmax(0, 1fr)`,
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

function statusPillStyle(uiScale: number, status: GitHubPagesDualSiteRequirementStatus) {
    const color = status === 'ready' ? t.accent.green : t.accent.yellow;

    return {
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        flexShrink: 0,
        fontSize: `${10 * uiScale}px`,
        lineHeight: 1.3,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
        textTransform: 'capitalize' as const,
    };
}
