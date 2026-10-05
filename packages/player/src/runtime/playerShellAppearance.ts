import type { PlayerShellConfig } from './playerShellConfig';

export function applyPlayerShellAppearance(root: HTMLElement, config: PlayerShellConfig): void {
    const values = {
        accent: config.accentColor,
        'background-opacity': String(config.backgroundOpacity),
        'button-color': config.buttonColor,
        'button-height': `${config.buttonHeight}px`,
        'button-radius': config.cornerStyle === 'pill' ? '999px' : (config.cornerStyle === 'square' ? '0px' : '9px'),
        font: { monospace: 'ui-monospace, monospace', serif: 'Georgia, serif', system: 'system-ui, sans-serif' }[config.menuFont],
        'font-size': `${config.menuFontSize}px`,
        'menu-width': `${config.menuWidth}px`,
        'panel-color': `${config.panelColor}${Math.round(config.panelOpacity * 255).toString(16).padStart(2, '0')}`,
        'panel-radius': config.cornerStyle === 'square' ? '0px' : '18px',
        'text-color': config.textColor,
    };
    for (const [key, value] of Object.entries(values)) root.style.setProperty(`--zerith-player-${key}`, value);
    root.dataset.titleAlignment = config.titleAlignment;
}
