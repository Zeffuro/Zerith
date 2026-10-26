import type { ReactElement, ReactNode } from 'react';

import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ index: 0, slots: [] as unknown[] }));
vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useId: () => 'asset-dialog-id',
    useRef: () => ({ current: undefined }),
    useState: (initial: unknown) => {
        const index = mocks.index++;
        if (!(index in mocks.slots)) mocks.slots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
        return [mocks.slots[index], (value: unknown) => { mocks.slots[index] = value; }];
    },
}));
vi.mock('../../../hooks/useBackdropDismissal', () => ({ useBackdropDismissal: () => ({}) }));
vi.mock('../../../hooks/useDialogFocusTrap', () => ({ useDialogFocusTrap: () => {} }));

import { AssetMetadataEditorDialog } from '../AssetMetadataEditorDialog';

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(node)) return (node as ReactNode[]).flatMap(child => elements(child));
    if (!isValidElement<Record<string, unknown>>(node)) return [];
    return [node, ...elements(node.props.children as ReactNode)];
}
function render(overrides: Partial<Parameters<typeof AssetMetadataEditorDialog>[0]> = {}) {
    mocks.index = 0;
    const properties = {
        assetUrl: '/assets/a', busy: false,
        metadata: { collections: ['Original'], tags: ['keep'] },
        onCancel: vi.fn(), onSave: vi.fn(), uiScale: 1, ...overrides,
    };
    const all = elements(AssetMetadataEditorDialog(properties));
    const inputs = all.filter(element => element.type === 'input');
    const form = all.find(element => element.type === 'form')!;
    const submit = () => (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault() {} });
    const editTags = (value: string) => (inputs[1].props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
    return { all, editTags, inputs, props: properties, submit };
}

describe('asset metadata dialog drafts', () => {
    beforeEach(() => { mocks.slots = []; });

    it('keeps typed labels when incoming metadata changes after a refresh', () => {
        render().editTags('typed, draft');
        const result = render({ metadata: { collections: ['External'], tags: ['incoming'] } });
        expect(result.inputs.map(input => input.props.value)).toEqual(['Original', 'typed, draft']);
        result.submit();
        expect(result.props.onSave).toHaveBeenCalledWith({ collections: ['Original'], tags: ['draft', 'typed'] });
    });

    it('preserves drafts during saving and after failure', () => {
        render().editTags('unsaved');
        const pending = render({ busy: true });
        pending.submit();
        expect(pending.props.onSave).not.toHaveBeenCalled();
        const failed = render({ error: 'write failed' });
        expect(failed.inputs[1].props.value).toBe('unsaved');
        failed.submit();
        expect(failed.props.onSave).toHaveBeenCalledWith({ collections: ['Original'], tags: ['unsaved'] });
    });

    it('blocks saving after load failure while keeping cancellation and retry available', () => {
        render().editTags('keep draft');
        const onRetry = vi.fn();
        const result = render({ error: 'read failed', onRetry, saveDisabled: true });
        result.submit();
        expect(result.props.onSave).not.toHaveBeenCalled();
        expect(result.inputs[1].props.value).toBe('keep draft');
        const retry = result.all.find(element => element.type === 'button' && element.props.children === 'Retry metadata load')!;
        expect(retry.props.disabled).toBe(false);
        (retry.props.onClick as () => void)();
        expect(onRetry).toHaveBeenCalledOnce();
        const cancel = result.all.find(element => element.type === 'button' && element.props.children === 'Cancel')!;
        expect(cancel.props.disabled).toBe(false);
    });

    it('initializes a new dialog opening from refreshed metadata', () => {
        render().editTags('old draft');
        mocks.slots = [];
        const result = render({ metadata: { collections: ['New'], tags: ['current'] } });
        expect(result.inputs.map(input => input.props.value)).toEqual(['New', 'current']);
    });
});
