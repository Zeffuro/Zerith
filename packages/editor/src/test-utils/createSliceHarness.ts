export type SliceGet<TState extends object> = () => TState;

export type SliceHarness<TState extends object> = {
    get: SliceGet<TState>;
    set: SliceSet<TState>;
    setState: (patch: Partial<TState>) => void;
};

export type SliceSet<TState extends object> = (
    partial: ((state: TState) => Partial<TState>) | Partial<TState>,
) => void;

export function createSliceHarness<TState extends object>(initialState: TState): SliceHarness<TState> {
    let state = { ...initialState };

    const get: SliceGet<TState> = () => state;

    const set: SliceSet<TState> = (partial) => {
        const patch = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...patch };
    };

    const setState = (patch: Partial<TState>) => {
        state = { ...state, ...patch };
    };

    return { get, set, setState };
}

