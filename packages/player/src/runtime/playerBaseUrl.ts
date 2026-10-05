export function resolvePlayerBaseUrl(base = import.meta.env.BASE_URL): string {
    const exportedBase = globalThis.document?.querySelector<HTMLMetaElement>('meta[name="zerith-base-url"]')?.content;
    return new URL(exportedBase || base, globalThis.location.href).toString();
}
