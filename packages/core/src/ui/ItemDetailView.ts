import { Container, Sprite, Text, type Texture } from 'pixi.js';

import type { EvidenceItem } from '../managers/EvidenceManager';
import type { OverlayConfig } from '../managers/OverlayManager';
import type { Theme } from '../utils/Theme';

export class ItemDetailView {
    public readonly container: Container;
    private readonly detailContainer: Container;
    private readonly detailDescription: Text;
    private readonly detailName: Text;
    private readonly detailSprite: Sprite;
    private readonly detailType: Text;
    private readonly detailWidth: number;
    private readonly height: number;
    private readonly loadAsset: <T = unknown>(url: string) => Promise<T>;

    constructor(
        overlayConfig: Required<OverlayConfig>,
        theme: Theme,
        detailWidth: number,
        height: number,
        loadAsset: <T = unknown>(url: string) => Promise<T>,
    ) {
                        this.detailContainer = new Container();

        this.detailWidth = detailWidth;
        this.height = height;
        this.loadAsset = loadAsset;

        this.detailSprite = new Sprite();
        this.detailSprite.anchor.set(0.5, 0);
        this.detailSprite.position.set(detailWidth / 2, 10);
        this.detailSprite.visible = false;
        this.detailContainer.addChild(this.detailSprite);

        this.detailName = new Text({
            style: { fill: theme.accentColor, fontFamily: overlayConfig.fontFamily, fontSize: overlayConfig.fontSize, fontWeight: 'bold' },
            text: ''
        });
        this.detailContainer.addChild(this.detailName);

        this.detailDescription = new Text({
            style: {
                fill: overlayConfig.textColor,
                fontFamily: overlayConfig.fontFamily,
                fontSize: overlayConfig.fontSize - 4,
                wordWrap: true,
                wordWrapWidth: detailWidth - 20,
            },
            text: ''
        });
        this.detailContainer.addChild(this.detailDescription);

        this.detailType = new Text({
            style: { fill: 0x88_88_88, fontFamily: overlayConfig.fontFamily, fontSize: overlayConfig.fontSize - 6 },
            text: ''
        });
        this.detailContainer.addChild(this.detailType);

        this.container = this.detailContainer;
    }

    public async update(item: EvidenceItem): Promise<void> {
        this.detailName.text = item.name;
        this.detailDescription.text = item.description;
        this.detailType.text = item.type === 'evidence' ? '[ Evidence ]' : '[ Profile ]';

        if (item.imageUrl) {
            try {
                const texture = await this.loadAsset<Texture>(item.imageUrl);
                this.detailSprite.texture = texture;
                this.detailSprite.visible = true;
                const maxImageWidth = this.detailWidth * 0.6;
                const maxImageHeight = (this.height - 170) * 0.4;
                const scale = Math.min(maxImageWidth / texture.width, maxImageHeight / texture.height, 1);
                this.detailSprite.scale.set(scale);
                const imageBottom = 10 + texture.height * scale + 15;
                this.detailType.position.set(0, imageBottom);
                this.detailName.position.set(0, imageBottom + 22);
                this.detailDescription.position.set(0, imageBottom + 50);
                return;
            } catch {
                // fall through to text-only layout
            }
        }

        this.detailSprite.visible = false;
        this.detailType.position.set(0, 10);
        this.detailName.position.set(0, 32);
        this.detailDescription.position.set(0, 60);
    }
}

