import type { ZodError } from 'zod';

export function zodIssuesToMap(error: ZodError): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const issue of error.issues) {
        const key = issue.path.length ? issue.path.join('.') : '_root';
        if (!out[key]) out[key] = [];
        out[key].push(issue.message);
    }
    return out;
}