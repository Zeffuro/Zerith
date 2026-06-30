import { editorTheme as t } from '../../theme/editorTheme';
import { minimumInteractiveTargetSize } from '../../theme/styleHelpers';

export function actionButtonStyle(uiScale: number, disabled: boolean, emphasized = false) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : (emphasized ? t.text.primary : t.text.normal),
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        gap: `${6 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        textAlign: 'left' as const,
    };
}

export function folderGroupButtonStyle(uiScale: number, selected: boolean) {
    return {
        alignItems: 'center',
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        minWidth: 0,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
    };
}

export function folderGroupGridStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${5 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    };
}

export function kindSummaryChipStyle(uiScale: number, selected: boolean) {
    return {
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${11 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

export function kindSummaryRowStyle(uiScale: number) {
    return {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: `${5 * uiScale}px`,
    };
}

export function metadataChipRowStyle(uiScale: number) {
    return {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: `${4 * uiScale}px`,
    };
}

export function metadataChipStyle(uiScale: number, kind: 'collection' | 'tag') {
    return {
        background: kind === 'collection' ? t.bg.panel : t.bg.selected,
        border: `1px solid ${kind === 'collection' ? t.border.subtle : t.border.focus}`,
        borderRadius: t.radius.sm,
        color: kind === 'collection' ? t.text.muted : t.text.primary,
        fontSize: `${10 * uiScale}px`,
        lineHeight: 1.2,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
    };
}

export function miniButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

export function searchBoxStyle(uiScale: number) {
    return {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        padding: `${5 * uiScale}px ${7 * uiScale}px`,
    };
}

export function searchInputStyle(uiScale: number) {
    return {
        background: 'transparent',
        border: 'none',
        color: t.text.normal,
        flex: 1,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        outline: 'none',
    };
}

export function sectionHeaderStyle(uiScale: number) {
    return {
        color: t.text.primary,
        fontWeight: 700,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${2 * uiScale}px 0`,
    };
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

export function sectionTitleRowStyle(uiScale: number) {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

export function unusedRowStyle(uiScale: number, selected: boolean) {
    return {
        alignItems: 'center',
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        display: 'flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        justifyContent: 'space-between',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}
