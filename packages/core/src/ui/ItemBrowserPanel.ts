import { Container, type FederatedPointerEvent, Graphics, Text } from 'pixi.js';

import type { IEvidenceManager } from '../interfaces/managers';
import type { EvidenceItem } from '../managers/EvidenceManager';
import type { MenuPanel as Panel, PanelBuildDeps } from '../types';
import type { Logger } from '../utils/Logger';

import { createItemCardList } from './ItemCard';
import { ItemDetailView } from './ItemDetailView';
import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export class ItemBrowserPanel implements Panel {
    public id = 'evidence';
    public label = 'Evidence';
    private readonly itemsManager: Pick<IEvidenceManager, 'getAll' | 'getEvidence' | 'getProfiles'>;
    private readonly loadAsset: <T = unknown>(url: string) => Promise<T>;
    private readonly logger: Logger;

    constructor(
        itemsManager: Pick<IEvidenceManager, 'getAll' | 'getEvidence' | 'getProfiles'>,
        loadAsset: <T = unknown>(url: string) => Promise<T>,
        logger: Logger,
    ) {
        this.itemsManager = itemsManager;
        this.loadAsset = loadAsset;
        this.logger = logger;
    }

    build(deps: PanelBuildDeps) {
        const { display, focus, onClose, overlayConfig, theme } = deps;
        const cfg = overlayConfig;
        const w = display.width;
        const h = display.height;

        const root = new Container();
        root.eventMode = 'static';
        const bg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ alpha: 0.95, color: cfg.backgroundColor });
        bg.eventMode = 'static';
        bg.on('pointerdown', (event: FederatedPointerEvent) => event.stopPropagation());
        root.addChild(bg);
        root.addChild(createPanelTitle(cfg, w, 'COURT RECORD'));

        const items = this.itemsManager.getAll();
        const backMargin = 20;

        if (items.length === 0) {
            const empty = new Text({
                style: { fill: 0x88_88_88, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 2 },
                text: 'No evidence or profiles collected yet.'
            });
            empty.anchor.set(0.5);
            empty.position.set(w / 2, h / 2);
            root.addChild(empty);

            const backButton = createButton(theme, cfg, { label: 'Back', x: w / 2, y: h - cfg.buttonHeight - backMargin }, onClose);
            root.addChild(backButton);

            registerFocusableButton(theme, cfg, focus, backButton, onClose);

            return { container: root };
        }

        const padding = 15;
        const listWidth = Math.min(320, w * 0.35);
        const detailX = listWidth + 20;
        const detailWidth = w - detailX - 20;

        const evidence = this.itemsManager.getEvidence();
        const profiles = this.itemsManager.getProfiles();
        const activeTab: 'evidence' | 'profiles' = evidence.length > 0 ? 'evidence' : 'profiles';

        const detailContainer = new Container();
        detailContainer.position.set(detailX, 60);
        root.addChild(detailContainer);

        const detailView = new ItemDetailView(cfg, theme, detailWidth, h, this.loadAsset, this.logger);
        detailContainer.addChild(detailView.container);

        const updateDetail = async (itemList: EvidenceItem[], index: number) => {
            if (index < 0 || index >= itemList.length) return;
            await detailView.update(itemList[index]);
        };

        const currentList = activeTab === 'evidence' ? evidence : profiles;

        const listContainer = new Container();
        listContainer.position.set(padding, 100);
        root.addChild(listContainer);

        const listMask = new Graphics().rect(padding, 100, listWidth, h - 170).fill(0xFF_FF_FF);
        root.addChild(listMask);
        listContainer.mask = listMask;

        const listContent = createItemCardList({
            emptyText: activeTab === 'evidence' ? 'No evidence yet.' : 'No profiles yet.',
            focus,
            items: currentList,
            listWidth,
            onSelect: (index) => {
                void updateDetail(currentList, index);
            },
            overlayConfig: cfg,
            theme,
        });
        listContainer.addChild(listContent);

        if (currentList.length > 0) {
            void updateDetail(currentList, 0);
        }

        // Tabs
        const tabY = 55;
        const tabWidth = (listWidth - 10) / 2;
        const tabHeight = 35;

        const createTab = (tabLabel: string, tab: 'evidence' | 'profiles', x: number) => {
            const tabButton = new Container();
            tabButton.eventMode = 'static';
            tabButton.cursor = 'pointer';
            tabButton.position.set(x, tabY);

            const tabBg = new Graphics();
            tabBg.roundRect(0, 0, tabWidth, tabHeight, 6);
            tabBg.fill({ alpha: activeTab === tab ? 1 : 0.6, color: activeTab === tab ? cfg.buttonHoverColor : cfg.buttonColor });
            tabBg.stroke({ color: activeTab === tab ? theme.accentColor : theme.borderColor, width: 1 });

            const tabText = new Text({
                style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 6, fontWeight: activeTab === tab ? 'bold' : 'normal' },
                text: tabLabel
            });
            tabText.anchor.set(0.5);
            tabText.position.set(tabWidth / 2, tabHeight / 2);
            tabButton.addChild(tabBg, tabText);

            tabButton.on('pointerdown', (event: FederatedPointerEvent) => {
                event.stopPropagation();
                // Tab switching currently rebuilds the panel; close/reopen from menu for now.
                onClose();
            });
            return tabButton;
        };

        root.addChild(createTab('Evidence', 'evidence', padding));
        root.addChild(createTab('Profiles', 'profiles', padding + tabWidth + 5));

        const divider = new Graphics().rect(listWidth + 5, 55, 2, h - 125).fill({ alpha: 0.4, color: theme.borderColor });
        root.addChild(divider);

        // Scroll
        const itemHeight = 45;
        const itemSpacing = 4;
        const totalListHeight = currentList.length * (itemHeight + itemSpacing);
        const visibleHeight = h - 170;
        const maxScroll = Math.max(0, totalListHeight - visibleHeight);
        let scrollY = 0;

        const onWheel = (event: { deltaY: number; }) => {
            if (listContainer.destroyed) return;
            scrollY += event.deltaY;
            scrollY = Math.max(0, Math.min(maxScroll, scrollY));
            listContainer.children[0].y = -scrollY;
        };
        root.on('wheel', onWheel);

        // Back button
        const backButton = createButton(theme, cfg, { label: 'Back', x: w / 2, y: h - cfg.buttonHeight - backMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

        return { container: root };
    }
}