import { CSSProperties, useMemo } from 'react';
import { useAssetOptions } from '../../../hooks/useAssetOptions';

type Props = {
    value: string;
    onChange: (next: string) => void;
    kind?: 'bg' | 'sprite' | 'audio' | 'all';
    placeholder?: string;
    inputStyle?: CSSProperties;
    listId: string;
};

export function AssetPickerField({
                                     value,
                                     onChange,
                                     kind = 'all',
                                     placeholder = '/assets/...',
                                     inputStyle,
                                     listId,
                                 }: Props) {
    const { assets } = useAssetOptions(kind);

    const options = useMemo(() => assets.slice(0, 200), [assets]);

    return (
        <>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                style={inputStyle}
                list={listId}
            />
            <datalist id={listId}>
                {options.map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>
        </>
    );
}