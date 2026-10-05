export function button(label: string, action: () => void): HTMLButtonElement {
    const node = element('button', 'zerith-shell-button', label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function focusable(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
        .filter(node => !node.closest('[hidden]'));
}

export function moveFocus(root: HTMLElement, direction: -1 | 1): void {
    const nodes = focusable(root);
    if (nodes.length === 0) return;
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    nodes[(current + direction + nodes.length) % nodes.length]?.focus();
}

