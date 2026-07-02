import { WEATHER_PRESET_DEFAULTS, type WeatherCommand, type WeatherPreset } from '@zeffuro/zerith-core';
import { useState } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { editorTheme as t } from '../../theme/editorTheme';
import { FieldError } from './FieldError';
import { ColorPickerField } from './fields/ColorPickerField';

const ADVANCED_WEATHER_FIELDS = [
    'alpha',
    'angle',
    'color',
    'density',
    'id',
    'layer',
    'size',
    'speed',
    'wind',
] as const;

const BUILT_IN_WEATHER_PRESETS: WeatherPreset[] = [
    'drizzle',
    'rain',
    'heavy_rain',
    'storm',
    'snowfall',
    'blizzard',
    'ashfall',
    'embers',
];

const WEATHER_LAYER_OPTIONS = [
    'background',
    'backgroundEffects',
    'sprites',
    'foregroundEffects',
    'overlay',
] as const;

export function WeatherInspector({ index, node }: { index?: null | number; node: WeatherCommand; }) {
    const { applyNodePatch, getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedOverrides(node));
    const action = node.action ?? 'start';
    const preset = resolveWeatherPreset(node.preset);
    const displayPreset = resolveDisplayPreset(preset);
    const defaults = WEATHER_PRESET_DEFAULTS[preset];

    const handlePresetChange = (value: string) => {
        const nextPreset = resolveWeatherPreset(value);
        const currentDefaultId = defaults.defaultId;
        const shouldClearId = !node.id || node.id === currentDefaultId || node.id === preset;

        applyNodePatch({
            alpha: undefined,
            angle: undefined,
            color: undefined,
            density: undefined,
            id: shouldClearId ? undefined : node.id,
            layer: undefined,
            preset: nextPreset,
            size: undefined,
            speed: undefined,
            wind: undefined,
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(event) => handleChange('action', event.target.value)}
                    style={getFieldInputStyle('action')}
                    value={action}
                >
                    <option value="start">Start Weather</option>
                    <option value="stop">Stop Weather</option>
                    <option value="clear">Clear All Weather</option>
                </select>
                <FieldError errors={getFieldErrors('action')} />
            </div>

            {action !== 'clear' && (
                <div>
                    <label style={labelStyle}>Built-in Weather</label>
                    <select
                        onChange={(event) => handlePresetChange(event.target.value)}
                        style={getFieldInputStyle('preset')}
                        value={displayPreset}
                    >
                        {BUILT_IN_WEATHER_PRESETS.map((presetKey) => (
                            <option key={presetKey} value={presetKey}>
                                {WEATHER_PRESET_DEFAULTS[presetKey].label}
                            </option>
                        ))}
                    </select>
                    <FieldError errors={getFieldErrors('preset')} />
                </div>
            )}

            {action === 'start' && (
                <div>
                    <label style={labelStyle}>Fade In (ms)</label>
                    <input
                        min={0}
                        onChange={(event) => handleChange('fadeIn', Number(event.target.value))}
                        style={getFieldInputStyle('fadeIn')}
                        type="number"
                        value={node.fadeIn ?? 0}
                    />
                    <FieldError errors={getFieldErrors('fadeIn')} />
                </div>
            )}

            {action !== 'start' && (
                <div>
                    <label style={labelStyle}>Fade Out (ms)</label>
                    <input
                        min={0}
                        onChange={(event) => handleChange('fadeOut', Number(event.target.value))}
                        style={getFieldInputStyle('fadeOut')}
                        type="number"
                        value={node.fadeOut ?? 0}
                    />
                    <FieldError errors={getFieldErrors('fadeOut')} />
                </div>
            )}

            {action !== 'clear' && (
                <button
                    onClick={() => setAdvancedOpen((open) => !open)}
                    style={{
                        alignSelf: 'flex-start',
                        background: advancedOpen ? t.bg.hover : t.bg.panelAlt,
                        border: `1px solid ${t.border.normal}`,
                        borderRadius: '4px',
                        color: t.text.normal,
                        cursor: 'pointer',
                        fontSize: '0.85em',
                        padding: `${6 * uiScale}px ${10 * uiScale}px`,
                    }}
                    type="button"
                >
                    {advancedOpen ? 'Hide Advanced' : 'Show Advanced'}
                </button>
            )}

            {advancedOpen && action !== 'clear' && (
                <>
                    <div>
                        <label style={labelStyle}>Effect ID</label>
                        <input
                            onChange={(event) => handleChange('id', event.target.value)}
                            placeholder={defaults.defaultId}
                            style={getFieldInputStyle('id')}
                            type="text"
                            value={node.id ?? ''}
                        />
                        <FieldError errors={getFieldErrors('id')} />
                    </div>

                    {action === 'start' && (
                        <>
                            <div>
                                <label style={labelStyle}>Layer</label>
                                <input
                                    list="weather-layer-options"
                                    onChange={(event) => handleChange('layer', event.target.value)}
                                    placeholder={defaults.layer}
                                    style={getFieldInputStyle('layer')}
                                    type="text"
                                    value={node.layer ?? defaults.layer}
                                />
                                <datalist id="weather-layer-options">
                                    {WEATHER_LAYER_OPTIONS.map((layer) => <option key={layer} value={layer} />)}
                                </datalist>
                                <FieldError errors={getFieldErrors('layer')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Density</label>
                                <input
                                    min={0}
                                    onChange={(event) => handleChange('density', Number(event.target.value))}
                                    style={getFieldInputStyle('density')}
                                    type="number"
                                    value={node.density ?? defaults.density}
                                />
                                <FieldError errors={getFieldErrors('density')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Speed</label>
                                <input
                                    min={0}
                                    onChange={(event) => handleChange('speed', Number(event.target.value))}
                                    style={getFieldInputStyle('speed')}
                                    type="number"
                                    value={node.speed ?? defaults.speed}
                                />
                                <FieldError errors={getFieldErrors('speed')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Angle</label>
                                <input
                                    onChange={(event) => handleChange('angle', Number(event.target.value))}
                                    style={getFieldInputStyle('angle')}
                                    type="number"
                                    value={node.angle ?? defaults.angle}
                                />
                                <FieldError errors={getFieldErrors('angle')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Wind</label>
                                <input
                                    onChange={(event) => handleChange('wind', Number(event.target.value))}
                                    style={getFieldInputStyle('wind')}
                                    type="number"
                                    value={node.wind ?? defaults.wind}
                                />
                                <FieldError errors={getFieldErrors('wind')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Particle Size</label>
                                <input
                                    min={0}
                                    onChange={(event) => handleChange('size', Number(event.target.value))}
                                    step="0.1"
                                    style={getFieldInputStyle('size')}
                                    type="number"
                                    value={node.size ?? defaults.size}
                                />
                                <FieldError errors={getFieldErrors('size')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Alpha</label>
                                <input
                                    max={1}
                                    min={0}
                                    onChange={(event) => handleChange('alpha', Number(event.target.value))}
                                    step="0.05"
                                    style={getFieldInputStyle('alpha')}
                                    type="number"
                                    value={node.alpha ?? defaults.alpha}
                                />
                                <FieldError errors={getFieldErrors('alpha')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Color</label>
                                <ColorPickerField
                                    inputMode="number"
                                    inputStyle={getFieldInputStyle('color')}
                                    onChange={(_hexValue, numberValue) => handleChange('color', numberValue)}
                                    uiScale={uiScale}
                                    value={node.color ?? defaults.color}
                                />
                                <FieldError errors={getFieldErrors('color')} />
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function hasAdvancedOverrides(node: WeatherCommand): boolean {
    return ADVANCED_WEATHER_FIELDS.some((field) => node[field] !== undefined);
}

function resolveDisplayPreset(preset: WeatherPreset): WeatherPreset {
    if (preset === 'ash') return 'ashfall';
    if (preset === 'snow') return 'snowfall';
    return preset;
}

function resolveWeatherPreset(value: string | undefined): WeatherPreset {
    return value && value in WEATHER_PRESET_DEFAULTS
        ? value as WeatherPreset
        : 'rain';
}
