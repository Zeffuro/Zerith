import type { SceneComposerGraphSummary } from './sceneComposerModel';

import { editorTheme as t } from '../../../theme/editorTheme';
import { createTimelineGraphReadinessReport, type TimelineGraphReadinessStatus } from './timelineGraphReadinessModel';

type TimelineGraphReadinessPanelProperties = {
    graph: SceneComposerGraphSummary;
    uiScale: number;
};

export function TimelineGraphReadinessPanel({ graph, uiScale }: TimelineGraphReadinessPanelProperties) {
    const report = createTimelineGraphReadinessReport(graph);

    return (
        <section
            aria-label="Timeline graph status"
            style={{
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'grid',
                gap: `${6 * uiScale}px`,
                padding: `${6 * uiScale}px`,
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    flexWrap: 'wrap',
                    fontSize: `${10 * uiScale}px`,
                    gap: `${6 * uiScale}px`,
                }}
            >
                <span style={statusPillStyle(uiScale, report.status)}>
                    Graph canvas {report.status}
                </span>
                <span style={{ color: t.text.muted }}>
                    {report.ready} ready / {report.limited} limited / {report.blocked} blocked
                </span>
                <span style={{ color: t.text.faint }}>
                    {report.currentGraph.sceneName}: {report.currentGraph.labels} labels / {report.currentGraph.exits} exits / {report.currentGraph.calls} calls
                </span>
            </div>

            <div style={{ color: t.text.muted, fontSize: `${10 * uiScale}px` }}>
                {report.currentGraph.issueSummary}
            </div>

            <div style={{ display: 'grid', gap: `${5 * uiScale}px` }}>
                {report.requirements.map((requirement) => (
                    <div
                        key={requirement.id}
                        style={{
                            alignItems: 'start',
                            display: 'grid',
                            gap: `${4 * uiScale}px`,
                            gridTemplateColumns: `${68 * uiScale}px minmax(0, 1fr)`,
                        }}
                    >
                        <span style={statusPillStyle(uiScale, requirement.status)}>
                            {requirement.status}
                        </span>
                        <span style={{ color: t.text.normal, fontSize: `${10 * uiScale}px` }}>
                            <strong>{requirement.label}:</strong> {requirement.summary}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}

function statusPillStyle(uiScale: number, status: TimelineGraphReadinessStatus) {
    const color = status === 'ready'
        ? t.accent.green
        : (status === 'limited'
            ? t.accent.yellow
            : t.accent.orange);

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
