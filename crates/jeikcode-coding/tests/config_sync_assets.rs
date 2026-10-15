//! Locks the bundled-asset sync surface for the code-graph ignore split.
//!
//! `assets/.codegraphignore.graph` carries the GRAPH-ONLY sensitive-credential rules
//! (`.env*`, keys, SSH) that were moved out of the search-visible `.codegraphignore`.
//! Upgraded users can only adopt that split if the new asset is OFFERED by config sync
//! (`New` diff, default-selected) — shipping the file without registering it would leave
//! every existing installation indexing credentials forever.

use jeikcode_coding::config_sync::{scan_jeikcode_config_diffs, DiffKind};

#[test]
fn graph_only_ignore_asset_is_offered_to_upgraded_users() {
    let home = tempfile::tempdir().unwrap();
    let diffs = scan_jeikcode_config_diffs(home.path());

    let graph_only = diffs
        .iter()
        .find(|d| d.relative_path == ".codegraphignore.graph")
        .expect("the graph-only ignore asset must be offered by config sync");
    assert!(
        matches!(graph_only.kind, DiffKind::New),
        "a clean home must see it as a New diff"
    );
    assert!(
        graph_only.selected,
        "must be default-selected, or users never install the credential rules"
    );

    // The shared noise list keeps shipping too (same scope, both scopes must stay alive).
    assert!(
        diffs.iter().any(|d| d.relative_path == ".codegraphignore"),
        "the shared .codegraphignore must keep shipping"
    );
}
