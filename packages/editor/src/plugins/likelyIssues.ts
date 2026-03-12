import { toRecordOrUndefined } from '../utils/typeGuards';

export function hasLikelyIssue(node: unknown): boolean {
    const object = toRecordOrUndefined(node);
    if (!object || typeof object.type !== 'string') return true;

    switch (object.type) {
        case 'background': {
            return typeof object.assetUrl !== 'string' || object.assetUrl.trim() === '';
        }
        case 'call': {
            return typeof object.name !== 'string' || object.name.trim() === '';
        }
        case 'dialogue': {
            return typeof object.text !== 'string';
        }
        case 'for': {
            return !Array.isArray(object.body);
        }
        case 'goto': {
            return typeof object.label !== 'string' || object.label.trim() === '';
        }
        case 'if': {
            return !Array.isArray(object.onTrue) || !Array.isArray(object.onFalse);
        }
        case 'jump': {
            return typeof object.to !== 'string' || object.to.trim() === '';
        }
        case 'label': {
            return typeof object.name !== 'string' || object.name.trim() === '';
        }
        case 'sfx': {
            return typeof object.assetUrl !== 'string' || object.assetUrl.trim() === '';
        }
        case 'while': {
            return !Array.isArray(object.body);
        }
        default: {
            return false;
        }
    }
}

