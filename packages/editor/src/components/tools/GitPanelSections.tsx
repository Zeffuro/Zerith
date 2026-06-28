import { CheckSquare, GitCommitHorizontal, ServerCog, ShieldCheck, Upload } from 'lucide-react';

import type {
    GitBranchSummaryReport,
    GitStatusReport,
} from '../../services/gitIntegration';
import type { GitRemotePolicyReport } from '../../services/gitIntegrationReport';
import type { GitBackendStrategyReport } from '../../services/gitIntegrationReport';
import type { GitPanelChangeSummary, GitPanelPushPreflight } from './gitPanelModel';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    branchRowStyle,
    emptyStateStyle,
    primaryActionButtonStyle,
    remoteRowStyle,
    sectionStyle,
    sectionTitleStyle,
    sectionTitleWithIconStyle,
    textAreaStyle,
    textInputStyle,
} from './gitPanelStyles';

export function GitBackendSection({
    backendStrategy,
    uiScale,
}: {
    backendStrategy: GitBackendStrategyReport;
    uiScale: number;
}) {
    const selected = backendStrategy.engines.find((engine) => engine.id === backendStrategy.selectedEngineId);

    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleWithIconStyle(uiScale)}>
                <ServerCog size={13 * uiScale} />
                <span>Backend Strategy</span>
            </div>
            <KeyValue label="Selected" uiScale={uiScale} value={selected?.label ?? backendStrategy.selectedEngineId} />
            <div style={emptyStateStyle(uiScale)}>{backendStrategy.recommendation}</div>
            {backendStrategy.engines.map((engine) => (
                <div key={engine.id} style={remoteRowStyle(uiScale, engine.status === 'selected' ? 'ready' : 'review')}>
                    <span style={{ color: t.text.primary, fontWeight: 700 }}>{engine.label}</span>
                    <span>{engine.status}</span>
                </div>
            ))}
        </section>
    );
}

export function GitBranchesSection({
    branchReport,
    uiScale,
}: {
    branchReport: GitBranchSummaryReport | undefined;
    uiScale: number;
}) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleStyle(uiScale)}>Branches</div>
            {branchReport?.status === 'ready' && branchReport.isRepository && branchReport.branches.length > 0 ? (
                branchReport.branches.slice(0, 12).map((branch) => (
                    <div key={branch.name} style={branchRowStyle(uiScale, branch.current)}>
                        <span>{branch.current ? '*' : ''}</span>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.name}</span>
                        {branch.upstream ? <span style={{ color: t.text.faint }}>{'->'} {branch.upstream}</span> : undefined}
                    </div>
                ))
            ) : (
                <div style={emptyStateStyle(uiScale)}>No branch summary available.</div>
            )}
        </section>
    );
}

export function GitCommitSection({
    canCommit,
    commitDescription,
    commitSummary,
    isBusy,
    isCommitting,
    isRepository,
    onCommit,
    onDescriptionChange,
    onSummaryChange,
    stagedCount,
    uiScale,
}: {
    canCommit: boolean;
    commitDescription: string;
    commitSummary: string;
    isBusy: boolean;
    isCommitting: boolean;
    isRepository: boolean;
    onCommit: () => void;
    onDescriptionChange: (value: string) => void;
    onSummaryChange: (value: string) => void;
    stagedCount: number;
    uiScale: number;
}) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleWithIconStyle(uiScale)}>
                <GitCommitHorizontal size={13 * uiScale} />
                <span>Commit</span>
            </div>
            <input
                disabled={!isRepository || isBusy}
                onChange={(event) => onSummaryChange(event.currentTarget.value)}
                placeholder="Commit summary"
                style={textInputStyle(uiScale, !isRepository || isBusy)}
                value={commitSummary}
            />
            <textarea
                disabled={!isRepository || isBusy}
                onChange={(event) => onDescriptionChange(event.currentTarget.value)}
                placeholder="Description"
                rows={4}
                style={textAreaStyle(uiScale, !isRepository || isBusy)}
                value={commitDescription}
            />
            <button className="toolbar-btn" disabled={isBusy || !canCommit} onClick={onCommit} style={primaryActionButtonStyle(uiScale, isBusy || !canCommit)} type="button">
                <CheckSquare size={13 * uiScale} />
                <span>{isCommitting ? 'Committing...' : `Commit ${stagedCount} File${stagedCount === 1 ? '' : 's'}`}</span>
            </button>
        </section>
    );
}

