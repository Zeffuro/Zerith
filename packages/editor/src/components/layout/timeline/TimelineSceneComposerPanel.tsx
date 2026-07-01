import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    CloudRain,
    ExternalLink,
    GitFork,
    Image as ImageIcon,
    MessageSquare,
    Music,
    User,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { SceneComposerSnapshot } from './sceneComposerModel';

import { editorTheme as t } from '../../../theme/editorTheme';
import { TimelineGraphReadinessPanel } from './TimelineGraphReadinessPanel';
import { TimelineSceneGraphPanel } from './TimelineSceneGraphPanel';

type ComposerTileProperties = {
    detail?: string;
    icon: ReactNode;
    label: string;
    uiScale: number;
    value: string;
};

type Properties = {
    canOpenMacro?: (macroName: string) => boolean;
    canOpenScene?: (sceneName: string) => boolean;
    onCreateLabel?: (label: string, sourcePath: ScriptPath) => void;
    onCreateMissingLabels?: () => void;
    onCreateMissingMacro?: (macroName: string) => void;
    onCreateMissingMacros?: (macroNames: string[]) => void;
    onCreateMissingScene?: (sceneName: string) => void;
    onCreateMissingScenes?: (sceneNames: string[]) => void;
    onOpenMacro?: (macroName: string) => void;
    onOpenMissingSceneTarget?: (sceneName: string) => void;
    onOpenScene?: (sceneName: string) => void;
    onOpenSelectedJson?: () => void;
    onSelectPath?: (path: ScriptPath) => void;
    snapshot: SceneComposerSnapshot;
    sourceDirty?: boolean;
    sourceFilePath?: string;
    uiScale: number;
    validationIssueCount?: number;
};

