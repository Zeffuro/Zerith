import { Container, type FederatedPointerEvent, Graphics, Sprite, Text } from 'pixi.js';

import type { INotificationManager, ISaveManager } from '../interfaces/managers';
import type { MenuPanel, PanelBuildDeps } from '../types';

import { isSaveThumbnailDataUrl, type SaveMeta, type SaveState } from '../managers/SaveManager';
import { createButton, createPanelTitle, registerFocusableButton } from './UIComponents';

export interface SaveLoadPanelConfig {
    maxSlots?: number;
}

interface SaveSlotText {
    primary: string;
    secondary: string;
    tertiary: string;
}

interface SaveSlotTextLimits {
    primaryMaxLength: number;
    secondaryMaxLength: number;
}

export class SaveLoadPanel implements MenuPanel {
    public id: string;
    public label: string;
    private readonly applySaveState: (saveState: SaveState) => Promise<void>;
    private readonly closeOverlay: () => void;
    private config: Required<SaveLoadPanelConfig>;
    private readonly mode: 'load' | 'save';
    private readonly notifications: INotificationManager;
    private readonly saves: ISaveManager;

    constructor(
        mode: 'load' | 'save',
        saves: ISaveManager,
        notifications: INotificationManager,
        applySaveState: (saveState: SaveState) => Promise<void>,
        closeOverlay: () => void,
        config: SaveLoadPanelConfig = {},
    ) {
        this.mode = mode;
        this.saves = saves;
        this.notifications = notifications;
        this.applySaveState = applySaveState;
        this.closeOverlay = closeOverlay;
        this.id = mode === 'save' ? 'save' : 'load';
        this.label = mode === 'save' ? 'Save Game' : 'Load Game';
        this.config = { maxSlots: 6, ...config };
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
        root.addChild(createPanelTitle(cfg, w, this.mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'));

        const slots = this.saves.listSlots(this.config.maxSlots);
        const slotHeight = 78;
        const slotSpacing = 8;
        const slotWidth = Math.min(600, w * 0.8);
        const totalHeight = slots.length * (slotHeight + slotSpacing);
        const backButtonHeight = 50;
        const backButtonMargin = 20;
        const availableHeight = h - 70 - backButtonHeight - backButtonMargin * 2;
        let y = Math.max(70, 70 + (availableHeight - totalHeight) / 2);

        const slotBgs: Graphics[] = [];

        const styleSlot = (bg: Graphics, selected: boolean) => {
            bg.clear();
            bg.roundRect(0, 0, slotWidth, slotHeight, 8);
            bg.fill({ alpha: selected ? 1 : cfg.buttonAlpha, color: selected ? cfg.buttonHoverColor : cfg.buttonColor });
            bg.stroke({ color: selected ? theme.accentColor : theme.borderColor, width: selected ? 2 : 1 });
        };

        for (const [index, meta] of slots.entries()) {
            const slotNumber = index + 1;
            const slotContainer = new Container();
            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';

            const slotBg = new Graphics();
            styleSlot(slotBg, false);
            slotBgs.push(slotBg);
            slotContainer.addChild(slotBg);

            const primaryFontSize = cfg.fontSize - 6;
            const secondaryFontSize = Math.max(12, cfg.fontSize - 10);
            const tertiaryFontSize = Math.max(10, cfg.fontSize - 12);
            const hasOccupiedSlot = Boolean(meta);
            const thumbnailWidth = 92;
            const thumbnailHeight = 52;
            const textX = hasOccupiedSlot ? 122 : 15;
            const textWidth = slotWidth - textX - 18;
            const { primary, secondary, tertiary } = formatSaveSlotText(slotNumber, meta, {
                primaryMaxLength: estimateTextCapacity(textWidth, primaryFontSize),
                secondaryMaxLength: estimateTextCapacity(textWidth, secondaryFontSize),
            });

            if (meta) {
                const thumbnailX = 15;
                const thumbnailY = 13;
                const thumbnailFrame = new Graphics()
                    .roundRect(thumbnailX, thumbnailY, thumbnailWidth, thumbnailHeight, 5)
                    .fill({ alpha: 0.75, color: 0x0B_0B_14 })
                    .stroke({ alpha: 0.8, color: theme.borderColor, width: 1 });
                slotContainer.addChild(thumbnailFrame);

                if (isSaveThumbnailDataUrl(meta.thumbnailDataUrl)) {
                    const thumbnail = Sprite.from(meta.thumbnailDataUrl);
                    thumbnail.position.set(thumbnailX, thumbnailY);
                    thumbnail.width = thumbnailWidth;
                    thumbnail.height = thumbnailHeight;
                    slotContainer.addChild(thumbnail);

                    const thumbnailBorder = new Graphics()
                        .roundRect(thumbnailX, thumbnailY, thumbnailWidth, thumbnailHeight, 5)
                        .stroke({ alpha: 0.85, color: theme.borderColor, width: 1 });
                    slotContainer.addChild(thumbnailBorder);
                }
            }

            const primaryText = new Text({
                style: {
                    fill: meta ? cfg.textColor : 0x66_66_66,
                    fontFamily: cfg.fontFamily,
                    fontSize: primaryFontSize,
                    fontWeight: meta ? 'bold' : 'normal',
                },
                text: primary
            });
            primaryText.anchor.set(0, 0);
            primaryText.position.set(textX, 8);

            const secondaryText = new Text({
                style: {
                    fill: meta ? 0xAA_AA_AA : 0x66_66_66,
                    fontFamily: cfg.fontFamily,
                    fontSize: secondaryFontSize,
                },
                text: secondary
            });
            secondaryText.anchor.set(0, 0);
            secondaryText.position.set(textX, 33);

            const tertiaryText = new Text({
                style: {
                    fill: meta ? 0x88_88_88 : 0x66_66_66,
                    fontFamily: cfg.fontFamily,
                    fontSize: tertiaryFontSize,
                },
                text: tertiary
            });
            tertiaryText.anchor.set(0, 0);
            tertiaryText.position.set(textX, 56);

            slotContainer.addChild(primaryText, secondaryText, tertiaryText);
            slotContainer.position.set((w - slotWidth) / 2, y);

            const activateSlot = () => {
                if (this.mode === 'save') {
                    void this.saves.save(slotNumber);
                    this.notifications.show(`Saved to Slot ${slotNumber}`);
                    this.closeOverlay();
                } else {
                    if (!meta) { this.notifications.show('Slot is empty'); return; }
                    void this.saves.load(slotNumber).then(async (saveState) => {
                        if (!saveState) {
                            this.notifications.show('Failed to load save');
                            return;
                        }
                        await this.applySaveState(saveState);
                        this.notifications.show(`Loaded Slot ${slotNumber}`);
                        this.closeOverlay();
                    });
                }
            };

            slotContainer.on('pointerover', () => styleSlot(slotBg, true));
            slotContainer.on('pointerout', () => styleSlot(slotBg, false));
            slotContainer.on('pointerdown', (event: FederatedPointerEvent) => {
                event.stopPropagation();
                activateSlot();
            });

            focus.register({
                activate: activateSlot,
                blur: () => styleSlot(slotBg, false),
                focus: () => styleSlot(slotBg, true),
            });

            root.addChild(slotContainer);
            y += slotHeight + slotSpacing;
        }

        const backButton = createButton(theme, cfg, { label: 'Back', x: w / 2, y: h - backButtonHeight - backButtonMargin }, onClose);
        root.addChild(backButton);

        registerFocusableButton(theme, cfg, focus, backButton, onClose);

        return { container: root };
    }
}

export function formatSaveSlotText(
    slotNumber: number,
    meta: SaveMeta | undefined,
    limits: SaveSlotTextLimits,
): SaveSlotText {
    if (!meta) {
        return {
            primary: truncateSlotText(`Slot ${slotNumber} - Empty`, limits.primaryMaxLength),
            secondary: 'No save data',
            tertiary: '',
        };
    }

    const title = meta.label?.trim() || meta.chapter?.trim() || meta.sceneName || 'Unknown';
    const preview = formatSavePreview(meta);
    const date = Number.isFinite(meta.savedAt)
        ? new Date(meta.savedAt).toLocaleString()
        : 'Unknown date';
    const secondary = preview ?? 'No dialogue preview';
    const tertiary = `${date} - ${formatSaveContextLine(meta)}`;

    return {
        primary: truncateSlotText(`Slot ${slotNumber} - ${title}`, limits.primaryMaxLength),
        secondary: truncateSlotText(secondary, limits.secondaryMaxLength),
        tertiary: truncateSlotText(tertiary, limits.secondaryMaxLength),
    };
}

function estimateTextCapacity(width: number, fontSize: number): number {
    return Math.max(16, Math.floor(width / Math.max(6, fontSize * 0.62)));
}

function formatSaveContextLine(meta: SaveMeta): string {
    const parts: string[] = [];
    if (meta.kind === 'bookmark') {
        parts.push(meta.bookmarkId ? `Bookmark ${meta.bookmarkId}` : 'Bookmark');
    } else if (meta.kind === 'chapter') {
        parts.push(meta.chapter ? `Chapter ${meta.chapter}` : 'Chapter');
    }
    parts.push(formatSaveVersionLine(meta));
    return parts.join(' - ');
}

function formatSavePreview(meta: SaveMeta): string | undefined {
    const previewText = meta.previewText?.trim();
    if (!previewText) return undefined;

    const previewSpeaker = meta.previewSpeaker?.trim();
    return previewSpeaker ? `${previewSpeaker}: ${previewText}` : previewText;
}

function formatSaveVersionLine(meta: SaveMeta): string {
    const saveVersion = meta.saveSchemaVersion === undefined ? 'legacy' : `v${meta.saveSchemaVersion}`;
    const contentVersion = meta.contentSchemaVersion === undefined ? 'legacy' : `v${meta.contentSchemaVersion}`;
    return `Save ${saveVersion} / Content ${contentVersion}`;
}

function truncateSlotText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
