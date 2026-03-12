import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { GlobalSearchMatch, GlobalSearchProjectData } from '../../services/globalSearch';

import { searchProjectContent } from '../../services/globalSearch';
import { openProjectEntry } from '../../services/openProjectEntry';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';

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
    const projectPath = useProjectStore((state) => state.projectPath);
    const scenes = useProjectStore((state) => state.scenes);
    const macros = useProjectStore((state) => state.macros);
    const characters = useProjectStore((state) => state.characters);
    const items = useProjectStore((state) => state.items);
    const manifest = useProjectStore((state) => state.manifest);

    const [query, setQuery] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [activeResultIndex, setActiveResultIndex] = useState(-1);
    const queryInputReference = useRef<HTMLInputElement>(null);
    const resultButtonReferences = useRef<Record<number, HTMLButtonElement | null>>({});

    useEffect(() => {
        if (mode !== 'popup') return;
        queryInputReference.current?.focus();
        queryInputReference.current?.select();
    }, [mode]);

    const results = useMemo(() => {
        const projectData: GlobalSearchProjectData = {
            characters,
            items,
            macros,
            manifest,
            projectPath,
            scenes,
        };
        return searchProjectContent(query, projectData);
    }, [characters, items, macros, manifest, projectPath, query, scenes]);

    const grouped = useMemo(() => {
        const groups = new Map<string, GlobalSearchMatch[]>();
        for (const result of results) {
            if (!groups.has(result.filePath)) {
                groups.set(result.filePath, []);
            }
            groups.get(result.filePath)?.push(result);
        }
        return [...groups.entries()];
    }, [results]);

    const resultIndexByMatch = useMemo(() => {
        const map = new Map<GlobalSearchMatch, number>();
        for (const [index, result] of results.entries()) {
            map.set(result, index);
        }
        return map;
    }, [results]);

    const hasReplaceDraft = replaceText.length > 0;
    const trimmedQuery = query.trim();
    const replacePreview = useMemo(() => {
        if (!trimmedQuery || !hasReplaceDraft) {
            return new Map<string, string>();
        }

        const next = new Map<string, string>();
        for (const [index, match] of results.entries()) {
            if (!match.replaceable) continue;
            const replaced = replaceCaseInsensitive(match.matchedValue, trimmedQuery, replaceText);
            if (replaced !== match.matchedValue) {
                next.set(makeMatchKey(match, index), replaced);
            }
        }
        return next;
    }, [hasReplaceDraft, replaceText, results, trimmedQuery]);

    const normalizedActiveResultIndex = useMemo(
        () => normalizeActiveResultIndex(activeResultIndex, results.length),
        [activeResultIndex, results.length]
    );

    useEffect(() => {
        if (normalizedActiveResultIndex < 0) return;
        resultButtonReferences.current[normalizedActiveResultIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [normalizedActiveResultIndex]);

    const handleOpenMatch = async (match: GlobalSearchMatch) => {
        const options = match.kind === 'macro' || match.kind === 'scene'
            ? { forceView: 'timeline' as const }
            : undefined;

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
                <strong>{mode === 'popup' ? 'Find in Project' : 'Global Search'}</strong>
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

            <input
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleQueryInputKeyDown}
                placeholder="Search scenes, macros, characters, items..."
                ref={queryInputReference}
                style={{
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    borderRadius: t.radius.sm,
                    color: t.text.primary,
                    fontSize: `${12 * uiScale}px`,
                    outline: 'none',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                }}
                value={query}
            />

            <input
                onChange={(event) => setReplaceText(event.target.value)}
                onKeyDown={handleQueryInputKeyDown}
                placeholder="Replace preview (no write yet)..."
                style={{
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    borderRadius: t.radius.sm,
                    color: t.text.primary,
                    fontSize: `${12 * uiScale}px`,
                    outline: 'none',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                }}
                value={replaceText}
            />

            <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                Replaceable hits: {results.filter((result) => result.replaceable).length} - Preview replacements: {hasReplaceDraft ? replacePreview.size : 0}
            </div>

            {!query.trim() && (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>Type to search across project content.</div>
            )}

            {query.trim() && grouped.length === 0 && (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No matches found.</div>
            )}

            {grouped.map(([filePath, fileMatches]) => (
                <section key={filePath} style={sectionStyle(uiScale)}>
                    <div style={{ color: t.text.primary, fontWeight: 'bold' }}>{filePath}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px` }}>
                        {fileMatches.map((match, index) => {
                            const fallbackIndex = Math.max(0, index);
                            const globalIndex = resultIndexByMatch.get(match) ?? fallbackIndex;
                            const matchKey = makeMatchKey(match, globalIndex);
                            const replacedText = replacePreview.get(matchKey);
                            return (
                            <button
                                className="toolbar-btn"
                                key={matchKey}
                                onClick={() => {
                                    setActiveResultIndex(globalIndex);
                                    void handleOpenMatch(match);
                                }}
                                ref={(element) => {
                                    resultButtonReferences.current[globalIndex] = element;
                                }}
                                style={{
                                    alignItems: 'flex-start',
                                    border: globalIndex === normalizedActiveResultIndex
                                        ? `1px solid ${t.border.accent}`
                                        : `1px solid ${t.border.subtle}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: `${2 * uiScale}px`,
                                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                            >
                                <span style={{ color: kindColor(match.kind), fontSize: `${11 * uiScale}px` }}>
                                    {match.kind.toUpperCase()} - {match.label}
                                </span>
                                <span style={{ color: t.text.normal, wordBreak: 'break-word' }}>{match.preview}</span>
                                {replacedText && (
                                    <span style={{ color: '#f59e0b', wordBreak: 'break-word' }}>
                                        Preview: {summarizeText(replacedText)}
                                    </span>
                                )}
                                {match.path && (
                                    <span style={{ color: t.text.faint, fontSize: `${10 * uiScale}px` }}>
                                        Path: {match.path.join('.')}
                                    </span>
                                )}
                            </button>
                        );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

export function GlobalSearchPanel() {
    return <GlobalSearchContent mode="panel" />;
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function cycleResultIndex(current: number, length: number, delta: -1 | 1): number {
    if (length <= 0) return -1;
    if (current < 0) return delta > 0 ? 0 : length - 1;
    if (delta > 0) return (current + 1) % length;
    return (current - 1 + length) % length;
}

function kindColor(kind: GlobalSearchMatch['kind']): string {
    if (kind === 'scene') return '#60a5fa';
    if (kind === 'macro') return '#a78bfa';
    if (kind === 'character') return '#34d399';
    return '#fbbf24';
}

function makeMatchKey(match: GlobalSearchMatch, index: number): string {
    return `${match.filePath}-${match.valuePath?.join('.') ?? match.path?.join('.') ?? 'root'}-${index}`;
}

function normalizeActiveResultIndex(activeResultIndex: number, resultCount: number): number {
    if (resultCount <= 0) return -1;
    if (activeResultIndex < 0) return 0;
    if (activeResultIndex >= resultCount) return resultCount - 1;
    return activeResultIndex;
}

function replaceCaseInsensitive(source: string, needle: string, replacement: string): string {
    if (!needle) return source;
    const escapedNeedle = needle.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const expression = new RegExp(escapedNeedle, 'gi');
    return source.replaceAll(expression, replacement);
}

function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function summarizeText(value: string): string {
    if (value.length <= 120) return value;
    return `${value.slice(0, 117)}...`;
}