export function TimelineSceneComposerPanel({
    canOpenMacro,
    canOpenScene,
    onCreateLabel,
    onCreateMissingLabels,
    onCreateMissingMacro,
    onCreateMissingMacros,
    onCreateMissingScene,
    onCreateMissingScenes,
    onOpenMacro,
    onOpenMissingSceneTarget,
    onOpenScene,
    onOpenSelectedJson,
    onSelectPath,
    snapshot,
    sourceDirty = false,
    sourceFilePath,
    uiScale,
    validationIssueCount = 0,
}: Properties) {
    const [overviewOpen, setOverviewOpen] = useState(false);
    const scopeLabel = snapshot.targetIndex === undefined
        ? `Full scene - ${snapshot.totalCommands} commands`
        : `At command ${snapshot.targetIndex + 1} of ${snapshot.totalCommands}`;
    const actionStatus = snapshot.graph.missingTargets > 0 ? 'guarded writes available' : 'read-only summary';
    const graphStatus = snapshot.graph.missingTargets > 0
        ? `${snapshot.graph.missingTargets} missing target${snapshot.graph.missingTargets === 1 ? '' : 's'}`
        : 'connected';
    const sourceFileName = sourceFilePath ? basename(sourceFilePath) : 'No scene file';
    const selectionPathLabel = snapshot.selection.pathKey ?? 'scene root';
    const selectionScopeLabel = snapshot.selection.breadcrumb ?? 'Full scene';
    const validationStatus = validationIssueCount > 0
        ? `${validationIssueCount} issue${validationIssueCount === 1 ? '' : 's'}`
        : 'clean';
    const spriteValue = snapshot.sprites.length === 0
        ? 'none'
        : snapshot.sprites.map((sprite) => formatSpriteState(sprite)).join(', ');
    const weatherValue = snapshot.weather.length === 0
        ? 'none'
        : snapshot.weather.map((entry) => entry.layer ? `${entry.preset} (${entry.layer})` : entry.preset).join(', ');
    return (
        <div
            style={{
                borderTop: `1px solid ${t.border.subtle}`,
                display: 'grid',
                gap: `${8 * uiScale}px`,
                paddingTop: `${8 * uiScale}px`,
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    color: t.text.muted,
                    display: 'flex',
                    fontSize: `${11 * uiScale}px`,
                    gap: `${8 * uiScale}px`,
                    justifyContent: 'space-between',
                }}
            >
                <strong style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }}>Scene Composer</strong>
                <span>{scopeLabel}</span>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: `${5 * uiScale}px`,
                }}
            >
                <ComposerStatusChip
                    label="File"
                    title={sourceFilePath}
                    tone={sourceDirty ? 'warn' : undefined}
                    uiScale={uiScale}
                    value={`${sourceFileName}${sourceDirty ? ' *' : ''}`}
                />
                <ComposerStatusChip
                    label="Scene"
                    uiScale={uiScale}
                    value={snapshot.graph.currentSceneName ?? 'unmapped'}
                />
                <ComposerStatusChip
                    label="Scope"
                    title={selectionScopeLabel}
                    uiScale={uiScale}
                    value={selectionScopeLabel}
                />
                <ComposerStatusChip
                    label="Path"
                    title={selectionPathLabel}
                    uiScale={uiScale}
                    value={selectionPathLabel}
                />
                <ComposerStatusChip
                    label="Graph"
                    tone={snapshot.graph.missingTargets > 0 ? 'warn' : undefined}
                    uiScale={uiScale}
                    value={graphStatus}
                />
                <ComposerStatusChip
                    label="Validation"
                    tone={validationIssueCount > 0 ? 'warn' : undefined}
                    uiScale={uiScale}
                    value={validationStatus}
                />
                {onOpenSelectedJson ? (
                    <button
                        className="toolbar-btn"
                        onClick={onOpenSelectedJson}
                        style={composerHeaderActionStyle(uiScale)}
                        title={snapshot.selection.breadcrumb
                            ? `Reveal ${snapshot.selection.breadcrumb} in JSON`
                            : 'Reveal scene root in JSON'}
                        type="button"
                    >
                        <ExternalLink size={11 * uiScale} />
                        <span>Reveal in JSON</span>
                    </button>
                ) : undefined}
                <button
                    aria-expanded={overviewOpen}
                    className="toolbar-btn"
                    onClick={() => setOverviewOpen((current) => !current)}
                    style={composerHeaderActionStyle(uiScale)}
                    title={overviewOpen ? 'Hide scene overview' : 'Show scene overview'}
                    type="button"
                >
                    {overviewOpen ? <ChevronDown size={11 * uiScale} /> : <ChevronRight size={11 * uiScale} />}
                    <span>Overview</span>
                </button>
            </div>

            {overviewOpen ? (
                <>
                    <div
                        style={{
                            alignItems: 'center',
                            color: t.text.muted,
                            display: 'flex',
                            fontSize: `${11 * uiScale}px`,
                            gap: `${8 * uiScale}px`,
                            justifyContent: 'space-between',
                        }}
                    >
                        <strong style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }}>Scene Composer Overview</strong>
                        <span>{actionStatus}</span>
                    </div>

                    <div
                        aria-label="Scene overview"
                        style={{
                            display: 'grid',
                            gap: `${6 * uiScale}px`,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        }}
                    >
                        <ComposerTile
                            icon={<ImageIcon aria-hidden color={t.accent.teal} size={14 * uiScale} />}
                            label="BG"
                            uiScale={uiScale}
                            value={snapshot.background ?? 'none'}
                        />
                        <ComposerTile
                            icon={<Music aria-hidden color={t.accent.purple} size={14 * uiScale} />}
                            label="BGM"
                            uiScale={uiScale}
                            value={snapshot.bgm ?? 'none'}
                        />
                        <ComposerTile
                            icon={<User aria-hidden color={t.accent.orange} size={14 * uiScale} />}
                            label="Sprites"
                            uiScale={uiScale}
                            value={spriteValue}
                        />
                        <ComposerTile
                            icon={<CloudRain aria-hidden color={t.accent.blue} size={14 * uiScale} />}
                            label="Weather"
                            uiScale={uiScale}
                            value={weatherValue}
                        />
                        <ComposerTile
                            detail={`${snapshot.totals.voice} voiced`}
                            icon={<MessageSquare aria-hidden color={t.accent.green} size={14 * uiScale} />}
                            label="Dialogue"
                            uiScale={uiScale}
                            value={`${snapshot.totals.dialogue} lines`}
                        />
                        <ComposerTile
                            detail={`${snapshot.totals.jumps + snapshot.totals.sceneChanges} exits`}
                            icon={<GitFork aria-hidden color={t.accent.yellow} size={14 * uiScale} />}
                            label="Branches"
                            uiScale={uiScale}
                            value={`${snapshot.totals.choices} choices`}
                        />
                    </div>

                    <TimelineGraphReadinessPanel graph={snapshot.graph} uiScale={uiScale} />

                    <TimelineSceneGraphPanel
                        canOpenMacro={canOpenMacro}
                        canOpenScene={canOpenScene}
                        onCreateLabel={onCreateLabel}
                        onCreateMissingLabels={onCreateMissingLabels}
                        onCreateMissingMacro={onCreateMissingMacro}
                        onCreateMissingMacros={onCreateMissingMacros}
                        onCreateMissingScene={onCreateMissingScene}
                        onCreateMissingScenes={onCreateMissingScenes}
                        onOpenMacro={onOpenMacro}
                        onOpenMissingSceneTarget={onOpenMissingSceneTarget}
                        onOpenScene={onOpenScene}
                        onSelectPath={onSelectPath}
                        snapshot={snapshot}
                        uiScale={uiScale}
                    />

            {(snapshot.warnings.length > 0 || snapshot.recentCues.length > 0) && (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: `${6 * uiScale}px`,
                    }}
                >
                    {snapshot.warnings.map((warning) => (
                        <span
                            key={warning}
                            style={{
                                alignItems: 'center',
                                border: `1px solid ${t.accent.orange}`,
                                borderRadius: t.radius.sm,
                                color: t.text.primary,
                                display: 'inline-flex',
                                gap: `${4 * uiScale}px`,
                                maxWidth: `${260 * uiScale}px`,
                                overflow: 'hidden',
                                padding: `${3 * uiScale}px ${6 * uiScale}px`,
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={warning}
                        >
                            <AlertTriangle aria-hidden color={t.accent.orange} size={12 * uiScale} />
                            {warning}
                        </span>
                    ))}

                    {snapshot.recentCues.slice(0, 3).map((cue, index) => (
                        <span
                            key={`${index}:${cue.kind}:${cue.label}:${cue.detail}`}
                            style={{
                                border: `1px solid ${t.border.subtle}`,
                                borderRadius: t.radius.sm,
                                color: t.text.muted,
                                maxWidth: `${220 * uiScale}px`,
                                overflow: 'hidden',
                                padding: `${3 * uiScale}px ${6 * uiScale}px`,
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={`${cue.label}: ${cue.detail}`}
                        >
                            {cue.label}: {cue.detail}
                        </span>
                    ))}
                </div>
            )}
                </>
            ) : undefined}
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/u).pop() || path;
}

