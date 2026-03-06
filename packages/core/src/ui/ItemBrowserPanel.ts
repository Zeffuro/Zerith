import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Engine } from '../Engine';
import type { MenuPanel } from '../types';
import { createPanelTitle, createButton, createSelectableList, registerFocusableButton } from './UIComponents';

export class ItemBrowserPanel implements MenuPanel {
    public id = 'evidence';
    public label = 'Evidence';

    build(engine: Engine, onClose: () => void) {
        const overlay = engine.overlay;
        const ctx = overlay.getUIContext();
        const cfg = ctx.overlayConfig;
        const w = ctx.canvasWidth;
        const h = ctx.canvasHeight;
        const focus = overlay.focus;

        const root = overlay.createPanelBase();
        root.addChild(createPanelTitle(ctx, 'COURT RECORD'));

        const items = engine.items.getAll();
        const backMargin = 20;

        if (items.length === 0) {
            const empty = new Text({
                text: 'No evidence or profiles collected yet.',
                style: { fill: 0x888888, fontSize: cfg.fontSize - 2, fontFamily: cfg.fontFamily }
            });
            empty.anchor.set(0.5);
            empty.position.set(w / 2, h / 2);
            root.addChild(empty);

            const backBtn = createButton(ctx, { label: 'Back', x: w / 2, y: h - cfg.buttonHeight - backMargin }, onClose);
            root.addChild(backBtn);

            registerFocusableButton(ctx, focus, backBtn, onClose);

            return { container: root };
        }

        const padding = 15;
        const listWidth = Math.min(320, w * 0.35);
        const detailX = listWidth + 20;
        const detailWidth = w - detailX - 20;

        const evidence = engine.items.getEvidence();
        const profiles = engine.items.getProfiles();
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
            text: '',
            style: { fill: ctx.theme.accentColor, fontSize: cfg.fontSize, fontFamily: cfg.fontFamily, fontWeight: 'bold' }
        });
        detailContainer.addChild(detailName);

        const detailDesc = new Text({
            text: '',
            style: { fill: cfg.textColor, fontSize: cfg.fontSize - 4, fontFamily: cfg.fontFamily, wordWrap: true, wordWrapWidth: detailWidth - 20 }
        });
        detailContainer.addChild(detailDesc);

        const detailType = new Text({
            text: '',
            style: { fill: 0x888888, fontSize: cfg.fontSize - 6, fontFamily: cfg.fontFamily }
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
                    const texture = await engine.loadAsset(item.imageUrl);
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

        const listMask = new Graphics().rect(padding, 100, listWidth, h - 170).fill(0xffffff);
        root.addChild(listMask);
        listContainer.mask = listMask;

        if (currentList.length > 0) {
            const { container: listContent } = createSelectableList(ctx, {
                items: currentList.map((item, _) => ({
                    label: item.name,
                    onSelect: (idx) => updateDetail(currentList, idx),
                })),
                width: listWidth - 10,
                initialSelected: 0,
            });
            listContainer.addChild(listContent);
            updateDetail(currentList, 0);

            currentList.forEach((_, idx) => {
                focus.register({
                    focus: () => {
                        (listContent as any).select?.(idx);
                        updateDetail(currentList, idx);
                    },
                    blur: () => {},
                    activate: () => updateDetail(currentList, idx),
                });
            });
        } else {
            const emptyTab = new Text({
                text: activeTab === 'evidence' ? 'No evidence yet.' : 'No profiles yet.',
                style: { fill: 0x888888, fontSize: cfg.fontSize - 4, fontFamily: cfg.fontFamily }
            });
            emptyTab.position.set(0, 10);
            listContainer.addChild(emptyTab);
        }

        // Tabs
        const tabY = 55;
        const tabWidth = (listWidth - 10) / 2;
        const tabHeight = 35;

        const createTab = (tabLabel: string, tab: 'evidence' | 'profiles', x: number) => {
            const tabBtn = new Container();
            tabBtn.eventMode = 'static';
            tabBtn.cursor = 'pointer';
            tabBtn.position.set(x, tabY);

            const tabBg = new Graphics();
            tabBg.roundRect(0, 0, tabWidth, tabHeight, 6);
            tabBg.fill({ color: activeTab === tab ? cfg.buttonHoverColor : cfg.buttonColor, alpha: activeTab === tab ? 1 : 0.6 });
            tabBg.stroke({ color: activeTab === tab ? ctx.theme.accentColor : ctx.theme.borderColor, width: 1 });

            const tabText = new Text({
                text: tabLabel,
                style: { fill: cfg.textColor, fontSize: cfg.fontSize - 6, fontFamily: cfg.fontFamily, fontWeight: activeTab === tab ? 'bold' : 'normal' }
            });
            tabText.anchor.set(0.5);
            tabText.position.set(tabWidth / 2, tabHeight / 2);
            tabBtn.addChild(tabBg, tabText);

            tabBtn.on('pointerdown', (e: any) => {
                e.stopPropagation();
                engine.overlay.showPanel(this);
            });
            return tabBtn;
        };

        root.addChild(createTab('Evidence', 'evidence', padding));
        root.addChild(createTab('Profiles', 'profiles', padding + tabWidth + 5));

        const divider = new Graphics().rect(listWidth + 5, 55, 2, h - 125).fill({ color: ctx.theme.borderColor, alpha: 0.4 });
        root.addChild(divider);

        // Scroll
        const itemHeight = 45;
        const itemSpacing = 4;
        const totalListHeight = currentList.length * (itemHeight + itemSpacing);
        const visibleHeight = h - 170;
        const maxScroll = Math.max(0, totalListHeight - visibleHeight);
        let scrollY = 0;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (listContainer.destroyed) return;
            scrollY += e.deltaY;
            scrollY = Math.max(0, Math.min(maxScroll, scrollY));
            listContainer.children[0].y = -scrollY;
        };
        engine.app.canvas.addEventListener('wheel', onWheel, { passive: false });

        // Back button
        const backBtn = createButton(ctx, { label: 'Back', x: w / 2, y: h - cfg.buttonHeight - backMargin }, onClose);
        root.addChild(backBtn);

        registerFocusableButton(ctx, focus, backBtn, onClose);

        return {
            container: root,
            cleanup: () => engine.app.canvas.removeEventListener('wheel', onWheel),
        };
    }
}