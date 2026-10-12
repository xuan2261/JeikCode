# M05 / JC-14 — only delete visible history after confirmed backend removal

## Outcome, reproduction, reuse

**Problem:** On current upstream `jeikl/JeikCode:beta` HEAD `d1a6308e7a062be86a969647a5fdb44da9c0f744` (2026-10-13), `Chat.tsx`'s user-turn and assistant delete handlers catch a failed HTTP DELETE and then **unconditionally** remove the row from canvas, in-memory transcript, outline and/or IndexedDB. The daemon also returns HTTP 200 `{success:true, notFound:true}` when the requested persisted history target cannot be found; the frontend treats this as successful deletion. Repro source: `webui/src/components/Chat.tsx` handlers `handleDeleteUserMessage` and `handleDeleteAssistantMessage`, and `api.ts`'s `deleteSessionMessage`.

**User-visible outcome:** a rejected/no-op DELETE preserves the visible transcript and all local cache state. A confirmed DELETE may update only the originating session's current view, not the destination after a switch or A→B→A.

**Reuse:** existing wire response `success/notFound`, `sessionGenerationRef`, `activeIdRef`, existing localized `common.error` toast, and `webui/src/lib/historyMessages.ts` for a tiny async receipt guard. No new endpoint, wire field, cache schema or second lifecycle.

## Scope and acceptance

- Modify `Chat.tsx` *only* in the two history DELETE callbacks; keep current delete semantics for user turns and assistant output. Both call an applied-receipt guard before any canvas, L1, L2 or outline mutation.
- Add `applyConfirmedHistoryDelete` in existing `historyMessages.ts`, covered in `historyMessages.test.ts`. `success !== true`, `notFound === true` and thrown network/HTTP failures never call local mutation. A good server ACK calls it once. Before-request and after-request generation guards prevent stale callbacks.
- On confirmed current-view deletion, derive the next transcript synchronously from `messagesRef.current` and use the **same** data for canvas, ref and cache, avoiding an empty pre-updater cache snapshot.
- For assistant deletion, match the originally targeted persisted `sourceIndex` again at ACK time rather than splicing a captured render index. Daemon `session_mutation` can reach the WebUI **before the initiating HTTP ACK**; if SSE already removed the row, do nothing instead of accidentally deleting the following row. If a new message reuses the same index after reconciliation, enforce the original stable ID; for legacy ID-less messages, require the exact original in-memory object.
- A new test also covers A→B→A generation, not merely a different session ID.
- Display failures using the existing current-locale `t('common.error')` key. Do not add untranslated UI strings.

## Verification ledger

- **TDD RED:** `node --test src/lib/historyMessages.test.ts` from `webui/` on source without helper failed with missing `applyConfirmedHistoryDelete` export, exit 1.
- **Final targeted GREEN:** `node --test src/api.test.ts src/lib/historyMessages.test.ts src/lib/sessionDelete.test.ts` passed **45/45** (0 failed/skipped) on Windows Node 22.22.0, including A→B→A, real mocked DELETE HTTP receipts, SSE-first assistant deletion, duplicate/reused source index and stable-ID/object-identity guards. Earlier 15/15 and 43/43 were intermediate candidate results; the independent reviewer initially found an Important double-delete race, subsequently corrected in this 45/45 source. `git diff --check` passed.
- **Pending:** independent strict read-only code/test review and `webui-quality` hosted job (locked npm ci, audit, typecheck, Node tests, production build) at exact fork SHA. Cross-platform packaged/browser DELETE smoke NOT YET VERIFIED.

## Risks and explicit exclusions

- If a valid DELETE is applied by the server while the user switches away, this slice prevents updating the *wrong currently visible session*, but it does **not** implement global cache revision/tombstone propagation to other tabs, or guarantee immediate canonical refresh when returning to the former view. That broader WebUI freshness protocol remains blocked by the maintainer contract decision.
- Native `resolve_target_message_index` still ignores existing `expected_message_id` on latest upstream beta; separate fork-native `e10185424d659b767c79e058c0e543627d17513e` addresses server-only authoritative IDs (CI 38308595144 PASS 5/5; portability 38308598977 PASS 6/6). This UI-only delete-receipt slice deliberately does **not** send new IDs before that enforcement is integrated.
- Existing assistant-turn vs. visible-row projection semantics, index/text ambiguity, concurrent native history RMW, per-session SSE after_seq namespace and unwatched cold GET freshness are **NOT** solved here.
- Historical assistant rows without a persisted `sourceIndex` are not optimistically removed after successful server deletion because the source target is ambiguous; the canonical refresh/freshness pathway remains a separate coordination item.
- The PR #30 log ownership/liveness design remains separate; do not change process/task cleanup, Rust, global temp, prompt/config, plugin or installer behavior.
- No upstream PR/comment/merge, release/tag/publish/install or WIP worktree cleanup without separate authorization.

## Delivery gates

1. Independent review against exact final source and these exclusions: must find no new Critical/Important.
2. Focused Node GREEN plus exact-SHA fork GitHub Actions CI coverage; never apply older-SHA CI to new code. WebUI-only scope does not require broad native Portability rerun.
3. One Conventional Commit with `Co-Authored-By: JeikCode <code@jeikcode.top>`, non-force fork branch push, verify remote HEAD. Submit upstream only if explicitly authorized and broader integration prerequisites are satisfied.
