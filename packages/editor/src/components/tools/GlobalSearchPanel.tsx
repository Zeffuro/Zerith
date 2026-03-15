import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { GlobalSearchMatch, GlobalSearchProjectData, GlobalSearchReplacementFile } from '../../services/globalSearch';

import { fsWriteTextFile } from '../../services/fs';
import { replaceProjectContent, searchProjectContent } from '../../services/globalSearch';
import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import { GlobalSearchInputBar } from './GlobalSearchInputBar';
import { cycleResultIndex, normalizeActiveResultIndex } from './globalSearchPanelModel';
import { GlobalSearchResults } from './GlobalSearchResults';
import { buildReplacePreviewMap, groupMatchesByFile } from './globalSearchResultsModel';

export function GlobalSearchContent({
    mode,
    onBeginDrag,
    onRequestClose,
}: {
    mode: 'panel' | 'popup';
    onBeginDrag?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onRequestClose?: () => void;
}) {
    const uiScale = useEditorStore((state) => state.uiScale);
    const globalSearchLaunchMode = useEditorStore((state) => state.globalSearchLaunchMode);
    const projectPath = useProjectStore((state) => state.projectPath);
    const scenes = useProjectStore((state) => state.scenes);
    const macros = useProjectStore((state) => state.macros);
    const characters = useProjectStore((state) => state.characters);
    const items = useProjectStore((state) => state.items);
    const manifest = useProjectStore((state) => state.manifest);

    const [query, setQuery] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [replaceText, setReplaceText] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [useRegex, setUseRegex] = useState(false);
    const [activeResultIndex, setActiveResultIndex] = useState(-1);
    const [pendingReplaceAllFiles, setPendingReplaceAllFiles] = useState<GlobalSearchReplacementFile[] | undefined>();
    const [pendingReplaceAllMatchCount, setPendingReplaceAllMatchCount] = useState(0);
    const [pendingReplaceAllGroupCount, setPendingReplaceAllGroupCount] = useState(0);
    const queryInputReference = useRef<HTMLInputElement>(null);
    const replaceInputReference = useRef<HTMLInputElement>(null);
    const resultButtonReferences = useRef<Record<number, HTMLButtonElement | null>>({});
    useEffect(() => {
        if (mode !== 'popup') return;
        if (globalSearchLaunchMode === 'replace') {
            replaceInputReference.current?.focus();
            replaceInputReference.current?.select();
            return;
        }
        queryInputReference.current?.focus();
        queryInputReference.current?.select();
    }, [globalSearchLaunchMode, mode]);
    const projectData = useMemo<GlobalSearchProjectData>(
        () => ({ characters, items, macros, manifest, projectPath, scenes }),
        [characters, items, macros, manifest, projectPath, scenes],
    );
    const trimmedQuery = query.trim();
    const regexError = useMemo(() => {
        if (!useRegex || !trimmedQuery) return;
        try {
            new RegExp(trimmedQuery);
            return;
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    }, [trimmedQuery, useRegex]);
    const results = useMemo(
        () => searchProjectContent(query, projectData, { caseSensitive, regex: useRegex }),
        [caseSensitive, projectData, query, useRegex],
    );
    const groupedResultCount = useMemo(() => groupMatchesByFile(results).length, [results]);
    const hasReplaceDraft = replaceText.length > 0;
    const replacePreview = useMemo(() => {
        if (regexError) return new Map<string, string>();
        return buildReplacePreviewMap(results, query, replaceText, { caseSensitive, regex: useRegex });
    }, [caseSensitive, query, regexError, replaceText, results, useRegex]);
    const normalizedActiveResultIndex = useMemo(() => normalizeActiveResultIndex(activeResultIndex, results.length), [activeResultIndex, results.length]);
    useEffect(() => {
        if (normalizedActiveResultIndex < 0) return;
        resultButtonReferences.current[normalizedActiveResultIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [normalizedActiveResultIndex]);
    const handleOpenMatch = async (match: GlobalSearchMatch) => {
        const options = match.kind === 'macro' || match.kind === 'scene' ? { forceView: 'timeline' as const } : undefined;
        await openProjectEntry(match.filePath, basename(match.filePath), options);
        if (match.path && (match.kind === 'macro' || match.kind === 'scene')) {
            const editor = useEditorStore.getState();
            editor.setSelectedNodePaths([match.path]);
            editor.setSelectionAnchorPath(match.path);
            return;
        }
        useEditorStore.getState().clearSelection();
    };
    const handleQueryInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (results.length === 0) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveResultIndex((previous) => cycleResultIndex(previous, results.length, 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveResultIndex((previous) => cycleResultIndex(previous, results.length, -1));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const direction = event.shiftKey ? -1 : 1;
            const nextIndex = cycleResultIndex(normalizedActiveResultIndex, results.length, direction);
            setActiveResultIndex(nextIndex);
            void handleOpenMatch(results[nextIndex]);
        }
    };
    const replaceableResults = useMemo(() => results.filter((result) => result.replaceable), [results]);
    const canReplace = hasReplaceDraft && trimmedQuery.length > 0 && !regexError;
    const applyReplacementFiles = async (files: GlobalSearchReplacementFile[]): Promise<number> => {
        let wroteCount = 0;
        for (const file of files) {
            try {
                await fsWriteTextFile(file.filePath, file.content);
                wroteCount += 1;
            } catch (error) {
                console.error('Failed to write replacement file:', file.filePath, error);
            }
        }
        if (wroteCount === 0) return 0;
        const workbench = useWorkbenchStore.getState();
        const updatedPathSet = new Set(files.map((file) => file.filePath));
        for (const tab of workbench.tabs) {
            if (!updatedPathSet.has(tab.path)) continue;
            const payload = files.find((file) => file.filePath === tab.path);
            if (!payload) continue;
            workbench.updateTabContent(tab.id, payload.content, { markDirty: false });
        }
        const project = useProjectStore.getState();
        await project.loadManifest();
        if (project.activeFile && updatedPathSet.has(project.activeFile)) {
            const changed = files.find((file) => file.filePath === project.activeFile);
            const options = changed && (changed.kind === 'macro' || changed.kind === 'scene') ? { forceView: 'timeline' as const } : undefined;
            await openProjectEntry(project.activeFile, basename(project.activeFile), options);
        }
        return wroteCount;
    };
    const handleReplaceOne = async () => {
        if (!canReplace) return;
        const target = results[normalizedActiveResultIndex] ?? results[0];
        if (!target || !target.replaceable) return;
        const files = replaceProjectContent(
            query,
            replaceText,
            [target],
            projectData,
            { caseSensitive, regex: useRegex },
        );
        const wroteCount = await applyReplacementFiles(files);
        setStatusMessage(wroteCount > 0 ? `Replaced 1 match in ${wroteCount} file(s).` : 'No changes were applied.');
        setActiveResultIndex((previous) => cycleResultIndex(previous, results.length, 1));
    };
    const handleReplaceAll = () => {
        if (!canReplace || replaceableResults.length === 0) return;
        const files = replaceProjectContent(
            query,
            replaceText,
            replaceableResults,
            projectData,
            { caseSensitive, regex: useRegex },
        );
        setPendingReplaceAllFiles(files);
        setPendingReplaceAllGroupCount(groupedResultCount);
        setPendingReplaceAllMatchCount(replaceableResults.length);
    };
    const handleConfirmReplaceAll = async () => {
        const files = pendingReplaceAllFiles;
        if (!files || files.length === 0) {
            setPendingReplaceAllFiles(undefined);
            setStatusMessage('No changes were applied.');
            return;
        }
        const wroteCount = await applyReplacementFiles(files);
        setStatusMessage(wroteCount > 0 ? `Replaced ${pendingReplaceAllMatchCount} match(es) in ${wroteCount} file(s).` : 'No changes were applied.');
        setPendingReplaceAllFiles(undefined);
    };
    return (
        <div
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                border: mode === 'popup' ? `1px solid ${t.border.input}` : undefined,
                borderRadius: mode === 'popup' ? t.radius.md : undefined,
                boxShadow: mode === 'popup' ? '0 10px 26px rgba(0, 0, 0, 0.45)' : undefined,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                gap: `${8 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <div
                onMouseDown={mode === 'popup' ? onBeginDrag : undefined}
                style={{
                    alignItems: 'center',
                    cursor: mode === 'popup' ? 'move' : 'default',
                    display: 'flex',
                    gap: `${6 * uiScale}px`,
                    userSelect: mode === 'popup' ? 'none' : undefined,
                }}
            >
                <Search size={14 * uiScale} />
                <strong>{mode === 'popup' ? (globalSearchLaunchMode === 'replace' ? 'Find and Replace in Project' : 'Find in Project') : 'Global Search'}</strong>
                <span style={{ color: t.text.faint, marginLeft: 'auto' }}>{results.length} result(s)</span>
                {mode === 'popup' && (
                    <button
                        className="toolbar-btn"
                        onClick={onRequestClose}
                        onMouseDown={(event) => event.stopPropagation()}
                        style={{ padding: `${2 * uiScale}px` }}
                        title="Close Search (Esc)"
                    >
                        <X size={14 * uiScale} />
                    </button>
                )}
            </div>
            <GlobalSearchInputBar
                canReplace={canReplace}
                caseSensitive={caseSensitive}
                onNavigateKeyDown={handleQueryInputKeyDown}
                onReplaceAll={handleReplaceAll}
                onReplaceOne={() => void handleReplaceOne()}
                query={query}
                queryInputReference={queryInputReference}
                regexError={regexError}
                replaceableResultCount={replaceableResults.length}
                replaceInputReference={replaceInputReference}
                replaceText={replaceText}
                setCaseSensitive={setCaseSensitive}
                setQuery={setQuery}
                setReplaceText={setReplaceText}
                setUseRegex={setUseRegex}
                uiScale={uiScale}
                useRegex={useRegex}
            />
            <ConfirmDialog
                cancelText="Cancel"
                confirmText="Replace All"
                message={`Replace ${pendingReplaceAllMatchCount} match(es) across ${pendingReplaceAllGroupCount} file group(s)?`}
                onCancel={() => setPendingReplaceAllFiles(undefined)}
                onConfirm={() => void handleConfirmReplaceAll()}
                open={Boolean(pendingReplaceAllFiles)}
                title="Confirm Replace All"
            />
            {statusMessage && <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>{statusMessage}</div>}
            <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                Replaceable hits: {replaceableResults.length} - Preview replacements: {hasReplaceDraft ? replacePreview.size : 0}
            </div>
            {!query.trim() && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>Type to search across project content.</div>}
            {trimmedQuery && results.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No matches found.</div>}
            <GlobalSearchResults
                activeResultIndex={normalizedActiveResultIndex}
                onResultButtonReference={(index, element) => {
                    resultButtonReferences.current[index] = element;
                }}
                onResultClick={(match, index) => { setActiveResultIndex(index); void handleOpenMatch(match); }}
                replacePreviewMap={replacePreview}
                results={results}
                uiScale={uiScale}
            />
        </div>
    );
}

export function GlobalSearchPanel() {
    return <GlobalSearchContent mode="panel" />;
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}
