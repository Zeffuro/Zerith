import type { CSSProperties } from 'react';

type Properties = {
    inputMode?: 'number' | 'text';
    inputStyle?: CSSProperties;
    onChange: (hexString: string, numValue: number) => void;
    uiScale: number;
    value: number | string;
};

const MAX_RGB_VALUE = 0xFF_FF_FF;

export function ColorPickerField({
    inputMode = 'number',
    inputStyle,
    onChange,
    uiScale,
    value,
}: Properties) {
    const colorState = resolveColorState(value);

    return (
        <div style={{ alignItems: 'center', display: 'flex', gap: '8px' }}>
            <input
                onChange={(event) => {
                    const nextHex = event.target.value;
                    onChange(nextHex, Number.parseInt(nextHex.replace('#', ''), 16));
                }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    height: `${32 * uiScale}px`,
                    padding: 0,
                    width: `${32 * uiScale}px`,
                }}
                title="Pick Color"
                type="color"
                value={colorState.hexValue}
            />
            <input
                onChange={(event) => {
                    if (inputMode === 'number') {
                        const parsedNumber = Number(event.target.value);
                        if (!Number.isFinite(parsedNumber)) return;
                        const normalized = normalizeColorNumber(parsedNumber);
                        onChange(toHexColor(normalized), normalized);
                        return;
                    }

                    const parsedHex = parseHexColor(event.target.value);
                    if (!parsedHex) return;
                    onChange(parsedHex, Number.parseInt(parsedHex.replace('#', ''), 16));
                }}
                style={{ ...inputStyle, flex: 1 }}
                type={inputMode}
                value={inputMode === 'number' ? colorState.numValue : colorState.hexValue}
            />
        </div>
    );
}

function normalizeColorNumber(value: number): number {
    const truncated = Math.trunc(value);
    if (truncated < 0) return 0;
    if (truncated > MAX_RGB_VALUE) return MAX_RGB_VALUE;
    return truncated;
}

function parseHexColor(value: string): null | string {
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (!/^#[\dA-Fa-f]{6}$/.test(normalized)) return null;
    return normalized.toUpperCase();
}

function resolveColorState(value: number | string) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const numValue = normalizeColorNumber(value);
        return { hexValue: toHexColor(numValue), numValue };
    }

    if (typeof value === 'string') {
        const parsedHex = parseHexColor(value);
        if (parsedHex) {
            return {
                hexValue: parsedHex,
                numValue: Number.parseInt(parsedHex.replace('#', ''), 16),
            };
        }
    }

    return {
        hexValue: '#FFFFFF',
        numValue: MAX_RGB_VALUE,
    };
}

function toHexColor(value: number): string {
    return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
}

