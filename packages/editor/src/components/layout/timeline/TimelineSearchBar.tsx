import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

import { editorTheme as t } from '../../../theme/editorTheme';

type Properties = {
    activeMatchDisplayIndex: number;
    inputId: string;
    isSearching: boolean;
    matchCount: number;
    onChangeQuery: (value: string) => void;

    onNextMatch: () => void;
    onPrevMatch: () => void;
    query: string;
    shown: number;
    total: number;

    uiScale: number;
};

export function TimelineSearchBar({
                                      activeMatchDisplayIndex,
                                      inputId,
                                      isSearching,
                                      matchCount,
                                      onChangeQuery,
                                      onNextMatch,
                                      onPrevMatch,
                                      query,
                                      shown,
                                      total,
                                      uiScale,
                                  }: Properties) {
    const iconButtonStyle = {
        background: t.bg.app,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: 4,
        color: t.text.muted,
        cursor: 'pointer',
        display: 'grid',
        height: 22 * uiScale,
        placeItems: 'center' as const,
        width: 22 * uiScale,
    };

    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.panel,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: 6,
                display: 'flex',
                gap: `${8 * uiScale}px`,
                marginBottom: `${8 * uiScale}px`,
                padding: `${6 * uiScale}px`,
            }}
        >
            <Search color={t.text.muted} size={14 * uiScale} />

            <input
                id={inputId}
                onChange={(e) => onChangeQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) onPrevMatch();
                        else onNextMatch();
                    }
                }}
                placeholder="Search timeline..."
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: t.text.primary,
                    flex: 1,
                    fontSize: `${13 * uiScale}px`,
                    outline: 'none',
                }}
                type="text"
                value={query}
            />

            <span
                style={{
                    color: t.text.muted,
                    fontSize: `${11 * uiScale}px`,
                    minWidth: `${44 * uiScale}px`,
                    padding: `0 ${4 * uiScale}px`,
                    textAlign: 'right',
                }}
                title="Visible root nodes"
            >
                {shown}/{total}
            </span>

            {isSearching && (
                <>
                    <span
                        style={{
                            color: t.text.muted,
                            fontSize: `${11 * uiScale}px`,
                            minWidth: `${40 * uiScale}px`,
                            padding: `0 ${4 * uiScale}px`,
                            textAlign: 'right',
                        }}
                        title="Search matches"
                    >
                        {matchCount === 0 ? '0/0' : `${activeMatchDisplayIndex}/${matchCount}`}
                    </span>

                    <button
                        disabled={matchCount === 0}
                        onClick={onPrevMatch}
                        style={{
                            ...iconButtonStyle,
                            cursor: matchCount === 0 ? 'not-allowed' : 'pointer',
                            opacity: matchCount === 0 ? 0.5 : 1,
                        }}
                        title="Previous match (Shift+Enter / Shift+Ctrl+G)"
                        type="button"
                    >
                        <ChevronUp size={12 * uiScale} />
                    </button>

                    <button
                        disabled={matchCount === 0}
                        onClick={onNextMatch}
                        style={{
                            ...iconButtonStyle,
                            cursor: matchCount === 0 ? 'not-allowed' : 'pointer',
                            opacity: matchCount === 0 ? 0.5 : 1,
                        }}
                        title="Next match (Enter / Ctrl+G)"
                        type="button"
                    >
                        <ChevronDown size={12 * uiScale} />
                    </button>
                </>
            )}

            {query && (
                <button
                    onClick={() => onChangeQuery('')}
                    style={iconButtonStyle}
                    title="Clear search"
                    type="button"
                >
                    <X size={12 * uiScale} />
                </button>
            )}
        </div>
    );
}