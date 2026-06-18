import { clamp } from '../../utils/math';

export function scrollRowIntoContainer(row: HTMLDivElement, container: HTMLDivElement): void {
    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const visibilityMargin = 8;

    let nextTop = container.scrollTop;
    if (rowRect.top < containerRect.top + visibilityMargin) {
        nextTop += rowRect.top - containerRect.top - visibilityMargin;
    } else if (rowRect.bottom > containerRect.bottom - visibilityMargin) {
        nextTop += rowRect.bottom - containerRect.bottom + visibilityMargin;
    }

    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const clampedTop = clamp(nextTop, 0, maxTop);
    if (Math.abs(clampedTop - container.scrollTop) < 1) return;

    container.scrollTo({
        behavior: 'smooth',
        top: clampedTop,
    });
}

