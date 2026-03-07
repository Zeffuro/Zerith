export function hasLikelyIssue(node: any): boolean {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return true;

    switch (node.type) {
        case 'dialogue':
            return typeof node.text !== 'string';
        case 'jump':
            return typeof node.to !== 'string' || node.to.trim() === '';
        case 'call':
            return typeof node.name !== 'string' || node.name.trim() === '';
        case 'background':
            return typeof node.assetUrl !== 'string' || node.assetUrl.trim() === '';
        case 'sfx':
            return typeof node.assetUrl !== 'string' || node.assetUrl.trim() === '';
        case 'label':
            return typeof node.name !== 'string' || node.name.trim() === '';
        case 'goto':
            return typeof node.label !== 'string' || node.label.trim() === '';
        case 'if':
            return !Array.isArray(node.then) || !Array.isArray(node.else);
        case 'while':
            return !Array.isArray(node.body);
        case 'for':
            return !Array.isArray(node.body);
        default:
            return false;
    }
}