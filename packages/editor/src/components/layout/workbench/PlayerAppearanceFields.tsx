import { ColorPickerField } from '../../inspector/fields/ColorPickerField';
import { Field, sharedStyles } from './EditorSharedUI';
import { type PlayerConfigField } from './playerConfigModel';

type Properties = {
    player: Record<string, unknown>;
    setField: (key: PlayerConfigField, value: number | string | undefined) => void;
    uiScale: number;
};

const selects = [
    { key: 'titleAlignment', label: 'Title layout', options: ['left', 'center', 'right'] },
    { key: 'menuFont', label: 'Menu font', options: ['system', 'serif', 'monospace'] },
    { key: 'cornerStyle', label: 'Corner style', options: ['rounded', 'square', 'pill'] },
] as const;
const numbers = [
    { fallback: 16, key: 'menuFontSize', label: 'Menu font size (px)', max: 24, min: 14, step: 1 },
    { fallback: 350, key: 'menuWidth', label: 'Menu button width (px)', max: 600, min: 220, step: 1 },
    { fallback: 44, key: 'buttonHeight', label: 'Button height (px)', max: 80, min: 44, step: 1 },
    { fallback: .96, key: 'panelOpacity', label: 'Panel opacity', max: 1, min: 0, step: .05 },
    { fallback: .45, key: 'backgroundOpacity', label: 'Background image opacity', max: 1, min: 0, step: .05 },
] as const;
const colors = [
    { fallback: '#151923', key: 'panelColor', label: 'Panel color' },
    { fallback: '#f2f0f8', key: 'textColor', label: 'Menu text color' },
    { fallback: '#232a3a', key: 'buttonColor', label: 'Button color' },
] as const;

export function PlayerAppearanceFields({ player, setField, uiScale }: Properties) {
    return (
        <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: `${12 * uiScale}px` }}>Layout and appearance</summary>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 10 }}>
                {selects.map(({ key, label, options }) => (
                    <Field key={key} label={label}>
                        <select aria-label={label} onChange={event => setField(key, event.target.value)} style={sharedStyles.input(uiScale)} value={typeof player[key] === 'string' ? player[key] : ''}>
                            <option value="">Default ({options[0]})</option>
                            {options.map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
                        </select>
                    </Field>
                ))}
                {numbers.map(({ fallback, key, label, max, min, step }) => (
                    <Field key={key} label={label}>
                        <input aria-label={label} max={max} min={min} onChange={event => setField(key, event.target.value === '' ? undefined : Number(event.target.value))} placeholder={String(fallback)} step={step} style={sharedStyles.input(uiScale)} type="number" value={typeof player[key] === 'number' ? player[key] : ''} />
                    </Field>
                ))}
                {colors.map(({ fallback, key, label }) => (
                    <Field key={key} label={label}>
                        <ColorPickerField inputMode="text" inputStyle={sharedStyles.input(uiScale)} onChange={hex => setField(key, hex)} uiScale={uiScale} value={(typeof player[key] === 'number') || (typeof player[key] === 'string') ? player[key] : fallback} />
                    </Field>
                ))}
            </div>
        </details>
    );
}
