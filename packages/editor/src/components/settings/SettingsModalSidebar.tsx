import { editorTheme as t } from '../../theme/editorTheme';
import { type SettingsCategoryNode } from './settingsCatalog';
import { SettingsTreeNode } from './SettingsTreeNode';

export type SettingsModalSidebarProperties = {
    filteredNodes: SettingsCategoryNode[];
    leafCountById: Record<string, number>;
    onBadgeClick: (nodeId: string) => void;
    onSearchQueryChange: (nextValue: string) => void;
    onSelectPanel: (panelId: string) => void;
    onTreeBadgeModeChange: (mode: 'changed' | 'hits') => void;
    searchQuery: string;
    selectedPanelId: string;
    showSearchHitBadges: boolean;
    treeBadgeMode: 'changed' | 'hits';
    uiScale: number;
};

export function SettingsModalSidebar({
    filteredNodes,
    leafCountById,
    onBadgeClick,
    onSearchQueryChange,
    onSelectPanel,
    onTreeBadgeModeChange,
    searchQuery,
    selectedPanelId,
    showSearchHitBadges,
    treeBadgeMode,
    uiScale,
}: SettingsModalSidebarProperties) {
    return (
        <aside style={{ borderRight: `1px solid ${t.border.subtle}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: `1px solid ${t.border.subtle}`, padding: `${12 * uiScale}px` }}>
                <div style={{ fontSize: `${14 * uiScale}px`, fontWeight: 700, marginBottom: `${8 * uiScale}px` }}>Settings</div>
                <input
                    onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
                    placeholder="Search settings"
                    style={{
                        background: t.bg.input,
                        border: `1px solid ${t.border.normal}`,
                        borderRadius: t.radius.md,
                        color: t.text.primary,
                        fontSize: `${12 * uiScale}px`,
                        outline: 'none',
                        padding: `${8 * uiScale}px`,
                        width: '100%',
                    }}
                    value={searchQuery}
                />
                <div style={{ alignItems: 'center', display: 'inline-flex', gap: `${6 * uiScale}px`, marginTop: `${8 * uiScale}px` }}>
                    <button
                        onClick={() => onTreeBadgeModeChange('hits')}
                        style={{
                            background: treeBadgeMode === 'hits' ? t.bg.selected : t.bg.popup,
                            border: `1px solid ${t.border.normal}`,
                            borderRadius: t.radius.sm,
                            color: t.text.primary,
                            cursor: 'pointer',
                            fontSize: `${11 * uiScale}px`,
                            padding: `${3 * uiScale}px ${7 * uiScale}px`,
                        }}
                    >
                        Hits
                    </button>
                    <button
                        onClick={() => onTreeBadgeModeChange('changed')}
                        style={{
                            background: treeBadgeMode === 'changed' ? t.bg.selected : t.bg.popup,
                            border: `1px solid ${t.border.normal}`,
                            borderRadius: t.radius.sm,
                            color: t.text.primary,
                            cursor: 'pointer',
                            fontSize: `${11 * uiScale}px`,
                            padding: `${3 * uiScale}px ${7 * uiScale}px`,
                        }}
                    >
                        Changed
                    </button>
                </div>
            </div>
            <div className="zerith-scrollbar" style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'contain', padding: `${8 * uiScale}px` }}>
                {filteredNodes.length === 0 ? (
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, padding: `${8 * uiScale}px` }}>
                        No matching settings.
                    </div>
                ) : (
                    filteredNodes.map((node) => (
                        <SettingsTreeNode
                            badgeMode={treeBadgeMode}
                            key={node.id}
                            leafCountById={leafCountById}
                            node={node}
                            onBadgeClick={onBadgeClick}
                            onSelect={onSelectPanel}
                            selectedPanelId={selectedPanelId}
                            showSearchHitBadges={showSearchHitBadges}
                            uiScale={uiScale}
                        />
                    ))
                )}
            </div>
        </aside>
    );
}

