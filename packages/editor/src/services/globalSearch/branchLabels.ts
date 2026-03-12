export const SCRIPT_BRANCH_LABEL_SEPARATOR = ' > ';

export function formatScriptBranchLabel(parentLabel: string, branchLabel: string): string {
    return `${parentLabel}${SCRIPT_BRANCH_LABEL_SEPARATOR}${branchLabel}`;
}

