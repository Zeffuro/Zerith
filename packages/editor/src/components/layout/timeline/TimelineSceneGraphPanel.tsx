import type { ReactNode } from 'react';

import {
    ArrowRight,
    ExternalLink,
    Flag,
    GitFork,
    LocateFixed,
    MapPin,
    Plus,
    Settings,
} from 'lucide-react';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { SceneComposerGraphTargetStatus, SceneComposerSnapshot } from './sceneComposerModel';

import { editorTheme as t } from '../../../theme/editorTheme';
import {
    resolveMissingGraphMacroCreations,
    resolveMissingGraphSceneCreations,
} from './sceneComposerModel';
import { formatSceneComposerPath } from './sceneComposerPathModel';

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

type TimelineSceneGraphPanelProperties = {
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
    onSelectPath?: (path: ScriptPath) => void;
    snapshot: SceneComposerSnapshot;
    uiScale: number;
};

export function TimelineSceneGraphPanel({
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
    onSelectPath,
    snapshot,
    uiScale,
}: TimelineSceneGraphPanelProperties) {
    const graphChips = buildGraphChips(snapshot, {
        canOpenMacro,
        canOpenScene,
    });
    const missingGotoLabelCount = countMissingGotoLabels(snapshot);
    const missingMacros = resolveMissingGraphMacroCreations(snapshot.graph.calls);
    const missingJumpScenes = resolveMissingGraphSceneCreations(snapshot.graph.jumps);

    if (graphChips.length === 0) return;

    return (
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
    );
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
