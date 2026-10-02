use super::support::{empty_git_status_response, parse_git_branch_line};
use super::types::{GitDiffFileSummary, GitStatusEntry, GitStatusResponse};

pub(super) fn parse_git_status(raw: &str) -> GitStatusResponse {
    let mut response = empty_git_status_response(true);
    let mut records = raw.split('\0');
    while let Some(record) = records.next() {
        if let Some(branch) = record.strip_prefix("## ") {
            parse_git_branch_line(branch, &mut response);
            continue;
        }
        let Some(path) = record.get(3..).filter(|path| !path.is_empty()) else {
            continue;
        };
        let codes = record.as_bytes();
        let original_path = if codes[..2].iter().any(|code| *code == b'R' || *code == b'C') {
            records.next().map(str::to_owned)
        } else {
            None
        };
        response.entries.push(GitStatusEntry {
            index: (codes[0] as char).to_string(),
            working_tree: (codes[1] as char).to_string(),
            path: path.to_owned(),
            original_path,
        });
    }
    response.raw_status = response
        .entries
        .iter()
        .map(|entry| format!("{}{} {}", entry.index, entry.working_tree, entry.path))
        .collect::<Vec<_>>()
        .join("\n");
    response
}

pub(super) fn parse_git_numstat_summary(raw: &str) -> Vec<GitDiffFileSummary> {
    let mut files: Vec<GitDiffFileSummary> = Vec::new();
    let mut records = raw.split('\0');
    while let Some(record) = records.next() {
        let mut parts = record.splitn(3, '\t');
        let (Some(insertions), Some(deletions), Some(path)) =
            (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let (path, original_path) = if path.is_empty() {
            let (Some(original), Some(destination)) = (records.next(), records.next()) else {
                break;
            };
            (destination, Some(original.to_owned()))
        } else {
            (path, None)
        };
        let entry = GitDiffFileSummary {
            binary: insertions == "-" || deletions == "-",
            deletions: deletions.parse::<u32>().unwrap_or(0),
            insertions: insertions.parse::<u32>().unwrap_or(0),
            path: path.to_owned(),
            original_path,
        };
        if let Some(existing) = files.iter_mut().find(|file| file.path == entry.path) {
            existing.binary |= entry.binary;
            existing.deletions += entry.deletions;
            existing.insertions += entry.insertions;
            if existing.original_path.is_none() {
                existing.original_path = entry.original_path;
            }
        } else {
            files.push(entry);
        }
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    files
}
