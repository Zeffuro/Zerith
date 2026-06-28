export type BulkMetadataRequest = {
    assetUrls: string[];
    scopeLabel: string;
    subject: string;
    title: string;
};

export function createBulkMetadataRequest(
    assetUrls: string[],
    scopeLabel: string,
    subjectLabel: string,
    title: string,
): BulkMetadataRequest {
    return {
        assetUrls,
        scopeLabel,
        subject: `${assetUrls.length} ${subjectLabel} asset${assetUrls.length === 1 ? '' : 's'}`,
        title,
    };
}
