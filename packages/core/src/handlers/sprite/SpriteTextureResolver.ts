import type { Texture } from 'pixi.js';

import type { IAssetManager, ISpritesheetManager } from '../../interfaces/managers';
import type { CharacterDefinition } from '../../types/Character';
import type { GameManifest } from '../../types/GameManifest';
import type { Logger } from '../../utils/Logger';
import type { SpriteCommand } from './types';

interface ResolvedAnimation {
    loop: boolean;
    speed: number;
    textures: Texture[];
}

export class SpriteTextureResolver {
    private readonly assets: IAssetManager;
    private readonly getManifest: () => GameManifest;
    private readonly logger: Logger;
    private readonly spritesheets: ISpritesheetManager;

    constructor(
        assets: IAssetManager,
        spritesheets: ISpritesheetManager,
        logger: Logger,
        getManifest: () => GameManifest,
    ) {
        this.assets = assets;
        this.spritesheets = spritesheets;
        this.logger = logger;
        this.getManifest = getManifest;
    }

    public findCharacter(spriteId: string): CharacterDefinition | undefined {
        const characters = this.getManifest()?.characters;
        if (!characters || typeof characters === 'string') {
            return undefined;
        }

        return characters[spriteId]
            || Object.entries(characters).find(([key]) => key.toLowerCase() === spriteId.toLowerCase())?.[1]
            || undefined;
    }

    public async resolveAnimation(characterId: string, animationName: string): Promise<ResolvedAnimation | undefined> {
        const character = this.findCharacter(characterId);
        if (!character?.animations?.[animationName]) {
            this.logger.warn(`Animation '${animationName}' not found for character '${characterId}'`);
            return undefined;
        }

        const animation = character.animations[animationName];
        const sheetConfig = character.spritesheet;

        if (sheetConfig?.atlasUrl && !this.spritesheets.has(sheetConfig.atlasUrl)) {
            await this.spritesheets.load(sheetConfig);
        }

        const textures: Texture[] = [];
        for (const frameName of animation.frames) {
            const texture = sheetConfig?.atlasUrl
                ? this.spritesheets.getFrame(sheetConfig.atlasUrl, frameName)
                : await this.assets.load<Texture>(frameName);

            if (!texture) {
                this.logger.warn(`Animation frame '${frameName}' not found`);
                return undefined;
            }

            textures.push(texture);
        }

        return {
            loop: animation.loop ?? false,
            speed: animation.speed ?? 100,
            textures,
        };
    }

    public async resolveTexture(command: SpriteCommand): Promise<Texture | undefined> {
        if (command.pose) {
            const character = this.findCharacter(command.id);
            if (!character) {
                this.logger.warn(`No character config found for sprite id '${command.id}'`);
                return undefined;
            }

            const frameName = character.poses?.[command.pose];
            if (!frameName) {
                this.logger.warn(`Pose '${command.pose}' not found for character '${command.id}'`);
                return undefined;
            }

            if (character.spritesheet?.atlasUrl) {
                return await this.getSheetFrame(character.spritesheet, frameName);
            }
            return await this.assets.load<Texture>(frameName);
        }

        if (!command.assetUrl) {
            return undefined;
        }

        if (command.assetUrl.includes(':') && !command.assetUrl.startsWith('http') && !command.assetUrl.startsWith('/')) {
            const [atlasKey, frameName] = command.assetUrl.split(':');
            const frame = this.spritesheets.getFrame(atlasKey, frameName);
            if (frame) {
                return frame;
            }

            this.logger.warn(`Frame '${frameName}' not found in atlas '${atlasKey}'`);
            return undefined;
        }

        return await this.assets.load<Texture>(command.assetUrl);
    }

    private async getSheetFrame(
        sheetConfig: { atlasUrl: string; chromaKey?: string; chromaTolerance?: number },
        frameName: string,
    ): Promise<Texture | undefined> {
        if (!this.spritesheets.has(sheetConfig.atlasUrl)) {
            await this.spritesheets.load(sheetConfig);
        }

        return this.spritesheets.getFrame(sheetConfig.atlasUrl, frameName) ?? undefined;
    }
}

