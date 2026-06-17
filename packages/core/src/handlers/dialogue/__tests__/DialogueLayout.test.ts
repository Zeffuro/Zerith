import { describe, expect, it } from 'vitest';

import { calculateDialogueLayout } from '../DialogueLayout';

describe('calculateDialogueLayout', () => {
    it('keeps the default dialogue box and text area inside the display', () => {
        const layout = calculateDialogueLayout({
            config: {},
            displayHeight: 720,
            displayWidth: 1280,
        });

        expect(layout.boxX).toBeGreaterThanOrEqual(0);
        expect(layout.boxY).toBeGreaterThanOrEqual(0);
        expect(layout.boxX + layout.boxWidth).toBeLessThanOrEqual(1280);
        expect(layout.boxY + layout.boxHeight).toBeLessThanOrEqual(720);
        expect(layout.messageX + layout.messageWidth).toBeLessThanOrEqual(layout.boxX + layout.boxWidth);
        expect(layout.messageY + layout.messageHeight).toBeLessThanOrEqual(layout.boxY + layout.boxHeight);
    });

    it('clamps oversized configured boxes and shrinks fonts for compact displays', () => {
        const layout = calculateDialogueLayout({
            config: {
                boxHeight: 600,
                boxWidth: 900,
                boxX: 80,
                boxY: 80,
                messageStyle: { fontSize: 40 },
                nameStyle: { fontSize: 48 },
            },
            displayHeight: 120,
            displayWidth: 320,
        });

        expect(layout.boxX + layout.boxWidth).toBeLessThanOrEqual(320);
        expect(layout.boxY + layout.boxHeight).toBeLessThanOrEqual(120);
        expect(layout.messageFontSize).toBeLessThan(40);
        expect(layout.nameFontSize).toBeLessThan(48);
    });
});
