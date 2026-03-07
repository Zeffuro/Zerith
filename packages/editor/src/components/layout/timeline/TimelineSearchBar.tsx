import { Search, X } from 'lucide-react';
import { editorTheme as t } from '../../../theme/editorTheme';

type Props = {
    uiScale: number;
    query: string;
    onChangeQuery: (value: string) => void;
    shown: number;
    total: number;
};

export function TimelineSearchBar({ uiScale, query, onChangeQuery, shown, total }: Props) {
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
            />

            <span
                style={{
                    fontSize: `${11 * uiScale}px`,
                    color: t.text.muted,
                    padding: `0 ${6 * uiScale}px`,
                }}
            >
                {shown}/{total}
            </span>

            {query && (
                <button
                    type="button"
                    onClick={() => onChangeQuery('')}
                    title="Clear search"
                    style={{
                        border: `1px solid ${t.border.subtle}`,
                        background: t.bg.app,
                        color: t.text.muted,
                        borderRadius: 4,
                        width: 22 * uiScale,
                        height: 22 * uiScale,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <X size={12 * uiScale} />
                </button>
            )}
        </div>
    );
}