import { CSSProperties, useMemo } from 'react';

import { useAssetOptions } from '../../../hooks/useAssetOptions';

type Properties = {
    inputStyle?: CSSProperties;
    kind?: 'all' | 'audio' | 'bg' | 'bgm' | 'sfx' | 'sprite';
    listId: string;
    onChange: (next: string) => void;
    placeholder?: string;
    value: string;
};

export function AssetPickerField({
                                     inputStyle,
                                     kind = 'all',
                                     listId,
                                     onChange,
                                     placeholder = '/assets/...',
                                     value,
                                 }: Properties) {
    const { assets } = useAssetOptions(kind);

    const options = useMemo(() => assets.slice(0, 200), [assets]);

    return (
        <>
            <input
                list={listId}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                style={inputStyle}
                type="text"
                value={value}
            />
            <datalist id={listId}>
                {options.map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>
        </>
    );
}