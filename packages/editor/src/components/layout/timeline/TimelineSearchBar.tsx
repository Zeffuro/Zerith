import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { editorTheme as t } from '../../../theme/editorTheme';

type Props = {
    uiScale: number;
    query: string;
    onChangeQuery: (value: string) => void;
    shown: number;
    total: number;

    isSearching: boolean;
    matchCount: number;
    activeMatchDisplayIndex: number;
    onPrevMatch: () => void;
    onNextMatch: () => void;

    inputId: string;
};

export function TimelineSearchBar({
                                      uiScale,
                                      query,
                                      onChangeQuery,
                                      shown,
                                      total,
                                      isSearching,
                                      matchCount,
                                      activeMatchDisplayIndex,
                                      onPrevMatch,
                                      onNextMatch,
                                      inputId,
                                  }: Props) {
    const iconBtnStyle = {
        border: `1px solid ${t.border.subtle}`,
        background: t.bg.app,
        color: t.text.muted,
        borderRadius: 4,
        width: 22 * uiScale,
        height: 22 * uiScale,
        display: 'grid',
        placeItems: 'center' as const,
        cursor: 'pointer',
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${8 * uiScale}px`,
                marginBottom: `${8 * uiScale}px`,
                background: t.bg.panel,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: 6,
                padding: `${6 * uiScale}px`,
            }}
        >
            <Search size={14 * uiScale} color={t.text.muted} />

            <input
                id={inputId}
                type="text"
                value={query}
                onChange={(e) => onChangeQuery(e.target.value)}
                placeholder="Search timeline..."
                style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: t.text.primary,
                    fontSize: `${13 * uiScale}px`,
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) onPrevMatch();
                        else onNextMatch();
                    }
                }}
            />

            <span
                style={{
                    fontSize: `${11 * uiScale}px`,
                    color: t.text.muted,
                    padding: `0 ${4 * uiScale}px`,
                    minWidth: `${44 * uiScale}px`,
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
                            fontSize: `${11 * uiScale}px`,
                            color: t.text.muted,
                            padding: `0 ${4 * uiScale}px`,
                            minWidth: `${40 * uiScale}px`,
                            textAlign: 'right',
                        }}
                        title="Search matches"
                    >
                        {matchCount === 0 ? '0/0' : `${activeMatchDisplayIndex}/${matchCount}`}
                    </span>

                    <button
                        type="button"
                        onClick={onPrevMatch}
                        disabled={matchCount === 0}
                        title="Previous match (Shift+Enter / Shift+Ctrl+G)"
                        style={{
                            ...iconBtnStyle,
                            opacity: matchCount === 0 ? 0.5 : 1,
                            cursor: matchCount === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <ChevronUp size={12 * uiScale} />
                    </button>

                    <button
                        type="button"
                        onClick={onNextMatch}
                        disabled={matchCount === 0}
                        title="Next match (Enter / Ctrl+G)"
                        style={{
                            ...iconBtnStyle,
                            opacity: matchCount === 0 ? 0.5 : 1,
                            cursor: matchCount === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <ChevronDown size={12 * uiScale} />
                    </button>
                </>
            )}

            {query && (
                <button
                    type="button"
                    onClick={() => onChangeQuery('')}
                    title="Clear search"
                    style={iconBtnStyle}
                >
                    <X size={12 * uiScale} />
                </button>
            )}
        </div>
    );
}