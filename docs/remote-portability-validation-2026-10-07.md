# Remote portability: PR #9 và blocker push — 2026-10-07

## Remote và trạng thái trung thực

- Upstream `jeikl/JeikCode`: tài khoản `xuan2261` chỉ có READ; không push main upstream.
- Fork có quyền ghi: `xuan2261/JeikCode`, nhánh `cleanup-portability-20261007`.
- PR: https://github.com/jeikl/JeikCode/pull/9 . Không merge, không tạo tag/phát hành, không đổi origin/default branch.
- Dispatch fork ban đầu không hoạt động vì workflow chưa có trên default branch fork; CI thực chạy qua event PR ở upstream, không cần đổi default branch.
- Remote PR head: `9817a8e8b5a00bbe7e4f77d63fea9ca49465a870`.
- Run đã hoàn tất: https://github.com/jeikl/JeikCode/actions/runs/37652605955 . Kết luận **failure**, không gọi full matrix xanh.

| Job của cùng run/revision | Kết quả |
|---|---|
| Native Ubuntu | success |
| Native macOS | success |
| Native Windows | failure |
| Capabilities isolated features | success |
| WebUI locked validation | success |
| Summary gate | failure đúng thiết kế |

Windows expanded runtime fail ở background quick-failure assertion: exit code đúng nhưng stderr `boom` không xuất hiện trong snapshot terminal. Các run trước còn phát hiện Unix path identity, macOS root `/var`/`/private/var`, graph removal aliases, stale parse instrumentation, native fixtures và MCP golden fixture. Các lỗi đó đã được sửa bằng source/test cụ thể và xác nhận trong những job native/feature nói trên, không dùng skip để làm xanh. Một số run intermediate bị concurrency hủy khi push revision tiếp; không trộn các run đó làm bằng chứng full pass.

## Bản sửa chưa thể kiểm chứng remote

Commit local `9d279b8404d653e95029165d3bddc47ed5f47a2600`:
`fix(bash): drain background output before publishing terminal status`.

- Process có thể exit trước stdout/stderr reader append xong buffer.
- Đã chờ reader hoàn tất trước snapshot settle failure và thông báo terminal; giới hạn drain 2 giây rồi abort reader còn giữ inherited pipe.
- Không đổi settle default, không chờ process đang chạy vô hạn và không bỏ assertion stderr.
- Regression local: 4 test background đạt; 2 test delayed/inherited-pipe drain đạt. Reader task completion/lifecycle được review độc lập, không còn blocker mới trong phần drain đã review.
- Teaches `05_tools_and_timeouts.md` đồng bộ giới hạn output drain.
- Chưa push thành công nên không tuyên bố Windows remote đã được sửa/xanh.

## Blocker server

Actual `git push` fast-forward lên fork trả **remote Internal Server Error / remote rejected**. Đã xác minh ancestry, fetch branch, dry-run fast-forward và tài khoản vẫn có quyền ghi; không có remote commit cần overwrite. Đã retry có giới hạn 3 lần, vẫn thất bại. Không force push, không đổi credential, không dùng API để bypass receive hook/server failure.

Lệnh tiếp tục khi GitHub phục hồi:

```bash
git push https://github.com/xuan2261/JeikCode.git HEAD:refs/heads/cleanup-portability-20261007
gh run list --repo jeikl/JeikCode --workflow portability.yml --limit 5
```

Xác minh run có `headSha` đúng commit đã push; chỉ kết luận full matrix pass khi tất cả native/feature/WebUI/summary ở **cùng SHA** thành công. Báo cáo này có thể được commit riêng nhưng không nên kích hoạt thêm run trong lúc server push đang lỗi.

## Bảo toàn công việc

- Diff chưa commit daemon worktree giữ Git blob fingerprint `2da3d2d95c14479e868525c8f8a64bc3c6d0096f`; chat worktree sạch.
- Trong quá trình CI xuất hiện thay đổi ngoài phiên ở `crates/jeikcode-config/src/util.rs` (7 dòng thêm, 1 dòng xóa). Giữ nguyên, không stage/commit/reset hoặc ghi đè. Working tree vì vậy không sạch, nhưng bản sửa Bash/teaches của phiên đã commit.
- Logs/artifacts chỉ lưu local `.jeikcode/remote-ci/`; không track credential, npm tool binaries hoặc source temporary home.
- UNC thật vẫn chưa được chạy vì không có share được cấp; test opt-in không silent pass.

## Bước kế tiếp

1. Ưu tiên retry push commit drain khi GitHub phục hồi, theo dõi đầy đủ run cùng SHA và khép Windows failure trước merge PR.
2. Người duy trì review/merge PR #9 sau CI xanh; không tự phát hành cleanup.
3. Nếu có UNC root được cấp, chạy exact opt-in command trong `portability-ci.md`.
4. Chốt contract prefix/hot-reload trước sửa: giữ prefix khi không có thay đổi, explicit cache invalidation khi reload block, hay append-only update phải được quyết định rõ. Không đổi quy tắc dự án ngầm.
5. Sau đó chốt vai trò site/docs-site và chọn một lát WebUI nhỏ (dev proxy auth/WebSocket hoặc Chat search/CSS); không gộp refactor TUI/runtime lớn vào remediation CI.