export function GitPushSection({
    isBusy,
    isCheckingPush,
    isPushing,
    isRepository,
    onCheckPush,
    onPush,
    onRemoteChange,
    pushPreflight,
    remoteOptions,
    selectedRemoteName,
    uiScale,
}: {
    isBusy: boolean;
    isCheckingPush: boolean;
    isPushing: boolean;
    isRepository: boolean;
    onCheckPush: () => void;
    onPush: () => void;
    onRemoteChange: (value: string) => void;
    pushPreflight: GitPanelPushPreflight;
    remoteOptions: string[];
    selectedRemoteName: string;
    uiScale: number;
}) {
    const canPush = isRepository && pushPreflight.canPush && selectedRemoteName.trim().length > 0;

    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleWithIconStyle(uiScale)}>
                <Upload size={13 * uiScale} />
                <span>Push</span>
            </div>
            <select
                disabled={!isRepository || isBusy || remoteOptions.length === 0}
                onChange={(event) => onRemoteChange(event.currentTarget.value)}
                style={textInputStyle(uiScale, !isRepository || isBusy || remoteOptions.length === 0)}
                value={selectedRemoteName}
            >
                {remoteOptions.length > 0 ? remoteOptions.map((remoteName) => (
                    <option key={remoteName} value={remoteName}>{remoteName}</option>
                )) : (
                    <option value="">No remotes</option>
                )}
            </select>
            <div style={remoteRowStyle(uiScale, pushPreflight.status)}>
                <span style={{ color: t.text.primary, fontWeight: 700 }}>{pushPreflight.credentialLabel}</span>
                {pushPreflight.effectivePushUrl ? <span>{pushPreflight.effectivePushUrl}</span> : undefined}
                <span>{pushPreflight.note}</span>
            </div>
            <div style={{ display: 'grid', gap: `${5 * uiScale}px`, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <button className="toolbar-btn" disabled={isBusy || !canPush} onClick={onCheckPush} style={primaryActionButtonStyle(uiScale, isBusy || !canPush)} type="button">
                    <ShieldCheck size={13 * uiScale} />
                    <span>{isCheckingPush ? 'Checking...' : 'Check Push'}</span>
                </button>
                <button className="toolbar-btn" disabled={isBusy || !canPush} onClick={onPush} style={primaryActionButtonStyle(uiScale, isBusy || !canPush)} type="button">
                    <Upload size={13 * uiScale} />
                    <span>{isPushing ? 'Pushing...' : 'Push'}</span>
                </button>
            </div>
        </section>
    );
}

export function GitRemotesSection({
    remotePolicy,
    uiScale,
}: {
    remotePolicy: GitRemotePolicyReport | undefined;
    uiScale: number;
}) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleStyle(uiScale)}>Remotes</div>
            {remotePolicy && remotePolicy.entries.length > 0 ? (
                <>
                    <div style={emptyStateStyle(uiScale)}>
                        Ready {remotePolicy.summary.ready} | Review {remotePolicy.summary.review} | Blocked {remotePolicy.summary.blocked}
                        {remotePolicy.recommendedRemote ? ` | Default ${remotePolicy.recommendedRemote}` : ''}
                    </div>
                    {remotePolicy.entries.slice(0, 8).map((entry) => (
                        <div key={entry.name} style={remoteRowStyle(uiScale, entry.status)}>
                            <span style={{ color: t.text.primary, fontWeight: 700 }}>{entry.name}</span>
                            <span>{entry.status} | {entry.transport} | {entry.credentialMode}</span>
                        </div>
                    ))}
                </>
            ) : (
                <div style={emptyStateStyle(uiScale)}>No remote policy available.</div>
            )}
        </section>
    );
}

export function GitRepositorySection({
    changeSummary,
    currentBranchLabel,
    lastMessage,
    statusReport,
    uiScale,
}: {
    changeSummary: GitPanelChangeSummary;
    currentBranchLabel: string;
    lastMessage: string | undefined;
    statusReport: GitStatusReport | undefined;
    uiScale: number;
}) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleStyle(uiScale)}>Repository</div>
            <KeyValue label="Branch" uiScale={uiScale} value={currentBranchLabel} />
            {statusReport?.status === 'ready' && statusReport.isRepository ? (
                <>
                    <KeyValue label="Ahead / behind" uiScale={uiScale} value={`${statusReport.ahead} / ${statusReport.behind}`} />
                    <KeyValue label="Changed files" uiScale={uiScale} value={String(changeSummary.total)} />
                    <KeyValue label="Staged / unstaged" uiScale={uiScale} value={`${changeSummary.staged} / ${changeSummary.unstaged}`} />
                    <KeyValue label="Diff" uiScale={uiScale} value={`+${changeSummary.insertions} / -${changeSummary.deletions}`} />
                </>
            ) : (
                <div style={emptyStateStyle(uiScale)}>{lastMessage}</div>
            )}
        </section>
    );
}

function KeyValue({
    label,
    uiScale,
    value,
}: {
    label: string;
    uiScale: number;
    value: string;
}) {
    return (
        <div style={{ display: 'grid', gap: `${5 * uiScale}px`, gridTemplateColumns: 'minmax(80px, auto) minmax(0, 1fr)' }}>
            <span style={{ color: t.text.faint }}>{label}</span>
            <span style={{ color: t.text.normal, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
        </div>
    );
}
