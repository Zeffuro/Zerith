import type { CSSProperties } from 'react';

import type { LocalizationPanelRowStatus } from './localizationPanelModel';

import { editorTheme as t } from '../../theme/editorTheme';

export function actionButtonStyle(uiScale: number, disabled: boolean): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.primary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        justifyContent: 'center',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        whiteSpace: 'nowrap',
    };
}

export function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

export function comparisonColumnStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${4 * uiScale}px`,
        minWidth: 0,
    };
}

export function comparisonGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    };
}

export function comparisonLabelStyle(uiScale: number): CSSProperties {
    return {
        color: t.text.faint,
        fontSize: `${10 * uiScale}px`,
        fontWeight: 700,
        textTransform: 'uppercase',
    };
}

export function EmptyPanelMessage({ message, uiScale }: { message: string; uiScale: number }) {
    return (
        <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>
            {message}
        </div>
    );
}

export function filterLabelStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        color: t.text.muted,
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        whiteSpace: 'nowrap',
    };
}

export function filterRowStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'auto repeat(3, minmax(120px, 1fr))',
    };
}

export function formatLocalizationRowKind(kind: 'choice-option' | 'dialogue' | 'unused'): string {
    switch (kind) {
        case 'choice-option': {
            return 'choice label';
        }
        case 'dialogue': {
            return 'dialogue';
        }
        case 'unused': {
            return 'unused entry';
        }
    }
}

export function headerStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

export function iconButtonStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        display: 'inline-flex',
        justifyContent: 'center',
        padding: `${6 * uiScale}px`,
    };
}

export function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        outline: 'none',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        width: '100%',
    };
}

export function locationButtonStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        padding: `${3 * uiScale}px ${5 * uiScale}px`,
    };
}

export function locationListStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${5 * uiScale}px`,
    };
}

export function panelStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.app,
        color: t.text.normal,
        display: 'flex',
        flexDirection: 'column',
        gap: `${8 * uiScale}px`,
        height: '100%',
        overflow: 'auto',
        padding: `${10 * uiScale}px`,
    };
}

export function rowHeaderStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'start',
        display: 'grid',
        gap: `${8 * uiScale}px`,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
    };
}

export function rowStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

export function saveRowStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${6 * uiScale}px`,
        justifyContent: 'flex-end',
    };
}

export function sourceTextStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.popup,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        fontSize: `${11 * uiScale}px`,
        overflowWrap: 'anywhere',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

export function statusBadgeColor(status: LocalizationPanelRowStatus): string {
    switch (status) {
        case 'missing': {
            return t.accent.red;
        }
        case 'same': {
            return t.text.faint;
        }
        case 'translated': {
            return t.accent.green;
        }
        case 'unused': {
            return t.accent.yellow;
        }
    }
}

export function statusBadgeStyle(status: LocalizationPanelRowStatus, uiScale: number): CSSProperties {
    const color = statusBadgeColor(status);

    return {
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        fontSize: `${10 * uiScale}px`,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
        textTransform: 'uppercase',
    };
}

export function statusStyle(kind: 'error' | 'ok', uiScale: number): CSSProperties {
    const color = kind === 'ok' ? t.accent.green : t.accent.red;
    return {
        alignItems: 'center',
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

export function SummaryChip({
    label,
    tone,
    uiScale,
    value,
}: {
    label: string;
    tone?: 'bad' | 'good' | 'warn';
    uiScale: number;
    value: number;
}) {
    const color = summaryToneColor(tone);

    return (
        <div style={summaryChipStyle(uiScale)}>
            <span style={{ color: t.text.faint }}>{label}</span>
            <strong style={{ color }}>{value}</strong>
        </div>
    );
}

export function summaryChipStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${2 * uiScale}px`,
        minWidth: `${70 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

export function summaryGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
    };
}

export function summaryToneColor(tone: 'bad' | 'good' | 'warn' | undefined): string {
    switch (tone) {
        case 'bad': {
            return t.accent.red;
        }
        case 'good': {
            return t.accent.green;
        }
        case 'warn': {
            return t.accent.yellow;
        }
        default: {
            return t.text.normal;
        }
    }
}

export function textareaStyle(uiScale: number, dirty: boolean): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${dirty ? t.border.accent : t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        font: 'inherit',
        fontSize: `${12 * uiScale}px`,
        minHeight: `${66 * uiScale}px`,
        outline: 'none',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        resize: 'vertical',
        width: '100%',
    };
}

export function toolbarGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'minmax(90px, 0.7fr) minmax(120px, 1fr) auto',
    };
}
