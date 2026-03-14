import { editorTheme as t } from '../../theme/editorTheme';
import { type SettingsCategoryNode } from './settingsCatalog';

type SettingsTreeNodeProperties = {
    badgeMode: 'changed' | 'hits';
    leafCountById: Record<string, number>;
    node: SettingsCategoryNode;
    onBadgeClick: (nodeId: string) => void;
    onSelect: (id: string) => void;
    selectedPanelId: string;
    showSearchHitBadges: boolean;
    uiScale: number;
};

export function SettingsTreeNode({
    badgeMode,
    leafCountById,
    node,
    onBadgeClick,
    onSelect,
    selectedPanelId,
    showSearchHitBadges,
    uiScale,
}: SettingsTreeNodeProperties) {
    const isSelected = selectedPanelId === node.id;
    const leafCount = leafCountById[node.id] ?? 0;
    const showBadge = showSearchHitBadges && leafCount > 0;

    return (
        <div>
            <button
                onClick={() => onSelect(node.id)}
                style={{
                    alignItems: 'center',
                    background: isSelected ? t.bg.selected : 'transparent',
                    border: `1px solid ${isSelected ? t.border.normal : 'transparent'}`,
                    borderRadius: t.radius.md,
                    color: isSelected ? t.text.primary : t.text.normal,
                    cursor: 'pointer',
                    display: 'flex',
                    fontSize: `${12 * uiScale}px`,
                    justifyContent: 'space-between',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    textAlign: 'left',
                    width: '100%',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
                <span
                    onClick={(event) => {
                        if (!showBadge || badgeMode !== 'changed') return;
                        event.preventDefault();
                        event.stopPropagation();
                        onBadgeClick(node.id);
                    }}
                    style={{
                        alignItems: 'center',
                        background: t.bg.input,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.sm,
                        color: t.text.muted,
                        cursor: showBadge && badgeMode === 'changed' ? 'pointer' : 'default',
                        display: 'inline-flex',
                        fontSize: `${11 * uiScale}px`,
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: `${24 * uiScale}px`,
                        opacity: showBadge ? 1 : 0,
                        padding: `${2 * uiScale}px ${5 * uiScale}px`,
                        pointerEvents: showBadge ? 'auto' : 'none',
                        textAlign: 'center',
                        visibility: showBadge ? 'visible' : 'hidden',
                    }}
                    title={showBadge
                        ? (badgeMode === 'changed'
                            ? `${leafCount} changed setting${leafCount === 1 ? '' : 's'}`
                            : `${leafCount} search hit${leafCount === 1 ? '' : 's'}`)
                        : undefined}
                >
                    {leafCount}
                </span>
            </button>
            {node.children?.length ? (
                <div style={{ marginLeft: `${12 * uiScale}px`, marginTop: `${2 * uiScale}px` }}>
                    {node.children.map((child) => (
                        <SettingsTreeNode
                            badgeMode={badgeMode}
                            key={child.id}
                            leafCountById={leafCountById}
                            node={child}
                            onBadgeClick={onBadgeClick}
                            onSelect={onSelect}
                            selectedPanelId={selectedPanelId}
                            showSearchHitBadges={showSearchHitBadges}
                            uiScale={uiScale}
                        />
                    ))}
                </div>
            ) : undefined}
        </div>
    );
}

