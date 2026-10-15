//! Unified prompt tests.

use jeikcode_config::config::prompt_sections::build_rules;

// ═══════════════════════════════════════════════════════════════
// 1. Unified prompt — minimal but complete
// ═══════════════════════════════════════════════════════════════

#[test]
fn unified_prompt_has_all_sections() {
    let prompt = build_rules();
    assert!(prompt.contains("WORKFLOW"), "Must have workflow section");
    assert!(prompt.contains("TOOLS"), "Must have tool guide");
    assert!(prompt.contains("WHEN STUCK"), "Must have stuck section");
    assert!(prompt.contains("OUTPUT"), "Must have output guidelines");
    assert!(
        prompt.contains("`edit`"),
        "Must mention the canonical edit tool"
    );
    assert!(
        prompt.contains("`write`"),
        "Must mention the canonical write tool"
    );
}

#[test]
fn unified_prompt_has_key_guidance() {
    let prompt = build_rules();
    assert!(prompt.contains("`edit`"), "Must guide edit mode format");
    // Project-wide replacement now rides `edit`'s multi-hunk `edits` array — the former
    // `global_search_replace` tool is purged.
    assert!(
        prompt.contains("multi-hunk") && prompt.contains("edits:[{old_string,new_string}"),
        "Must guide batch editing through the canonical `edit` multi-hunk array"
    );
    assert!(
        prompt.contains("never with `run_command`"),
        "Must ban bash file mutation"
    );
}

#[test]
fn unified_prompt_size_reasonable() {
    let prompt = build_rules();
    let tokens = prompt.len() / 4;
    assert!(
        tokens > 50,
        "Too short: {} tokens — rules may be missing",
        tokens
    );
    assert!(
        tokens < 2600,
        "Too long: {} tokens — violates Less is More principle",
        tokens
    );
}
