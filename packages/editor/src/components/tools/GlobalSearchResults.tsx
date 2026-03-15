import { useMemo } from 'react';

import type { GlobalSearchMatch } from '../../services/globalSearch';

import { editorTheme as t } from '../../theme/editorTheme';
import { kindColor, makeMatchKey, summarizeText } from './globalSearchPanelModel';
import { groupMatchesByFile, indexMatches } from './globalSearchResultsModel';

export type GlobalSearchResultClickHandler = (match: GlobalSearchMatch, index: number) => void;

export type GlobalSearchResultsProperties = {
    activeResultIndex: number;
    onResultButtonReference?: (index: number, element: HTMLButtonElement | null) => void;
    onResultClick: GlobalSearchResultClickHandler;
    replacePreviewMap: Map<string, string>;
    results: GlobalSearchMatch[];
    uiScale: number;
};

export function GlobalSearchResults({
    activeResultIndex,
    onResultButtonReference,
    onResultClick,
    replacePreviewMap,
    results,
    uiScale,
}: GlobalSearchResultsProperties) {
    const grouped = useMemo(() => groupMatchesByFile(results), [results]);
    const resultIndexByMatch = useMemo(() => indexMatches(results), [results]);

    return (
        <>
            {grouped.map(([filePath, fileMatches]) => (
                <section key={filePath} style={sectionStyle(uiScale)}>
                    <div style={{ color: t.text.primary, fontWeight: 'bold' }}>{filePath}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px` }}>
                        {fileMatches.map((match, index) => {
                            const fallbackIndex = Math.max(0, index);
                            const globalIndex = resultIndexByMatch.get(match) ?? fallbackIndex;
                            const matchKey = makeMatchKey(match, globalIndex);
                            const replacedText = replacePreviewMap.get(matchKey);
                            return (
                                <button
                                    className="toolbar-btn"
                                    key={matchKey}
                                    onClick={() => onResultClick(match, globalIndex)}
                                    ref={(element) => onResultButtonReference?.(globalIndex, element)}
                                    style={{
                                        alignItems: 'flex-start',
                                        border: globalIndex === activeResultIndex
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
        </>
    );
}

export function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

