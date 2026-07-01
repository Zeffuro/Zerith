import {
    type BrowserEditorReadinessRequirementStatus,
    createBrowserEditorReadinessReport,
} from '../../services/browserEditorReadiness';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { editorTheme as t } from '../../theme/editorTheme';

type BrowserEditorReadinessPanelProperties = {
    uiScale: number;
};

export function BrowserEditorReadinessPanel({ uiScale }: BrowserEditorReadinessPanelProperties) {
    const browserGlobal = globalThis as { showDirectoryPicker?: unknown };
    const report = createBrowserEditorReadinessReport({
        browserFileSystemAccess: typeof browserGlobal.showDirectoryPicker === 'function',
        runtime: isTauriRuntime() ? 'desktop' : 'browser',
    });

    return (
        <section
            aria-label="Browser editor parity readiness"
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
                <span>Browser Editor Parity</span>
                <span style={statusPillStyle(uiScale, report.status)}>Browser parity {report.status}</span>
            </div>
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Runtime: {report.runtime} | {report.ready} ready / {report.limited} limited / {report.blocked} blocked
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

function statusPillStyle(uiScale: number, status: BrowserEditorReadinessRequirementStatus) {
    const color = status === 'ready'
        ? t.accent.green
        : (status === 'limited'
            ? t.accent.yellow
            : t.accent.red);

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
