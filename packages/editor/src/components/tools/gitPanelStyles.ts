import { editorTheme as t } from '../../theme/editorTheme';

export function actionButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        minWidth: 0,
        padding: `${5 * uiScale}px ${6 * uiScale}px`,
    };
}

export function branchRowStyle(uiScale: number, current: boolean) {
    return {
        alignItems: 'center',
        background: current ? t.bg.selected : t.bg.panel,
        border: `1px solid ${current ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        display: 'grid',
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        gridTemplateColumns: `${10 * uiScale}px minmax(0, 1fr)`,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
    };
}

export function buttonGridStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${5 * uiScale}px`,
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    };
}

export function changeGroupHeaderStyle(uiScale: number) {
    return {
        alignItems: 'center',
        color: t.text.primary,
        display: 'flex',
        fontSize: `${11 * uiScale}px`,
        fontWeight: 700,
        justifyContent: 'space-between',
        minHeight: `${20 * uiScale}px`,
    };
}

export function changeGroupStyle(uiScale: number) {
    return {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${4 * uiScale}px`,
    };
}

export function changeRowStyle(uiScale: number) {
    return {
        alignItems: 'stretch',
        display: 'grid',
        gap: `${4 * uiScale}px`,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        minHeight: `${28 * uiScale}px`,
    };
}

export function emptyStateStyle(uiScale: number) {
    return {
        color: t.text.faint,
        fontSize: `${11 * uiScale}px`,
    };
}

export function fileRowStyle(uiScale: number, selected: boolean, disabled: boolean) {
    return {
        alignItems: 'center',
        appearance: 'none' as const,
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: disabled ? 'progress' : 'pointer',
        display: 'grid',
        fontSize: `${11 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: `${24 * uiScale}px minmax(0, 1fr)`,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        textAlign: 'left' as const,
        width: '100%',
    };
}

export function headerRowStyle(uiScale: number) {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${6 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

export function iconButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        justifyContent: 'center',
        minHeight: `${26 * uiScale}px`,
        minWidth: `${26 * uiScale}px`,
    };
}

export function messageStyle(uiScale: number) {
    return {
        borderTop: `1px solid ${t.border.subtle}`,
        color: t.text.faint,
        fontSize: `${11 * uiScale}px`,
        paddingTop: `${6 * uiScale}px`,
    };
}

export function panelStyle(uiScale: number) {
    return {
        background: t.bg.app,
        color: t.text.normal,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${8 * uiScale}px`,
        height: '100%',
        overflow: 'auto',
        padding: `${10 * uiScale}px`,
    };
}

export function primaryActionButtonStyle(uiScale: number, disabled: boolean) {
    return {
        ...actionButtonStyle(uiScale, disabled),
        background: disabled ? t.bg.panel : t.bg.selected,
        border: `1px solid ${disabled ? t.border.subtle : t.accent.primary}`,
        justifyContent: 'center',
        minHeight: `${28 * uiScale}px`,
        width: '100%',
    };
}

export function remoteRowStyle(uiScale: number, status: string) {
    return {
        background: status === 'ready' ? t.bg.selected : t.bg.panel,
        border: `1px solid ${status === 'blocked' ? t.accent.red : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        display: 'flex',
        flexDirection: 'column' as const,
        fontSize: `${11 * uiScale}px`,
        gap: `${2 * uiScale}px`,
        padding: `${5 * uiScale}px ${6 * uiScale}px`,
    };
}

export function rowActionButtonStyle(uiScale: number, disabled: boolean) {
    return {
        ...actionButtonStyle(uiScale, disabled),
        justifyContent: 'center',
        minWidth: `${78 * uiScale}px`,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
    };
}

export function secondaryActionButtonStyle(uiScale: number, disabled: boolean) {
    return {
        ...actionButtonStyle(uiScale, disabled),
        justifyContent: 'center',
        minHeight: `${27 * uiScale}px`,
        width: '100%',
    };
}

export function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${5 * uiScale}px`,
        padding: `${7 * uiScale}px`,
    };
}

export function sectionTitleStyle(uiScale: number) {
    return {
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        fontWeight: 700,
    };
}

export function sectionTitleWithIconStyle(uiScale: number) {
    return {
        alignItems: 'center',
        color: t.text.primary,
        display: 'flex',
        fontSize: `${12 * uiScale}px`,
        fontWeight: 700,
        gap: `${5 * uiScale}px`,
    };
}

export function textAreaStyle(uiScale: number, disabled: boolean) {
    return {
        background: disabled ? t.bg.panel : t.bg.input,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        fontFamily: 'inherit',
        fontSize: `${11 * uiScale}px`,
        minHeight: `${78 * uiScale}px`,
        outline: 'none',
        padding: `${6 * uiScale}px`,
        resize: 'vertical' as const,
        width: '100%',
    };
}

export function textInputStyle(uiScale: number, disabled: boolean) {
    return {
        background: disabled ? t.bg.panel : t.bg.input,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        fontSize: `${11 * uiScale}px`,
        minHeight: `${28 * uiScale}px`,
        outline: 'none',
        padding: `${5 * uiScale}px ${6 * uiScale}px`,
        width: '100%',
    };
}
