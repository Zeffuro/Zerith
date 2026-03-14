import type {
    InferredVariableType,
    ReferenceLocation,
    VariableReferenceStats,
} from './types';

export function extractTemplateVariables(value: string): string[] {
    const matches = value.matchAll(/\{([a-zA-Z_]\w*)}/g);
    const names: string[] = [];
    for (const match of matches) {
        const name = match[1];
        if (name) names.push(name);
    }
    return [...new Set(names)];
}

export function mergeInferredType(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    inferredType: InferredVariableType,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType, reads: [], writes: [] };
        return;
    }

    const current = variables[variableName].inferredType;
    if (current === 'unknown') {
        variables[variableName].inferredType = inferredType;
        return;
    }

    if (inferredType === 'unknown' || current === inferredType) {
        return;
    }

    variables[variableName].inferredType = 'mixed';
}

export function pushVariableRead(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    location: ReferenceLocation,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType: 'unknown', reads: [], writes: [] };
    }
    variables[variableName].reads.push(location);
}

export function pushVariableWrite(
    variables: Record<string, VariableReferenceStats>,
    variableName: string,
    location: ReferenceLocation,
): void {
    if (!variables[variableName]) {
        variables[variableName] = { inferredType: 'unknown', reads: [], writes: [] };
    }
    variables[variableName].writes.push(location);
}


