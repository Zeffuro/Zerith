import { Container, type FederatedPointerEvent, Graphics, Sprite, Text } from 'pixi.js';

import type { IDisplayManager, IEvidenceManager } from '../interfaces/managers';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { MenuPanel as Panel } from '../types';
import type { Theme } from '../utils/Theme';

import type { PanelFocusManager } from './PanelFocusManager';

import { createButton, createPanelTitle, createSelectableList, registerFocusableButton } from './UIComponents';

export class ItemBrowserPanel implements Panel {
    public id = 'evidence';
    public label = 'Evidence';
    private readonly itemsManager: Pick<IEvidenceManager, 'getAll' | 'getEvidence' | 'getProfiles'>;
    private readonly loadAsset: <T = unknown>(url: string) => Promise<T>;

    constructor(
        itemsManager: Pick<IEvidenceManager, 'getAll' | 'getEvidence' | 'getProfiles'>,
        loadAsset: <T = unknown>(url: string) => Promise<T>,
    ) {
        this.itemsManager = itemsManager;
        this.loadAsset = loadAsset;
    }

    build(
        display: Pick<IDisplayManager, 'height' | 'width'> & { canvasElement: HTMLCanvasElement; },
        theme: Theme,
        overlayConfig: Required<OverlayConfig>,
        focus: PanelFocusManager,
        onClose: () => void,
    ) {
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

        // Detail panel
        const detailContainer = new Container();
        detailContainer.position.set(detailX, 60);
        root.addChild(detailContainer);

        const detailSprite = new Sprite();
        detailSprite.anchor.set(0.5, 0);
        detailSprite.position.set(detailWidth / 2, 10);
        detailSprite.visible = false;
        detailContainer.addChild(detailSprite);

        const detailName = new Text({
            style: { fill: theme.accentColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize, fontWeight: 'bold' },
            text: ''
        });
        detailContainer.addChild(detailName);

        const detailDesc = new Text({
            style: { fill: cfg.textColor, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4, wordWrap: true, wordWrapWidth: detailWidth - 20 },
            text: ''
        });
        detailContainer.addChild(detailDesc);

        const detailType = new Text({
            style: { fill: 0x88_88_88, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 6 },
            text: ''
        });
        detailContainer.addChild(detailType);

        const updateDetail = async (itemList: typeof items, index: number) => {
            if (index < 0 || index >= itemList.length) return;
            const item = itemList[index];

            detailName.text = item.name;
            detailDesc.text = item.description;
            detailType.text = item.type === 'evidence' ? '[ Evidence ]' : '[ Profile ]';

            if (item.imageUrl) {
                try {
                    const texture = await this.loadAsset<import('pixi.js').Texture>(item.imageUrl);
                    detailSprite.texture = texture;
                    detailSprite.visible = true;
                    const maxImgW = detailWidth * 0.6;
                    const maxImgH = (h - 170) * 0.4;
                    const scale = Math.min(maxImgW / texture.width, maxImgH / texture.height, 1);
                    detailSprite.scale.set(scale);
                    const imgBottom = 10 + texture.height * scale + 15;
                    detailType.position.set(0, imgBottom);
                    detailName.position.set(0, imgBottom + 22);
                    detailDesc.position.set(0, imgBottom + 50);
                } catch {
                    detailSprite.visible = false;
                    detailType.position.set(0, 10);
                    detailName.position.set(0, 32);
                    detailDesc.position.set(0, 60);
                }
            } else {
                detailSprite.visible = false;
                detailType.position.set(0, 10);
                detailName.position.set(0, 32);
                detailDesc.position.set(0, 60);
            }
        };

        const currentList = activeTab === 'evidence' ? evidence : profiles;

        const listContainer = new Container();
        listContainer.position.set(padding, 100);
        root.addChild(listContainer);

        const listMask = new Graphics().rect(padding, 100, listWidth, h - 170).fill(0xFF_FF_FF);
        root.addChild(listMask);
        listContainer.mask = listMask;

        if (currentList.length > 0) {
            const { container: listContent, select: selectList } = createSelectableList(theme, cfg, {
                initialSelected: 0,
                items: currentList.map((item) => ({
                    label: item.name,
                    onSelect: (index) => void updateDetail(currentList, index),
                })),
                width: listWidth - 10,
            });
            listContainer.addChild(listContent);
            void updateDetail(currentList, 0);

            for (const [index] of currentList.entries()) {
                focus.register({
                    activate: () => { void updateDetail(currentList, index); },
                    blur: () => {},
                    focus: () => {
                        selectList(index);
                        void updateDetail(currentList, index);
                    },
                });
            }
        } else {
            const emptyTab = new Text({
                style: { fill: 0x88_88_88, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize - 4 },
                text: activeTab === 'evidence' ? 'No evidence yet.' : 'No profiles yet.'
            });
            emptyTab.position.set(0, 10);
            listContainer.addChild(emptyTab);
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

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (listContainer.destroyed) return;
            scrollY += event.deltaY;
            scrollY = Math.max(0, Math.min(maxScroll, scrollY));
            listContainer.children[0].y = -scrollY;
        };
        display.canvasElement.addEventListener('wheel', onWheel, { passive: false });

        // Back button
        const backButton = createButton(theme, cfg, { label: 'Back', x: w / 2, y: h - cfg.buttonHeight - backMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

        return {
            cleanup: () => display.canvasElement.removeEventListener('wheel', onWheel),
            container: root,
        };
    }
}