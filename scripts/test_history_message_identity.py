#!/usr/bin/env python3
"""Compile the production daemon history-target resolver with a tiny type stub.

This is a fast cross-platform regression check, not a replacement for the
daemon's real unit tests or HTTP/session persistence integration tests.
All generated code and the executable live in the OS temporary directory.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(
    os.environ.get(
        "JEIKCODE_HISTORY_ID_TEST_SOURCE",
        ROOT / "crates/jeikcode-daemon/src/lib.rs",
    )
)

STUB = r"""
mod jeikcode_kernel {
    pub mod message {
        #[derive(Clone, Debug, PartialEq, Eq)]
        pub enum Role { System, User, Assistant, Tool }
        #[derive(Clone)]
        pub struct Message {
            pub role: Role,
            pub text: String,
            pub reasoning: Option<String>,
            pub id: Option<String>,
        }
    }
}
"""

TESTS = r"""
#[cfg(test)]
mod tests {
    use super::resolve_target_message_index;
    use super::jeikcode_kernel::message::{Message, Role};

    fn msg(id: Option<&str>, role: Role, text: &str) -> Message {
        Message {
            id: id.map(str::to_owned),
            role,
            text: text.into(),
            reasoning: None,
        }
    }

    #[test]
    fn same_text_stale_index_resolves_exact_id() {
        let m = vec![
            msg(Some("m-a"), Role::User, "duplicate"),
            msg(Some("m-b"), Role::User, "duplicate"),
        ];
        assert_eq!(
            resolve_target_message_index(&m, 1, Some("m-a"), Some("duplicate"), Some("user")),
            Some(0)
        );
    }

    #[test]
    fn foreign_id_never_falls_back_to_a_valid_index() {
        let m = vec![msg(Some("m-b"), Role::User, "duplicate")];
        assert_eq!(resolve_target_message_index(&m, 0, Some("m-a"), None, Some("user")), None);
    }

    #[test]
    fn empty_or_blank_provided_id_is_not_a_legacy_call() {
        let m = vec![msg(Some("m-b"), Role::User, "duplicate")];
        for expected_id in ["", " ", "unknown-id"] {
            assert_eq!(
                resolve_target_message_index(
                    &m,
                    0,
                    Some(expected_id),
                    Some("duplicate"),
                    Some("user"),
                ),
                None,
                "invalid ID must not fall back: {expected_id:?}",
            );
        }
    }

    #[test]
    fn role_is_guard_but_projected_text_is_not_raw_precondition() {
        let m = vec![msg(Some("m-a"), Role::User, "new content")];
        assert_eq!(
            resolve_target_message_index(&m, 0, Some("m-a"), None, Some("assistant")), None
        );
        assert_eq!(
            resolve_target_message_index(&m, 0, Some("m-a"), Some("old content"), Some("user")), Some(0)
        );
    }

    #[test]
    fn duplicate_ids_fail_closed() {
        let m = vec![
            msg(Some("m-a"), Role::User, "duplicate"),
            msg(Some("m-a"), Role::User, "duplicate"),
        ];
        assert_eq!(resolve_target_message_index(&m, 0, Some("m-a"), None, None), None);
    }

    #[test]
    fn legacy_idless_callers_keep_nearest_index_matching() {
        let m = vec![
            msg(Some("m-a"), Role::User, "duplicate"),
            msg(Some("m-b"), Role::User, "duplicate"),
        ];
        assert_eq!(resolve_target_message_index(&m, 1, None, Some("duplicate"), Some("user")), Some(1));
    }

    #[test]
    fn reasoning_text_alignment_remains_available_without_id() {
        let mut assistant = msg(Some("m-a"), Role::Assistant, "answer");
        assistant.reasoning = Some("reasoning".into());
        let m = vec![assistant];
        assert_eq!(
            resolve_target_message_index(&m, 0, None, Some("reasoning\nanswer"), Some("assistant")),
            Some(0)
        );
    }
}
"""


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")
    marker = "fn resolve_target_message_index(\n"
    end_marker = "\n/// PATCH /projects/:hash/sessions/:id/messages/:index"
    if raw.count(marker) != 1:
        raise AssertionError("expected exactly one production history-target resolver")
    function = raw.split(marker, 1)[1].split(end_marker, 1)
    if len(function) != 2:
        raise AssertionError("production resolver terminator not found")
    code = STUB + marker + function[0] + "\n" + TESTS
    with tempfile.TemporaryDirectory(prefix="jeikcode-history-id-") as tmp:
        src = Path(tmp) / "resolver_contract.rs"
        binary = Path(tmp) / ("resolver_contract.exe" if os.name == "nt" else "resolver_contract")
        src.write_text(code, encoding="utf-8")
        subprocess.run(
            ["rustc", "--edition=2021", "--test", str(src), "-o", str(binary)],
            check=True,
        )
        subprocess.run([str(binary), "--nocapture"], check=True)


if __name__ == "__main__":
    main()
