import type { EngineConfigFile } from '@zeffuro/zerith-core';

import { editorTheme as t } from '../../../theme/editorTheme';
import { AssetPickerField } from '../../inspector/fields/AssetPickerField';
import { ColorPickerField } from '../../inspector/fields/ColorPickerField';
import { Field, sharedStyles } from './EditorSharedUI';
import { PlayerAppearanceFields } from './PlayerAppearanceFields';
import {
    PLAYER_ACTION_LABELS,
    type PlayerConfigField,
    readPlayerConfigRecord,
    resetPlayerConfig,
    setPlayerConfigField,
    setPlayerConfigLabel,
} from './playerConfigModel';
import { PlayerMenuActions } from './PlayerMenuActions';

type Properties = {
    config: EngineConfigFile;
    onUpdate: (updater: (current: EngineConfigFile) => EngineConfigFile) => void;
    uiScale: number;
};

export function PlayerConfigFields({ config, onUpdate, uiScale }: Properties) {
    const player = readPlayerConfigRecord(config.player);
    const labels = readPlayerConfigRecord(player.actionLabels);
    const setField = (key: PlayerConfigField, value: boolean | number | string | undefined) => {
        onUpdate(current => setPlayerConfigField(current, key, value));
    };
    return (
        <section aria-label="Player menus" style={{ ...sharedStyles.panel(uiScale), gridColumn: '1 / -1', overflow: 'visible' }}>
            <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: `${13 * uiScale}px`, margin: 0 }}>Player menus</h3>
                <button onClick={() => onUpdate(resetPlayerConfig)} style={sharedStyles.secondaryButton(uiScale)} type="button">Use player defaults</button>
            </div>
            <p style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, margin: '0 0 12px' }}>
                Games include title, pause and settings menus by default. Leave overrides empty to use the game title and default appearance.
            </p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={{ alignItems: 'center', display: 'flex', fontSize: `${12 * uiScale}px`, gap: 8 }}>
                    <input checked={player.enabled !== false} onChange={event => setField('enabled', event.target.checked)} type="checkbox" />
                    Enable player menus
                </label>
                <label style={{ alignItems: 'center', display: 'flex', fontSize: `${12 * uiScale}px`, gap: 8 }}>
                    <input checked={player.rememberSettings !== false} onChange={event => setField('rememberSettings', event.target.checked)} type="checkbox" />
                    Remember player settings for this game
                </label>
                <Field label="Menu title">
                    <input maxLength={120} onChange={event => setField('title', event.target.value)} placeholder="Game title" style={sharedStyles.input(uiScale)} value={text(player.title)} />
                </Field>
                <Field label="Menu subtitle">
                    <input maxLength={240} onChange={event => setField('subtitle', event.target.value)} placeholder="Optional subtitle" style={sharedStyles.input(uiScale)} value={text(player.subtitle)} />
                </Field>
                <Field label="Menu background">
                    <AssetPickerField inputStyle={sharedStyles.input(uiScale)} kind="bg" listId="engine-config-player-backgrounds" onChange={value => setField('background', value.replace(/^\/+/u, ''))} placeholder="assets/bg/title.webp" value={text(player.background)} />
                </Field>
                <Field label="Menu accent color">
                    <ColorPickerField inputMode="text" inputStyle={sharedStyles.input(uiScale)} onChange={hex => setField('accentColor', hex)} uiScale={uiScale} value={typeof player.accentColor === 'number' ? player.accentColor : text(player.accentColor) || '#FFAAAA'} />
                </Field>
                <Field label="Save slots">
                    <input max={24} min={1} onChange={event => setField('saveSlots', event.target.value === '' ? undefined : Number(event.target.value))} placeholder="6" step={1} style={sharedStyles.input(uiScale)} type="number" value={typeof player.saveSlots === 'number' ? player.saveSlots : ''} />
                </Field>
            </div>
            <PlayerAppearanceFields player={player} setField={setField} uiScale={uiScale} />
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 16 }}>
                {(['titleActions', 'pauseActions'] as const).map(menu => (
                    <PlayerMenuActions config={config} key={menu} menu={menu} onUpdate={onUpdate} uiScale={uiScale} />
                ))}
            </div>
            <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: `${12 * uiScale}px` }}>Custom action labels</summary>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 10 }}>
                    {Object.entries(PLAYER_ACTION_LABELS).map(([action, label]) => (
                        <Field key={action} label={`${label} label`}>
                            <input maxLength={80} onChange={event => onUpdate(current => setPlayerConfigLabel(current, action as keyof typeof PLAYER_ACTION_LABELS, event.target.value))} placeholder={label} style={sharedStyles.input(uiScale)} value={text(labels[action])} />
                        </Field>
                    ))}
                </div>
            </details>
        </section>
    );
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}
