export interface FocusableItem {
    focus: () => void;
    blur: () => void;
    activate: () => void;
}

export class PanelFocusManager {
    private items: FocusableItem[] = [];
    private _selectedIndex = 0;

    public get selectedIndex(): number {
        return this._selectedIndex;
    }

    public get count(): number {
        return this.items.length;
    }

    public register(item: FocusableItem) {
        this.items.push(item);
    }

    public clear() {
        this.items = [];
        this._selectedIndex = 0;
    }

    public focusInitial(index: number = 0) {
        if (this.items.length === 0) return;
        this._selectedIndex = Math.min(index, this.items.length - 1);
        this.items[this._selectedIndex].focus();
    }

    public navigate(direction: 'up' | 'down' | 'left' | 'right') {
        if (this.items.length === 0) return;

        const prev = this._selectedIndex;
        if (direction === 'up') {
            this._selectedIndex = prev <= 0 ? this.items.length - 1 : prev - 1;
        } else if (direction === 'down') {
            this._selectedIndex = prev >= this.items.length - 1 ? 0 : prev + 1;
        }

        if (prev !== this._selectedIndex) {
            this.items[prev].blur();
            this.items[this._selectedIndex].focus();
        }
    }

    public confirm() {
        if (this.items.length === 0) return;
        this.items[this._selectedIndex].activate();
    }
}