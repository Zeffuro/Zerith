import {
    AlertTriangle,
    ArrowRight,
    ChevronDown,
    ChevronRight,
    CloudRain,
    ExternalLink,
    Flag,
    GitFork,
    Image as ImageIcon,
    LocateFixed,
    MapPin,
    MessageSquare,
    Music,
    Plus,
    Settings,
    User,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { SceneComposerGraphTargetStatus, SceneComposerSnapshot } from './sceneComposerModel';

import { editorTheme as t } from '../../../theme/editorTheme';
import { resolveMissingGraphMacroCreations, resolveMissingGraphSceneCreations } from './sceneComposerModel';
import { formatSceneComposerPath } from './sceneComposerPathModel';

type ComposerTileProperties = {
    detail?: string;
    icon: ReactNode;
    label: string;
    uiScale: number;
    value: string;
};

type GraphChipModel = {
    canCreateLabel?: boolean;
    canCreateMacro?: boolean;
    canCreateScene?: boolean;
    canOpenMacro?: boolean;
    canOpenMissingSceneTarget?: boolean;
    canOpenScene?: boolean;
    icon: ReactNode;
    kind: 'call' | 'goto' | 'jump' | 'label';
    label: string;
    path: ScriptPath;
    status?: SceneComposerGraphTargetStatus;
    targetMacro?: string;
    targetPath?: ScriptPath;
    targetScene?: string;
    title: string;
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
    const graphChips = buildGraphChips(snapshot, {
        canOpenMacro,
        canOpenScene,
    });
    const missingGotoLabelCount = countMissingGotoLabels(snapshot);
    const missingMacros = resolveMissingGraphMacroCreations(snapshot.graph.calls);
    const missingJumpScenes = resolveMissingGraphSceneCreations(snapshot.graph.jumps);

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

            {graphChips.length > 0 && (
                <div
                    style={{
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.sm,
                        display: 'grid',
                        gap: `${5 * uiScale}px`,
                        padding: `${6 * uiScale}px`,
                    }}
                >
                    <div
                        style={{
                            alignItems: 'center',
                            color: t.text.muted,
                            display: 'flex',
                            fontSize: `${10 * uiScale}px`,
                            gap: `${6 * uiScale}px`,
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>Graph{snapshot.graph.currentSceneName ? `: ${snapshot.graph.currentSceneName}` : ''}</span>
                        <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                            {missingGotoLabelCount > 1 && onCreateMissingLabels ? (
                                <button
                                    className="toolbar-btn"
                                    onClick={onCreateMissingLabels}
                                    style={graphHeaderActionStyle(uiScale)}
                                    title={`Create ${missingGotoLabelCount} missing labels`}
                                    type="button"
                                >
                                    <Plus size={11 * uiScale} />
                                    <span>Create Labels ({missingGotoLabelCount})</span>
                                </button>
                            ) : undefined}
                            {missingJumpScenes.length > 1 && onCreateMissingScenes ? (
                                <button
                                    className="toolbar-btn"
                                    onClick={() => onCreateMissingScenes(missingJumpScenes)}
                                    style={graphHeaderActionStyle(uiScale)}
                                    title={`Create ${missingJumpScenes.length} missing scenes`}
                                    type="button"
                                >
                                    <Plus size={11 * uiScale} />
                                    <span>Create Scenes ({missingJumpScenes.length})</span>
                                </button>
                            ) : undefined}
                            {missingMacros.length > 1 && onCreateMissingMacros ? (
                                <button
                                    className="toolbar-btn"
                                    onClick={() => onCreateMissingMacros(missingMacros)}
                                    style={graphHeaderActionStyle(uiScale)}
                                    title={`Create ${missingMacros.length} missing macros`}
                                    type="button"
                                >
                                    <Plus size={11 * uiScale} />
                                    <span>Create Macros ({missingMacros.length})</span>
                                </button>
                            ) : undefined}
                            <span>
                                {snapshot.graph.labels.length} labels / {snapshot.graph.gotos.length + snapshot.graph.jumps.length} exits / {snapshot.graph.calls.length} calls
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${5 * uiScale}px` }}>
                        {graphChips.slice(0, 10).map((chip) => (
                            <GraphChip
                                chip={chip}
                                key={`${chip.kind}:${chip.path.join('.')}:${chip.label}`}
                                onCreateLabel={onCreateLabel}
                                onCreateMissingMacro={onCreateMissingMacro}
                                onCreateMissingScene={onCreateMissingScene}
                                onOpenMacro={onOpenMacro}
                                onOpenMissingSceneTarget={onOpenMissingSceneTarget}
                                onOpenScene={onOpenScene}
                                onSelectPath={onSelectPath}
                                uiScale={uiScale}
                            />
                        ))}
                        {graphChips.length > 10 ? (
                            <span style={{ color: t.text.faint, fontSize: `${10 * uiScale}px`, padding: `${3 * uiScale}px 0` }}>
                                +{graphChips.length - 10} more
                            </span>
                        ) : undefined}
                    </div>
                </div>
            )}

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

function buildGraphChips(
    snapshot: SceneComposerSnapshot,
    options: {
        canOpenMacro?: (macroName: string) => boolean;
        canOpenScene?: (sceneName: string) => boolean;
    },
): GraphChipModel[] {
    return [
        ...snapshot.graph.labels.map((label) => ({
            icon: <Flag aria-hidden size={12} />,
            kind: 'label' as const,
            label: label.name,
            path: label.path,
            title: `Label: ${label.name} at ${formatSceneComposerPath(label.path)}`,
        })),
        ...snapshot.graph.calls.map((call) => ({
            canCreateMacro: call.status === 'missing' && call.macroName.length > 0,
            canOpenMacro: call.status === 'ok'
                && call.macroName.length > 0
                && (options.canOpenMacro?.(call.macroName) ?? false),
            icon: <GitFork aria-hidden size={12} />,
            kind: 'call' as const,
            label: call.macroName || '(missing macro)',
            path: call.path,
            status: call.status,
            targetMacro: call.macroName,
            title: `Macro call: ${call.macroName || '(missing macro)'} at ${formatSceneComposerPath(call.path)}`,
        })),
        ...snapshot.graph.gotos.map((goto) => ({
            canCreateLabel: goto.status === 'missing' && goto.label.length > 0,
            icon: <MapPin aria-hidden size={12} />,
            kind: 'goto' as const,
            label: goto.label || '(missing label)',
            path: goto.path,
            status: goto.status,
            targetPath: goto.targetPath,
            title: `Goto: ${goto.label || '(missing label)'} at ${formatSceneComposerPath(goto.path)}`,
        })),
        ...snapshot.graph.jumps.map((jump) => ({
            canCreateScene: jump.status === 'missing' && jump.targetScene.length > 0,
            canOpenMissingSceneTarget: jump.status === 'missing' && jump.targetScene.length > 0,
            canOpenScene: jump.status === 'ok'
                && jump.targetScene.length > 0
                && (options.canOpenScene?.(jump.targetScene) ?? true),
            icon: <ArrowRight aria-hidden size={12} />,
            kind: 'jump' as const,
            label: jump.targetScene || '(missing scene)',
            path: jump.path,
            status: jump.status,
            targetScene: jump.targetScene,
            title: `Jump: ${jump.targetScene || '(missing scene)'} at ${formatSceneComposerPath(jump.path)}`,
        })),
    ];
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

function countMissingGotoLabels(snapshot: SceneComposerSnapshot): number {
    const labels = new Set<string>();
    for (const goto of snapshot.graph.gotos) {
        const label = goto.label.trim();
        if (goto.status === 'missing' && label) {
            labels.add(label);
        }
    }
    return labels.size;
}

function formatSpriteState(sprite: SceneComposerSnapshot['sprites'][number]): string {
    const pose = sprite.pose ? `:${sprite.pose}` : '';
    return `${sprite.id}${pose}`;
}

function GraphChip({
    chip,
    onCreateLabel,
    onCreateMissingMacro,
    onCreateMissingScene,
    onOpenMacro,
    onOpenMissingSceneTarget,
    onOpenScene,
    onSelectPath,
    uiScale,
}: {
    chip: GraphChipModel;
    onCreateLabel?: (label: string, sourcePath: ScriptPath) => void;
    onCreateMissingMacro?: (macroName: string) => void;
    onCreateMissingScene?: (sceneName: string) => void;
    onOpenMacro?: (macroName: string) => void;
    onOpenMissingSceneTarget?: (sceneName: string) => void;
    onOpenScene?: (sceneName: string) => void;
    onSelectPath?: (path: ScriptPath) => void;
    uiScale: number;
}) {
    const content = (
        <>
            {chip.icon}
            <span style={{ color: t.text.faint, textTransform: 'uppercase' }}>{chip.kind}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chip.label}</span>
        </>
    );
    const style = graphChipStyle(uiScale, chip.status);
    const targetMacro = chip.targetMacro;
    const targetPath = chip.targetPath;
    const targetScene = chip.targetScene;
    const createLabelButton = chip.canCreateLabel && onCreateLabel ? (
        <button
            aria-label={`Create label ${chip.label}`}
            className="toolbar-btn"
            onClick={() => onCreateLabel(chip.label, chip.path)}
            style={graphChipActionStyle(uiScale, t.accent.red)}
            title={`Create label: ${chip.label}`}
            type="button"
        >
            <Plus size={11 * uiScale} />
        </button>
    ) : undefined;
    const createMacroButton = chip.canCreateMacro && targetMacro && onCreateMissingMacro ? (
        <button
            aria-label={`Create macro ${targetMacro}`}
            className="toolbar-btn"
            onClick={() => onCreateMissingMacro(targetMacro)}
            style={graphChipActionStyle(uiScale, t.accent.red)}
            title={`Create macro: ${targetMacro}`}
            type="button"
        >
            <Plus size={11 * uiScale} />
        </button>
    ) : undefined;
    const createSceneButton = chip.canCreateScene && targetScene && onCreateMissingScene ? (
        <button
            aria-label={`Create scene ${targetScene}`}
            className="toolbar-btn"
            onClick={() => onCreateMissingScene(targetScene)}
            style={graphChipActionStyle(uiScale, t.accent.red)}
            title={`Create scene: ${targetScene}`}
            type="button"
        >
            <Plus size={11 * uiScale} />
        </button>
    ) : undefined;
    const targetButton = targetPath && onSelectPath ? (
        <button
            aria-label={`Select target label ${chip.label}`}
            className="toolbar-btn"
            onClick={() => onSelectPath(targetPath)}
            style={graphChipActionStyle(uiScale, t.accent.green)}
            title={`Select target label: ${chip.label}`}
            type="button"
        >
            <LocateFixed size={11 * uiScale} />
        </button>
    ) : undefined;
    const sceneButton = chip.canOpenScene && targetScene && onOpenScene ? (
        <button
            aria-label={`Open scene ${targetScene}`}
            className="toolbar-btn"
            onClick={() => onOpenScene(targetScene)}
            style={graphChipActionStyle(uiScale, t.accent.green)}
            title={`Open scene: ${targetScene}`}
            type="button"
        >
            <ExternalLink size={11 * uiScale} />
        </button>
    ) : undefined;
    const macroButton = chip.canOpenMacro && targetMacro && onOpenMacro ? (
        <button
            aria-label={`Open macro ${targetMacro}`}
            className="toolbar-btn"
            onClick={() => onOpenMacro(targetMacro)}
            style={graphChipActionStyle(uiScale, t.accent.green)}
            title={`Open macro: ${targetMacro}`}
            type="button"
        >
            <ExternalLink size={11 * uiScale} />
        </button>
    ) : undefined;
    const missingSceneButton = chip.canOpenMissingSceneTarget && targetScene && onOpenMissingSceneTarget ? (
        <button
            aria-label={`Open project settings for ${targetScene}`}
            className="toolbar-btn"
            onClick={() => onOpenMissingSceneTarget(targetScene)}
            style={graphChipActionStyle(uiScale, t.accent.red)}
            title={`Open project settings for missing scene: ${targetScene}`}
            type="button"
        >
            <Settings size={11 * uiScale} />
        </button>
    ) : undefined;

    if (!onSelectPath) {
        return (
            <span style={graphChipGroupStyle(uiScale)}>
                <span style={style} title={chip.title}>
                    {content}
                </span>
                {createLabelButton}
                {createMacroButton}
                {createSceneButton}
                {macroButton}
                {missingSceneButton}
                {sceneButton}
            </span>
        );
    }

    return (
        <span style={graphChipGroupStyle(uiScale)}>
            <button
                className="toolbar-btn"
                onClick={() => onSelectPath(chip.path)}
                style={{ ...style, cursor: 'pointer' }}
                title={`${chip.title} - select command`}
                type="button"
            >
                {content}
            </button>
            {createLabelButton}
            {targetButton}
            {createMacroButton}
            {createSceneButton}
            {macroButton}
            {missingSceneButton}
            {sceneButton}
        </span>
    );
}

function graphChipActionStyle(uiScale: number, color: string) {
    return {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        cursor: 'pointer',
        display: 'inline-flex',
        justifyContent: 'center',
        padding: `${3 * uiScale}px`,
    } as const;
}

function graphChipGroupStyle(uiScale: number) {
    return {
        alignItems: 'center',
        display: 'inline-flex',
        gap: `${3 * uiScale}px`,
    } as const;
}

function graphChipStyle(uiScale: number, status: SceneComposerGraphTargetStatus | undefined) {
    const color = status === 'missing'
        ? t.accent.red
        : (status === 'ok' ? t.accent.green : t.text.muted);

    return {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        display: 'inline-flex',
        fontSize: `${10 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        maxWidth: `${190 * uiScale}px`,
        overflow: 'hidden',
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    } as const;
}

function graphHeaderActionStyle(uiScale: number) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.accent.red}`,
        borderRadius: t.radius.sm,
        color: t.accent.red,
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: `${10 * uiScale}px`,
        gap: `${3 * uiScale}px`,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
        whiteSpace: 'nowrap',
    } as const;
}
