import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function BackgroundInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);
    return (
        <div>
            <label style={labelStyle}>Asset URL</label>
            <input
                type="text"
                value={node.assetUrl || ''}
                onChange={(e) => handleChange('assetUrl', e.target.value)}
                placeholder="/assets/bg/courtroom.png"
                style={inputStyle}
            />
        </div>
    );
}