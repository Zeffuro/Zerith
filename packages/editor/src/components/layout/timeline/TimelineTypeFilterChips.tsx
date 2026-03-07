import { editorTheme as t } from '../../../theme/editorTheme';

type Chip = { type: string; count: number };

type Props = {
    uiScale: number;
    chips: Chip[];
    activeType: string;
    onChange: (type: string) => void;
};

export function TimelineTypeFilterChips({ uiScale, chips, activeType, onChange }: Props) {
    const allCount = chips.reduce((acc, c) => acc + c.count, 0);

    const renderChip = (type: string, count: number, label = type) => {
        const active = activeType === type;
        return (
            <button
                key={type}
                type="button"
                onClick={() => onChange(type)}
                style={{
                    border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                    background: active ? t.bg.selected : t.bg.panel,
                    color: active ? t.text.primary : t.text.muted,
                    borderRadius: 999,
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    fontSize: `${11 * uiScale}px`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}
            >
                {label} ({count})
            </button>
        );
    };

    return (
        <div
            className="zerith-scrollbar"
            style={{
                display: 'flex',
                gap: `${6 * uiScale}px`,
                overflowX: 'auto',
                paddingBottom: `${6 * uiScale}px`,
                marginBottom: `${6 * uiScale}px`,
            }}
        >
            {renderChip('all', allCount, 'All')}
            {chips.map((c) => renderChip(c.type, c.count))}
        </div>
    );
}