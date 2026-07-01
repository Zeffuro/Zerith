import type { EditorPluginPackageIntegrityFile, EditorPluginSourceRecord } from './pluginManifestInspection';

import { fsJoin, fsReadBinaryFile } from '../services/fs';

export type EditorPluginPackageIntegrityVerificationDependencies = {
    join: (...parts: string[]) => Promise<string>;
    readBinaryFile: (path: string) => Promise<Uint8Array>;
};

export type EditorPluginPackageIntegrityVerificationResult =
    | {
        checkedFiles: number;
        status: 'verified';
    }
    | {
        reason: string;
        status: 'rejected' | 'skipped';
    };

const DEFAULT_INTEGRITY_VERIFICATION_DEPENDENCIES: EditorPluginPackageIntegrityVerificationDependencies = {
    join: fsJoin,
    readBinaryFile: fsReadBinaryFile,
};

export async function createEditorPluginPackageIntegrityFile(
    relativePath: string,
    bytes: Uint8Array,
): Promise<EditorPluginPackageIntegrityFile> {
    return {
        path: relativePath,
        sha256: await createSha256HexDigest(bytes),
        size: bytes.byteLength,
    };
}

export async function createSha256HexDigest(bytes: Uint8Array): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Plugin package integrity hashing requires Web Crypto support.');
    }

    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function verifyEditorPluginPackageIntegrity(
    record: EditorPluginSourceRecord,
    dependencies: Partial<EditorPluginPackageIntegrityVerificationDependencies> = {},
): Promise<EditorPluginPackageIntegrityVerificationResult> {
    if (!record.packageIntegrity) {
        return {
            reason: 'source record has no package integrity metadata',
            status: 'skipped',
        };
    }

    if (!record.install.targetPath) {
        return {
            reason: 'source record install.targetPath is required before verifying package integrity',
            status: 'rejected',
        };
    }

    const resolvedDependencies = {
        ...DEFAULT_INTEGRITY_VERIFICATION_DEPENDENCIES,
        ...dependencies,
    };

    for (const file of record.packageIntegrity.files) {
        const filePath = await resolvedDependencies.join(record.install.targetPath, file.path);
        let bytes: Uint8Array;
        try {
            bytes = await resolvedDependencies.readBinaryFile(filePath);
        } catch (error) {
            return {
                reason: `package integrity file could not be read: ${file.path} (${error instanceof Error ? error.message : String(error)})`,
                status: 'rejected',
            };
        }

        if (bytes.byteLength !== file.size) {
            return {
                reason: `package integrity size mismatch: ${file.path}`,
                status: 'rejected',
            };
        }

        const sha256 = await createSha256HexDigest(bytes);
        if (sha256 !== file.sha256) {
            return {
                reason: `package integrity hash mismatch: ${file.path}`,
                status: 'rejected',
            };
        }
    }

    return {
        checkedFiles: record.packageIntegrity.files.length,
        status: 'verified',
    };
}
