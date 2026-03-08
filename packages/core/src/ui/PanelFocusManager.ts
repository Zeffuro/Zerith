export interface FocusableItem {
    activate: () => void;
    blur: () => void;
    focus: () => void;
}

export class PanelFocusManager {
    public get count(): number {
        return this.items.length;
    }
    public set onBack(handler: (() => void) | null) {
        this._onBack = handler;
    }
    public set onNavigateRaw(handler: ((direction: 'down' | 'left' | 'right' | 'up') => boolean) | null) {
        this._onNavigateRaw = handler;
    }
    public get selectedIndex(): number {
        return this._selectedIndex;
    }

    private _onBack: (() => void) | null = null;

    private _onNavigateRaw: ((direction: 'down' | 'left' | 'right' | 'up') => boolean) | null = null;

    private _selectedIndex = 0;

    private items: FocusableItem[] = [];

    public back() {
        this._onBack?.();
    }

    public clear() {
        this.items = [];
        this._selectedIndex = 0;
    }

    public confirm() {
        if (this.items.length === 0) return;
        this.items[this._selectedIndex].activate();
    }

    public focusInitial(index: number = 0) {
        if (this.items.length === 0) return;
        this._selectedIndex = Math.min(index, this.items.length - 1);
        this.items[this._selectedIndex].focus();
    }

    public navigate(direction: 'down' | 'left' | 'right' | 'up') {
        if (this._onNavigateRaw) {
            const consumed = this._onNavigateRaw(direction);
            if (consumed) return;
        }

        if (this.items.length === 0) return;

        const previous = this._selectedIndex;
        if (direction === 'up') {
            this._selectedIndex = previous <= 0 ? this.items.length - 1 : previous - 1;
        } else if (direction === 'down') {
            this._selectedIndex = previous >= this.items.length - 1 ? 0 : previous + 1;
        }

        if (previous !== this._selectedIndex) {
            this.items[previous].blur();
            this.items[this._selectedIndex].focus();
        }
    }

    public register(item: FocusableItem) {
        this.items.push(item);
    }
}