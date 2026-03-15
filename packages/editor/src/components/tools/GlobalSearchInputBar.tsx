import type { Dispatch, RefObject, SetStateAction } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';

export type GlobalSearchInputBarProperties = {
    canReplace: boolean;
    caseSensitive: boolean;
    onNavigateKeyDown: GlobalSearchInputNavigateKeyDownHandler;
    onReplaceAll: () => void;
    onReplaceOne: () => void;
    query: string;
    queryInputReference: RefObject<HTMLInputElement | null>;
    regexError?: string;
    replaceableResultCount: number;
    replaceInputReference: RefObject<HTMLInputElement | null>;
    replaceText: string;
    setCaseSensitive: Dispatch<SetStateAction<boolean>>;
    setQuery: Dispatch<SetStateAction<string>>;
    setReplaceText: Dispatch<SetStateAction<string>>;
    setUseRegex: Dispatch<SetStateAction<boolean>>;
    uiScale: number;
    useRegex: boolean;
};

export type GlobalSearchInputNavigateKeyDownHandler = (event: React.KeyboardEvent<HTMLInputElement>) => void;

export function GlobalSearchInputBar({
    canReplace,
    caseSensitive,
    onNavigateKeyDown,
    onReplaceAll,
    onReplaceOne,
    query,
    queryInputReference,
    regexError,
    replaceableResultCount,
    replaceInputReference,
    replaceText,
    setCaseSensitive,
    setQuery,
    setReplaceText,
    setUseRegex,
    uiScale,
    useRegex,
}: GlobalSearchInputBarProperties) {
    return (
        <>
            <input
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onNavigateKeyDown}
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

            <div style={{ display: 'flex', gap: `${6 * uiScale}px` }}>
                <button
                    className="toolbar-btn"
                    onClick={() => setCaseSensitive((value) => !value)}
                    style={{
                        border: `1px solid ${caseSensitive ? t.border.accent : t.border.subtle}`,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    }}
                    type="button"
                >
                    Case Sensitive
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => setUseRegex((value) => !value)}
                    style={{
                        border: `1px solid ${useRegex ? t.border.accent : t.border.subtle}`,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    }}
                    type="button"
                >
                    Regex
                </button>
            </div>

            <input
                onChange={(event) => setReplaceText(event.target.value)}
                onKeyDown={onNavigateKeyDown}
                placeholder="Replace text..."
                ref={replaceInputReference}
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

            <div style={{ display: 'flex', gap: `${6 * uiScale}px` }}>
                <button
                    className="toolbar-btn"
                    disabled={!canReplace || replaceableResultCount === 0}
                    onClick={onReplaceOne}
                    style={{ padding: `${4 * uiScale}px ${10 * uiScale}px` }}
                    type="button"
                >
                    Replace
                </button>
                <button
                    className="toolbar-btn"
                    disabled={!canReplace || replaceableResultCount === 0}
                    onClick={onReplaceAll}
                    style={{ padding: `${4 * uiScale}px ${10 * uiScale}px` }}
                    type="button"
                >
                    Replace All
                </button>
            </div>

            {regexError && (
                <div style={{ color: t.accent.red, fontSize: `${11 * uiScale}px` }}>
                    Invalid regex: {regexError}
                </div>
            )}
        </>
    );
}

