import { editorTheme as t } from '../../../theme/editorTheme';

type Chip = { count: number; type: string; };

type Properties = {
    activeType: string;
    chips: Chip[];
    onChange: (type: string) => void;
    uiScale: number;
};

export function TimelineTypeFilterChips({ activeType, chips, onChange, uiScale }: Properties) {
    const allCount = chips.reduce((accumulator, c) => accumulator + c.count, 0);

    const renderChip = (type: string, count: number, label = type) => {
        const active = activeType === type;
        return (
            <button
                key={type}
                onClick={() => onChange(type)}
                style={{
                    alignItems: 'center',
                    background: active ? t.bg.selected : t.bg.panel,
                    border: `1px solid ${active ? t.border.accent : t.border.subtle}`,
                    borderRadius: 999,
                    boxSizing: 'border-box',
                    color: active ? t.text.primary : t.text.muted,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    fontSize: `${11 * uiScale}px`,
                    height: `${24 * uiScale}px`,
                    justifyContent: 'center',
                    padding: `0 ${10 * uiScale}px`,
                    whiteSpace: 'nowrap',
                }}
                type="button"
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
                marginBottom: `${2 * uiScale}px`,
                overflowX: 'auto',
                paddingBottom: `${2 * uiScale}px`,
            }}
        >
            {renderChip('all', allCount, 'All')}
            {chips.map((c) => renderChip(c.type, c.count))}
        </div>
    );
}