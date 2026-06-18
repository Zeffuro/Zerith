export function areAllUnusedAssetsSelected(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): boolean {
    if (unusedAssetUrls.length === 0) return false;
    const selected = new Set(selectedAssetUrls);
    return unusedAssetUrls.every((assetUrl) => selected.has(assetUrl));
}

export function getSelectedUnusedAssets(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): string[] {
    const selected = new Set(selectedAssetUrls);
    return unusedAssetUrls.filter((assetUrl) => selected.has(assetUrl));
}

export function reconcileUnusedAssetSelection(
    selectedAssetUrls: readonly string[],
    unusedAssetUrls: readonly string[],
): string[] {
    const selected = getSelectedUnusedAssets(selectedAssetUrls, unusedAssetUrls);
    if (selected.length > 0 || selectedAssetUrls.length > 0) return selected;
    return [...unusedAssetUrls];
}

export function toggleUnusedAssetSelection(
    selectedAssetUrls: readonly string[],
    assetUrl: string,
    selected: boolean,
): string[] {
    const next = new Set(selectedAssetUrls);
    if (selected) {
        next.add(assetUrl);
    } else {
        next.delete(assetUrl);
    }
    return [...next].toSorted((left, right) => left.localeCompare(right));
}