function composerHeaderActionStyle(uiScale: number) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: `${10 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        minHeight: `${24 * uiScale}px`,
        padding: `${2 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap',
    } as const;
}

function ComposerStatusChip({
    label,
    title,
    tone,
    uiScale,
    value,
}: {
    label: string;
    title?: string;
    tone?: 'warn';
    uiScale: number;
    value: string;
}) {
    const color = tone === 'warn' ? t.accent.yellow : t.text.muted;
    return (
        <span
            style={{
                alignItems: 'center',
                background: t.bg.panel,
                border: `1px solid ${tone === 'warn' ? t.accent.yellow : t.border.subtle}`,
                borderRadius: t.radius.sm,
                color: t.text.normal,
                display: 'inline-flex',
                fontSize: `${10 * uiScale}px`,
                gap: `${4 * uiScale}px`,
                maxWidth: `${220 * uiScale}px`,
                minHeight: `${24 * uiScale}px`,
                minWidth: 0,
                overflow: 'hidden',
                padding: `${2 * uiScale}px ${6 * uiScale}px`,
                whiteSpace: 'nowrap',
            }}
            title={title ?? `${label}: ${value}`}
        >
            <span style={{ color, flexShrink: 0, textTransform: 'uppercase' }}>{label}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        </span>
    );
}

function ComposerTile({ detail, icon, label, uiScale, value }: ComposerTileProperties) {
    return (
        <div
            style={{
                alignItems: 'center',
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'grid',
                gap: `${2 * uiScale}px`,
                gridTemplateColumns: 'auto 1fr',
                minWidth: 0,
                padding: `${5 * uiScale}px ${6 * uiScale}px`,
            }}
            title={detail ? `${label}: ${value} (${detail})` : `${label}: ${value}`}
        >
            {icon}
            <div style={{ minWidth: 0 }}>
                <div style={{ color: t.text.muted, fontSize: `${10 * uiScale}px` }}>{label}</div>
                <div
                    style={{
                        color: t.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {value}
                </div>
                {detail && <div style={{ color: t.text.faint, fontSize: `${10 * uiScale}px` }}>{detail}</div>}
            </div>
        </div>
    );
}

function formatSpriteState(sprite: SceneComposerSnapshot['sprites'][number]): string {
    const pose = sprite.pose ? `:${sprite.pose}` : '';
    return `${sprite.id}${pose}`;
}
