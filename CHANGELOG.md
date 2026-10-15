# Changelog

<!--
【发版标准模板 / Release Notes Standard Template】
发版时在此顶部追加版本块。格式严格要求：
1. 先写完整英文段落（English Section）；
2. 插入分割线 `---`；
3. 再写完整中文段落（Chinese Section）。
禁止中英混排。无需陈述底层技术机理与源码函数，直接列出清晰的更新内容、功能改进与修复项即可。

## vX.Y.Z (YYYY-MM-DD)

- **[Module/Category in English] Main summary sentence in English**:
  - Detailed feature update or bug fix description...
  - Detailed feature update or bug fix description...

---

- **[模块分类中文] 中文概述主标题**:
  - 具体新增功能或体验优化说明...
  - 具体缺陷修复与行为改善说明...
-->

## v7.2.5-beta.1 (2026-10-15)

- **[Rendering] Prevent blockquote code blocks and quoted closures from swallowing document headings**:
  - Code fences inside Markdown blockquotes and code blocks closed with quote prefixes (such as `> ``` `) now close accurately across both streaming responses and static message renders.
  - Subsequent headings, horizontal rules, and document sections are no longer swallowed into open code blocks.
  - Streaming unclosed code blocks automatically heal when encountering distinct document outline headings.
- **[Capabilities] Isolate shell environment detection from terminal foreground process group**:
  - Login shell environment probe now safely preserves terminal process group ownership, preventing CLI input hangs.

---

- **[渲染] 修复引用块内代码块及带引用闭合标记吞噬后续大纲标题与正文的问题**:
  - Markdown 引用块内部的代码块以及带有引用前缀（如 `> ``` `）的闭合标记，无论在实时流式推送还是静态消息渲染中均能精准识别并正常闭合。
  - 代码块后的分割线、大纲标题与正文内容不再被反向吞入代码块。
  - 遇到模型漏关代码块并输出明确文档大纲标题时，自动触发结构性终结自愈。
- **[运行时] 修复登录 shell 环境探测篡夺终端前台进程组导致输入卡死的问题**:
  - 探测用户登录 shell 环境变量时安全保留终端前台进程组所有权，彻底避免命令行交互卡死。

## v7.2.4 (2026-10-14)

- **[Updates] Desktop, a remote browser, and a headless CLI share one update flow**:
  - All three can install another version or roll back. In the desktop app or WebUI, use the update control at the top right. When the update finishes, the page reloads onto the new version. Clicking Finish and waiting do the same thing.
  - Release notes open for the selected version. The history lists every version on that channel, newest first. Force Update stays only when the running build is already that latest version.
  - An in-place upgrade replaces the running program and restarts the same service, including the access token. If the new process cannot start, the old one keeps serving.
  - The desktop window opens sooner. The service still listens on 0.0.0.0, so other devices can reach it with the same port and token.

- **[CLI] List, install, and roll back a version**:
  - `jeikcode list` and `jeikcode list main` show stable history. `jeikcode list beta` shows beta history.
  - `up`, `update`, and `upgrade` install a newer build. `up main` and `up beta` choose the channel, and a version after them installs that release. `down main` and `down beta` install a specific or older release. `rollback` returns to the previous program kept on disk. `-y` applies configuration changes without a prompt, including on a headless server.
  - Tutorial: https://jeikcode.top/guide/updates.html

- **[Uninstall] A guided removal, or a prompt-free removal for scripts**:
  - `jeikcode uninstall` asks whether to keep user configuration. The program and its PATH entry are always removed.
  - `jeikcode uninstall simple` removes only the program and keeps configuration. `jeikcode uninstall all` removes both. Neither command asks a question.
  - Prompts follow Simplified Chinese, English, or Vietnamese. Windows, macOS, Linux, and HarmonyOS PC use the same commands.
  - Tutorial: https://jeikcode.top/guide/updates.html

- **[Long tasks] Five-stage waits, shell commands, and cards that stay open**:
  - A long model reply is watched in five stages: connecting, waiting for the response to begin, waiting for the first token, waiting for text or a tool after thinking, and gaps between later tokens.
  - When the model returns only thinking, with no reply text and no tool call, the first retry is immediate. Later retries wait, up to five times.
  - Quiet shell waits such as `sleep` run until they finish or reach the 30-minute cap. On macOS those waits are no longer stopped for a model decision.
  - `git log`, `git show`, `git diff`, and similar output commands are allowed, including `-p` and `-i`. Truly interactive git commands such as `git add -p` and `git rebase -i` stay blocked.
  - An approval card and a question card stay until you answer or stop the turn.

- **[API] Conversations stay in the directory where the server started**:
  - OpenAI and Anthropic endpoints keep using the directory where `jeikcode serve` was started. Switching projects in the sidebar no longer moves those sessions.
  - New Chat creates a session in the current workspace. Hiding or showing a project stays in sync across tabs and desktop windows.

---

- **[更新] 桌面版、异地浏览器和无头命令行共用一套更新**:
  - 这三种环境都可以安装其他版本或回退。桌面版和 WebUI 点击右上角更新。更新完成后页面自动刷新到新版本。点「完成」和继续等待是同一行为。
  - 可以打开所选版本的更新说明。历史列表按通道列出全部版本，最新在前。仅当正在运行的版本已是该最新版时，才显示「强制更新」。
  - 就地升级会替换正在运行的程序并重启同一服务，访问 token 保持不变。新进程无法启动时，旧进程继续提供服务。
  - 桌面窗口打开更快。服务仍监听 0.0.0.0，其他设备仍可用同一端口和 token 访问。

- **[命令行] 查看、安装和回退版本**:
  - 更新命令更加完善：`jeikcode list` 与 `jeikcode list main` 列出正式版，`jeikcode list beta` 列出测试版。`up`、`update`、`upgrade` 安装较新版本。`up main` 与 `up beta` 选择通道，后面可跟版本号。`down main` 与 `down beta` 安装指定或更旧的版本。`rollback` 回到磁盘上的上一版。`-y` 不询问直接应用配置变更，无头服务器同样可用。
  - 详细教程：https://jeikcode.top/zh/guide/updates.html

- **[卸载] 交互引导，或给脚本用的无提问卸载**:
  - `jeikcode uninstall` 询问是否保留用户配置。程序和 PATH 项一定会移除。
  - `jeikcode uninstall simple` 只删除程序并保留配置。`jeikcode uninstall all` 两者都删除。这两条命令都不提问。
  - 提示跟随简体中文、英文或越南文。Windows、macOS、Linux、HarmonyOS PC 使用同一套命令。
  - 详细教程：https://jeikcode.top/zh/guide/updates.html

- **[长任务] 五阶段等待、终端命令，以及一直留着的卡片**:
  - 较长的模型回复按五个阶段观察：建立连接、等待响应开始、等待第一个 token、思考之后等待正文或工具，以及后续 token 之间的间隔。
  - 模型只返回思考、没有正文也没有工具时，第一次立即重试。之后的重试才等待，最多 5 次。
  - `sleep` 这类安静等待会一直跑到结束，或达到 30 分钟上限。在 macOS 上，这类等待不再交给模型决定是否停掉。
  - `git log`、`git show`、`git diff` 以及同类输出命令可以运行，包括 `-p` 和 `-i`。`git add -p`、`git rebase -i` 这类真正的交互命令仍然拦截。
  - 审批卡和提问卡会留到你作答或停止这一回合。

- **[API] 对话留在服务启动时的目录**:
  - OpenAI 与 Anthropic 端点继续使用 `jeikcode serve` 启动时所在目录。侧栏切换项目不再把这些会话送走。
  - 「新建对话」在当前工作区创建会话。项目的隐藏和显示会在多个标签页和桌面窗口之间保持同步。

## v7.2.4-beta.13 (2026-10-14)

- **[Updates] Desktop, a remote browser, and a headless CLI share one update flow**:
  - All three can install another version or roll back. In the desktop app or WebUI, use the update control at the top right. When the update finishes, the page reloads onto the new version. Clicking Finish and waiting do the same thing.
  - Release notes open for the selected version. The history lists every version on that channel, newest first. Force Update stays only when the running build is already that latest version.
  - An in-place upgrade replaces the running program and restarts the same service, including the access token. If the new process cannot start, the old one keeps serving.
  - The desktop window opens sooner. The service still listens on 0.0.0.0, so other devices can reach it with the same port and token.

- **[CLI] List, install, and roll back a version**:
  - `jeikcode list` and `jeikcode list main` show stable history. `jeikcode list beta` shows beta history.
  - `up`, `update`, and `upgrade` install a newer build. `up main` and `up beta` choose the channel, and a version after them installs that release. `down main` and `down beta` install a specific or older release. `rollback` returns to the previous program kept on disk. `-y` applies configuration changes without a prompt, including on a headless server.
  - Tutorial: https://jeikcode.top/guide/updates.html

- **[Uninstall] A guided removal, or a prompt-free removal for scripts**:
  - `jeikcode uninstall` asks whether to keep user configuration. The program and its PATH entry are always removed.
  - `jeikcode uninstall simple` removes only the program and keeps configuration. `jeikcode uninstall all` removes both. Neither command asks a question.
  - Prompts follow Simplified Chinese, English, or Vietnamese. Windows, macOS, Linux, and HarmonyOS PC use the same commands.
  - Tutorial: https://jeikcode.top/guide/updates.html

- **[Long tasks] Five-stage waits, shell commands, and cards that stay open**:
  - A long model reply is watched in five stages: connecting, waiting for the response to begin, waiting for the first token, waiting for text or a tool after thinking, and gaps between later tokens.
  - When the model returns only thinking, with no reply text and no tool call, the first retry is immediate. Later retries wait, up to five times.
  - Quiet shell waits such as `sleep` run until they finish or reach the 30-minute cap. On macOS those waits are no longer stopped for a model decision.
  - `git log`, `git show`, `git diff`, and similar output commands are allowed, including `-p` and `-i`. Truly interactive git commands such as `git add -p` and `git rebase -i` stay blocked.
  - An approval card and a question card stay until you answer or stop the turn.

- **[API] Conversations stay in the directory where the server started**:
  - OpenAI and Anthropic endpoints keep using the directory where `jeikcode serve` was started. Switching projects in the sidebar no longer moves those sessions.
  - New Chat creates a session in the current workspace. Hiding or showing a project stays in sync across tabs and desktop windows.

---

- **[更新] 桌面版、异地浏览器和无头命令行共用一套更新**:
  - 这三种环境都可以安装其他版本或回退。桌面版和 WebUI 点击右上角更新。更新完成后页面自动刷新到新版本。点「完成」和继续等待是同一行为。
  - 可以打开所选版本的更新说明。历史列表按通道列出全部版本，最新在前。仅当正在运行的版本已是该最新版时，才显示「强制更新」。
  - 就地升级会替换正在运行的程序并重启同一服务，访问 token 保持不变。新进程无法启动时，旧进程继续提供服务。
  - 桌面窗口打开更快。服务仍监听 0.0.0.0，其他设备仍可用同一端口和 token 访问。

- **[命令行] 查看、安装和回退版本**:
  - 更新命令更加完善：`jeikcode list` 与 `jeikcode list main` 列出正式版，`jeikcode list beta` 列出测试版。`up`、`update`、`upgrade` 安装较新版本。`up main` 与 `up beta` 选择通道，后面可跟版本号。`down main` 与 `down beta` 安装指定或更旧的版本。`rollback` 回到磁盘上的上一版。`-y` 不询问直接应用配置变更，无头服务器同样可用。
  - 详细教程：https://jeikcode.top/zh/guide/updates.html

- **[卸载] 交互引导，或给脚本用的无提问卸载**:
  - `jeikcode uninstall` 询问是否保留用户配置。程序和 PATH 项一定会移除。
  - `jeikcode uninstall simple` 只删除程序并保留配置。`jeikcode uninstall all` 两者都删除。这两条命令都不提问。
  - 提示跟随简体中文、英文或越南文。Windows、macOS、Linux、HarmonyOS PC 使用同一套命令。
  - 详细教程：https://jeikcode.top/zh/guide/updates.html

- **[长任务] 五阶段等待、终端命令，以及一直留着的卡片**:
  - 较长的模型回复按五个阶段观察：建立连接、等待响应开始、等待第一个 token、思考之后等待正文或工具，以及后续 token 之间的间隔。
  - 模型只返回思考、没有正文也没有工具时，第一次立即重试。之后的重试才等待，最多 5 次。
  - `sleep` 这类安静等待会一直跑到结束，或达到 30 分钟上限。在 macOS 上，这类等待不再交给模型决定是否停掉。
  - `git log`、`git show`、`git diff` 以及同类输出命令可以运行，包括 `-p` 和 `-i`。`git add -p`、`git rebase -i` 这类真正的交互命令仍然拦截。
  - 审批卡和提问卡会留到你作答或停止这一回合。

- **[API] 对话留在服务启动时的目录**:
  - OpenAI 与 Anthropic 端点继续使用 `jeikcode serve` 启动时所在目录。侧栏切换项目不再把这些会话送走。
  - 「新建对话」在当前工作区创建会话。项目的隐藏和显示会在多个标签页和桌面窗口之间保持同步。

## v7.2.4-beta.12 (2026-10-14)

- **[Updates] Finish lands on the new version**:
  - Clicking Finish and waiting after an update both reload the page once the new build is serving. The version in the sidebar updates with that reload.

- **[Prompts] Approval and question cards wait**:
  - An approval card and a question card stay until you answer or stop the turn. Leaving them open no longer auto-denies the tool, picks an answer, or tells the model that no answer was provided.

---

- **[更新] 完成后进入新版本**:
  - 更新结束后，点「完成」和继续等待都会在新版本已经可访问时刷新页面。侧栏版本号随这次刷新更新。

- **[提问] 审批卡和提问卡一直等待**:
  - 审批卡和提问卡会留到你作答或停止这一回合。放着不点不再自动拒绝、自动选一项，也不会告诉模型没有答案。

## v7.2.4-beta.11 (2026-10-14)

- **[Updates] Notes, restart, and desktop startup**:
  - Release notes still show when the edge list has versions but empty text. The history dropdown no longer adds a latest suffix; the first row is the latest.
  - After an update restarts, Finish opens the new version. Waiting for the restart no longer leaves the page loading as if it were signed out, or stuck on Updating.
  - The desktop splash shows Jeikcode, a spinning mark, and Starting.
  - The desktop window opens sooner. The service still listens on 0.0.0.0, so other devices can reach it with the same port and token.

---

- **[更新] 更新说明、重启后的页面和桌面启动**:
  - 边缘列表有版本但正文为空时，更新说明仍会显示。历史下拉不再附加「最新」，第一项就是最新版。
  - 更新重启后，点「完成」进入新版本。不等待完成时，页面不再像未登录一样停在加载中，也不会卡在「正在更新」。
  - 桌面启动页显示 Jeikcode、转圈图标和 Starting。
  - 桌面窗口打开更快。服务仍监听 0.0.0.0，其他设备仍可用同一端口和 token 访问。

## v7.2.4-beta.10 (2026-10-14)

- **[Updates] Channel history and release notes**:
  - The update dialog lists every version on the selected channel, newest first. Force Update stays only when that latest matches the running version. Choosing another version installs it with Update Now.
  - Release notes for the selected version open in a dialog, with copy, on desktop and phone, in light and dark.
  - `jeikcode list` shows stable history. `jeikcode list beta` shows beta history. `update` and `up` work like `upgrade`. `jeikcode up main|beta [version]` and `jeikcode down main|beta <version>` install a specific version. `-y` still auto-applies config diffs.
  - Version lists and notes come from jeikcode.top. A check does not call the GitHub API when that edge list is already available.

---

- **[更新] 通道历史版本与更新说明**:
  - 更新对话框按所选通道列出全部历史版本，最新在前。仅当该最新版等于当前版本时仍显示「强制更新」。选择其他版本则按「立即更新」安装。
  - 所选版本的更新说明在弹窗中打开，支持复制，手机和电脑、亮色和暗色都可用。
  - `jeikcode list` 显示正式版历史。`jeikcode list beta` 显示测试版历史。`update` 与 `up` 和 `upgrade` 相同。`jeikcode up main|beta [version]` 与 `jeikcode down main|beta <version>` 安装指定版本。`-y` 仍自动应用配置差异。
  - 版本列表和更新说明来自 jeikcode.top。边缘列表已经返回时，检查更新不会再请求 GitHub API。

## v7.2.4-beta.9 (2026-10-14)

- **[Updates] Force reinstall and dual-copy CLI swap**:
  - When the channel latest equals the running version, the WebUI button becomes Force Update (zh / en / vi) and re-downloads the binary. A newer latest still shows Update Now.
  - An in-place upgrade replaces the running binary, `~/.local/bin`, PATH copies, and the desktop bundled `cli-bin`, then restarts with the original argv so `--token` stays the same.
  - Desktop launch keeps a newer `~/.local/bin` instead of copying an older installer resource over it.

---

- **[更新] 强制更新与双份 CLI 替换**:
  - 当前版本与通道最新版相同时，WebUI 按钮变为「强制更新」（中/英/越）并重新下载二进制。有更新版本时仍显示「立即更新」。
  - 就地升级会替换正在运行的二进制、`~/.local/bin`、PATH 副本以及桌面安装包里的 `cli-bin`，然后用原 argv 重启，带 `--token` 时秘钥保持不变。
  - 桌面启动时若 `~/.local/bin` 更新，不再用安装包里的旧资源盖回去。

## v7.2.4-beta.8 (2026-10-14)

- **[Updates] In-place upgrade no longer kills remote WebUI**:
  - After replacing the binary, a detached successor waits for the old process to exit and then binds the same port. Windows no longer uses a `cmd` helper that died with the parent.
  - If the successor cannot start, the old process keeps serving so a remote browser is not left with connection refused.

---

- **[更新] 就地升级不再把异地 WebUI 杀停**:
  - 替换二进制后，脱离的后继进程会等旧进程退出再绑定同一端口。Windows 不再使用会随父进程一起退出的 `cmd` 助手。
  - 后继进程拉不起来时，旧进程继续提供服务，避免异地浏览器刷出「无法访问」。

## v7.2.4-beta.7 (2026-10-14)

- **[Agent Shell] Quiet waits finish on macOS**:
  - After output, a silent `sleep` or delay script keeps running until it exits. macOS cannot sample CPU, so those waits no longer pause for a model decision.

---

- **[Agent 终端] macOS 上安静等待可以跑完**:
  - 已有输出后的 `sleep` 或延迟脚本会一直跑到自己结束。macOS 无法采样 CPU，这类等待不再弹出要模型决定是否停掉的提示。

## v7.2.4-beta.6 (2026-10-13)

- **[Updates] Beta channel and remote in-place upgrades**:
  - `jeikcode upgrade beta -y` and `--beta` install the latest prerelease. `--main` and omitting the channel stay on stable. `-y` still auto-applies config diffs.
  - The WebUI update button (including remote browsers) replaces the running `jeikcode` binary in place and restarts the service. It no longer opens a host-side installer wizard. The page reloads after the swap.

---

- **[更新] Beta 通道与异地就地升级**:
  - `jeikcode upgrade beta -y` 与 `--beta` 安装最新预发布版。`--main` 和不填通道仍走正式版。`-y` 仍自动应用配置差异。
  - WebUI 更新按钮（含异地浏览器）就地替换正在运行的 `jeikcode` 并重启服务，不再在宿主机上打开安装向导。替换完成后页面自动刷新。

## v7.2.4-beta.5 (2026-10-13)

- **[Agent Shell] Silent delay tasks finish; git log -p is allowed**:
  - Sleep and other quiet waits keep running until they complete or hit the 30-minute hard cap. Every 60 seconds the shell only rechecks: pagers, REPLs, full-screen TUIs, and foreground servers are still stopped.
  - `git log -p`, `git show -p`, `git diff -p`, and `git log -i` / `git grep -i` run as normal output commands. Interactive git such as `git add -p` and `git rebase -i` remains blocked.
- **[Protocol API & WebUI] Conversations stay in the serve workspace**:
  - OpenAI Chat Completions, Responses, and Anthropic endpoints keep using the directory where `jeikcode serve --host --port` was started. Switching projects in the sidebar no longer moves those sessions into the first project.
  - The top New Chat button creates a session in the current workspace.

---

- **[Agent 终端] 安静等待任务可以跑完；git log -p 不再被拦截**:
  - `sleep` 以及没有输出的延迟脚本会一直跑到自己结束，或达到 30 分钟硬顶。每 60 秒只做体检：pager、REPL、全屏 TUI 和前台常驻服务仍会终止。
  - `git log -p`、`git show -p`、`git diff -p` 以及 `git log -i` / `git grep -i` 按普通输出命令放行。`git add -p`、`git rebase -i` 等真正交互命令继续拦截。
- **[协议 API 与 WebUI] 对话留在启动工作区**:
  - OpenAI Chat Completions、Responses、Anthropic 端点继续使用 `jeikcode serve --host --port` 启动时所在目录。侧栏切换项目不再把这些会话送进第一个项目。
  - 顶部「新建对话」在当前工作区创建会话。

## v7.2.4-beta.4 (2026-10-13)

- **[Liveness & Stream Timeout Architecture] Three-phase timeout policy, thinking stall detection, and retry hardening**:
  - Refactored stream liveness monitoring with a unified `TimeoutPolicy` covering first-token arrival (default 180s), inter-token idle bounds, and transport timeouts.
  - Added dedicated detection for thinking-only output stalls, presenting clear user diagnostics when models emit reasoning without generating subsequent text or tool calls across retries.
  - Standardized timeout propagation across all provider integrations (Anthropic, Gemini, Ollama, OpenAI-compatible, and Responses).
- **[Sidebar Projects Synchronization & Real-time State] Event-driven project visibility across instances**:
  - Implemented `sidebar_projects` event broadcasting over the global SSE bus, keeping project hide and reveal states synchronized across all tabs and desktop windows.
  - Optimized pending hide/reveal state tracking to prevent race conditions during rapid project visibility changes.
- **[Documentation & Presets] Synchronized timeout configuration guides**:
  - Updated tool and timeout documentation alongside default configuration templates to reflect the updated timeout structure.

---

- **[保活监控与流式超时架构] 三阶段流式超时策略、纯思考卡死检测与重试加固**:
  - 重构模型流式连接与保活超时架构，引入统一的 `TimeoutPolicy`，涵盖首字到达超时（默认 180 秒）、分块闲置与传输层超时控制。
  - 针对大模型仅输出深度思考却未生成正文或工具调用的停滞卡死场景提供专用检测与清晰的排障指引。
  - 在全系提供商接入（Anthropic、Gemini、Ollama、OpenAI 兼容协议、Responses）中统一步调与超时参数传递。
- **[侧栏项目实时同步与状态收敛] 跨实例多窗口项目显示状态即时协同**:
  - 通过全局事件总线广播 `sidebar_projects` 变更，实现多标签页与桌面端窗口之间项目隐藏与显示状态的毫秒级同步。
  - 优化隐藏与展示状态的竞态防护，防止快速切换项目时状态不一致或幽灵项目残留。
- **[文档与配置预设同步] 更新超时配置指南与默认模版**:
  - 同步更新工具与超时指南文档，并在全仓默认配置文件模版中补齐最新超时架构定义。

## v7.2.3 (2026-10-13)

- **[WebUI Live Streaming & Content Integrity] Eliminate live stream truncation, missing background code blocks, and sequential reasoning display**:
  - Fixed an issue where repeated URLs, common domain prefixes (`https://github.com`), or repeated code identifiers were erroneously truncated during live LLM streaming.
  - Substring deduplication is now strictly isolated to replay frames, with real-time stream deltas appended reliably via monotonic sequence cursors.
  - Fixed missing Markdown code blocks and Mermaid diagrams when switching back to a session that completed in the background by properly buffering `artifact_*` events in the background session cache.
  - Resolved steer card state desync, stuck queues, and ghost duplicate bubbles during cross-session switching by folding steered inputs into target session caches.
  - Fixed an issue where successive reasoning / thinking blocks across tool boundaries were improperly coalesced into the initial block; subsequent thinking blocks now render cleanly in sequential order.
  - Introduced live `Compacting...` shimmer placeholder synchronized across all tabs and instances when background context compaction is underway.
  - Restored context compaction notices (`format_compaction_mark`) in the native live architecture, rendering amber advisories in-stream as ordered notice parts.
  - Added official GitHub badge to the sidebar footer with `config.toml` toggle and `jeikcode ghimg [on|off]` live hot-reloading CLI.
  - Refined ambiguous match error messages in the edit tool from Rust range syntax to clear 1-based index instructions (`1 to N`).
  - Eliminated contradictory "not applied" diff banner on successfully completed file edits.
- **[Task List Lifecycle & Workspace Stability] Fix premature checklist clearing and synchronize persona rules**:
  - Fixed premature clearing of active in-progress checklists in `apply_actions_batch` when appending multiple new tasks alongside existing status updates.
  - Aligned checklist auto-clearing lifecycle to trigger strictly upon terminal turn completion via `LifecycleHooks::turn_complete` when all tasks are finished.
  - Streamlined `<todo_rules>` persona guidelines with concise terminal-clearing timing and "Do not proactively remove or clear task items" guard.
- **[WebUI Modern Modals, Toast System & Git Controls] Modern theme-adaptive dialogs, VSCode-style discard all, and page zoom**:
  - Replaced all legacy browser dialogs (`window.confirm`, `window.alert`, `window.prompt`) featuring `127.0.0.1:port` popups with beautiful, theme-adaptive modals and floating toast capsules matching light and dark themes.
  - Added a dedicated "Discard All Changes" (`↺`) action in GitPanel unstaged changes header with secondary confirmation and full i18n support matching VSCode workflow.
  - Replaced file discard, branch deletion, merge, revert, and cherry-pick native popups with responsive modern confirm modals.
  - Implemented Chrome-like `Ctrl + Mouse Wheel` (and `Ctrl + +/-/0`) page zoom scaling with persistent zoom levels in `localStorage` and a floating percentage indicator pill.
- **[Update Relay & Release Infrastructure] Zero-rate-limit Cloudflare edge relay and streamlined release matrices**:
  - Deployed an official Cloudflare Pages edge function (`/api/releases`) with Atom feed parsing and 70s edge caching, eliminating GitHub API 60 req/hr rate limits for overseas VPN and proxy users.
  - Release installer links now connect directly to downloadable binaries (Windows `.exe`, macOS `.dmg`, Linux `.deb`/`.AppImage`), completely removing obsolete `.rpm` references.
  - Streamlined desktop release and portability test matrices, preserving 100% of headless CLI builds across x86_64 and ARM64.
- **[Documentation & Portal Experience] Dual-channel version indicators and clean quickstart guides**:
  - The documentation homepage now presents independent Stable and Beta version badges linked directly to respective releases.
  - Unified Quick Start and Documentation navigation across all README files with direct links to the official portal (`jeikcode.top`).

---

- **[WebUI 实时流式传输与内容完整度] 彻底根除实时流式吞字、后台代码块丢失、思考块倒流叠加与压缩状态同步**:
  - 修复大模型流式输出过程中因误判重复帧导致连续相同 URL、域名公共前缀（`https://github.com`）或重复代码标识符被吞字残缺的问题。
  - 所有子串级去重严格隔离在重放分支，实时流式输出完全依赖单调递增游标可靠就地追加。
  - 修复在后台会话生成 Markdown 或 Mermaid 图表时切回会话出现内容缺失的缺陷，将 `artifact_*` 代码块事件全量实时同步至后台会话缓存。
  - 解决跨会话切换时 steer 转向卡片未能及时出队、状态卡死或重现双份气泡的缓存脱节缺陷，使后台转向与正文状态单调对齐。
  - 彻底根治连续多个思考块跨越工具调用时被异常倒灌、错误叠加进第一个思考块的问题，使思考块严格按照产生时序独立渲染。
  - 引入全实例全局同步的 `Compacting...` 流光状态，在上下文压缩提炼请求发送与执行期间为各端实时展示平滑过渡提示。
  - 修复全新 Live 架构下上下文压缩通知（`Compacted`）被吞未发送的缺陷，将压缩与异常提示作为独立顺序部件在画布中端正渲染黄色警告条。
  - 在侧栏底部新增官方 GitHub 仓库徽章，支持 `config.toml` 配置与 `jeikcode ghimg [on|off]` 命令行实时免重启热重载切换。
  - 优化 edit 工具多处歧义匹配时的报错指引，由 Rust 区间语法改为通俗清晰的 1-based 序号提示（`1 to N`）。
  - 消除文件编辑成功（已完成）时因行数截断误报“预期替换（未写入，仅供参考）”的语义矛盾。
- **[任务清单生命周期与全目标编译修复] 修复待办列表早熟清空缺陷、精简提示词与 CI 编译全绿**:
  - 彻底修复 `apply_actions_batch` 在向进行中清单追加多个新任务时因 `add_count >= 2` 误判导致列表被暴力清空的重大缺陷，保持任务 ID 连续性。
  - 将任务清单自动清空时机严格绑定至终态回复完成（`LifecycleHooks::turn_complete`），仅在所有任务全部完成时才自动归档清空。
  - 精简 `<todo_rules>` 人设提示词，去除冗余修饰，严格对齐终态清空与“不主动删除任务项”安全法则。
- **[WebUI 现代主题提示框、全局 Toast 与 Git 撤销控制] 告别老旧浏览器原生弹窗、VSCode 风格放弃全部更改与滚轮缩放**:
  - 全面替换所有带有 `127.0.0.1:port` 的老旧浏览器原生弹窗（`window.confirm`、`window.alert`、`window.prompt`），升级为完美适配亮色与暗色模式的现代卡片式 `ConfirmDialog` 与磨砂胶囊 `Toast`。
  - 在 GitPanel 代码更改标题栏新增 VSCode 风格的“放弃所有更改”（`↺` 拐弯撤销图标）按钮，配备二次确认保护弹窗与全套多语言适配。
  - 将单文件修改放弃、分支删除、分支合并、提交回滚（Revert）与拣选（Cherry-pick）全部接入现代确认弹窗。
  - 引入仿 Google Chrome 的 `Ctrl + 鼠标滚轮`（以及 `Ctrl + +/-/0`）页面缩放能力，支持 50%~300% 步进调节、`localStorage` 持久化记忆与右上角实时百分比气泡展示。
  - 深度优化移动端与窄窗口自适应布局，确保弹窗自适应视口宽度、居中展示且无任何横向溢出。
- **[更新中继与发布工程基建] Cloudflare 边缘零限流发布中继与发布矩阵瘦身**:
  - 部署官方 Cloudflare Pages 边缘服务（`/api/releases`），通过 Atom 订阅流拉取元数据并执行 70 秒全球 CDN 缓存，彻底终结 GitHub API 60次/小时导致的海外 VPN 与代理出口 IP 限流。
  - Release 说明下载表格直接提供 Windows `.exe`、macOS `.dmg`、Linux `.deb`/`.AppImage` 安装包直链下载，并彻底移除无用的 `.rpm` 格式。
  - 精简桌面安装包与跨平台兼容性测试矩阵，同时 100% 完整保留 x86_64 与 ARM64 无头设备 CLI 核心产物。
- **[文档中心与门户体验] 官网首页双版本指示器与精简上手指南**:
  - 官网首页并排展示独立的正式版（Stable）与测试版（Beta）版本胶囊，支持动态数据获取与 bump 脚本双兜底同步。
  - 全面精简中英双语 README，收揽统一为“快速上手与官方文档”，核心教程与高级指南统一收拢至官方文档站点（`jeikcode.top`）。

## v7.2.2 (2026-10-12)

- **[Chat Streaming & Session Continuity] Single event bus, resumable cursors, and idempotent rendering across refresh, switching, and multi-instance viewing**:
  - Cache performance and canvas data consistency are comprehensively improved, preventing duplicate replays, message rendering misalignment, and related issues.
  - All chat streaming now flows through one broadcast event bus triggered by a stateless `/chat` RPC; the legacy replay machinery is retired.
  - Monotonic session cursors let reconnects resume exactly where they left off — refreshing, blurring, or switching sessions never duplicates or loses prompts, thinking, or answers.
  - Fixed multi-round output after tool calls, mid-stream thinking/answer fragmentation, and the disappearance of the latest prompt after refresh; repeated replays render strictly idempotently.
  - Stable message/part identities span kernel, daemon, and WebUI, backed by a cross-instance incremental event channel for live multi-tab and multi-device synchronization.
  - Session streams are isolated per session; warm switching reconciles settled disk state automatically; sidebar running indicators self-heal and reconnect loop storms are eliminated.

- **[Chat History & Interaction] Inline editing, rollback & regeneration, reliable steering, and precise stop controls**:
  - History bubbles support inline editing with multi-image drop-back: "Rewrite History" (in-place, no regeneration) and "Rollback & Submit" (branch a fresh generation), plus per-turn temporary model overrides; assistant replies gain "Regenerate" and "Delete".
  - All history mutations are atomic on disk and broadcast differentially to every open tab.
  - Steer cards survive refresh and cancellation clears the kernel buffer; the turn clock resumes real elapsed time after reconnects.
  - "Send now" reliably stops the running turn and delivers immediately; stop waits for real release without arbitrary timeouts; 409 conflicts fold back into the queue gracefully; the stop button responds instantly with an anti-bounce guard.

- **[Performance & Cold Start] Instant first paint, tiered caching, and zero idle polling**:
  - A two-tier session cache (memory + IndexedDB) with idle prefetch restores the full canvas instantly after refresh — including question outline, todo checklist, and token usage.
  - Embedded assets use tiered HTTP cache headers; heavy panels are lazy-loaded (main bundle reduced by over 70 kB) and non-critical startup checks are deferred.
  - Aggressive background polling (500 ms – 5 s timers) is eliminated in favor of event-driven updates, with a manual model refresh button; idle network traffic drops to zero.

- **[WebUI Experience & Visual Polish] Git panel, canvas search, Mermaid, Markdown, media, and theming**:
  - Git panel rebuilt with a project-level single-flight cache, commit-graph caching bound to HEAD, and DOM keep-alive — background Git processes cut from ~11 to 2; Chinese filenames and branch switching are fixed.
  - Canvas Ctrl+F searches the entire conversation with smooth centered navigation; the question outline anchors correctly; auto-follow respects manual browsing.
  - Mermaid diagrams no longer vanish (hydration crash fixed, flowchart labels preserved, nested fences handled) with a simplified toolbar; streaming Markdown fences, headings, and lists render without fragmentation.
  - Image uploads up to 8 MB with aspect-ratio-preserving transcoding; composer input recall with ↑/↓; mobile layout fixes; eye-care light palette and circular power-switch controls.
  - TUIx: legacy `list` action support, mid-stream `/clear` and `/new`, and `read` tool detail formatting.

- **[Background Processes & Terminal Runtime] Resident services decoupled from turns, live logs, and native PIDs**:
  - Detached background services now survive turn completion, user stops, refreshes, and session switches — terminated only by explicit kill, session deletion, or host exit.
  - Background output streams to OS temp log files with tail-read guidance; session-scoped log pools roll with LRU cleanup.
  - Virtual IDs are retired end to end: registries, cancellation, and status hooks all use native OS PIDs.
  - Git-Bash/MSYS reliability on Windows: paths and environment normalized (`$TMPDIR` / `$DESKTOP`), real background PIDs reported, mixed-encoding output decoded, interactive commands fail fast instead of hanging, and pipes are drained on exit.

- **[Tools, Editing & Code Intelligence] Compressed outputs with retrieval handles, canonical tool names, and hardened editing**:
  - Oversized tool outputs are uniformly compressed and carry an artifact handle for full retrieval; terminal outputs get a dedicated configurable threshold.
  - Tool names converge on canonical `read` / `write` / `edit` / `run_command` across the stack with legacy aliases still accepted; worker scope gates recognize modern calls.
  - Edit tool: lossy-recovery rejection, a 50% similarity gate with cross-file hints, richer mismatch diagnostics, and unambiguous errors for conflicting options.
  - grep tolerates bare braces and falls back gracefully on missing paths; Windows path normalization hardened (verbatim UNC casing, multibyte path slicing).
  - Directory pickers modernized (native Windows dialog + built-in web explorer for remote sessions); Python venv launcher context preserved on Windows.
  - Subagents gain `code_explore` plus lenient task dispatch with aliases and error self-healing; the todo `list` action becomes first-class.

- **[Kernel, Context & Prompts] Watermark budgeting, persona architecture, and workflow discipline**:
  - Context budgeting now uses a safety watermark — no more "warns every turn but never compacts" confusion — with model tier presets (32K–384K plus custom) in the editor.
  - The system persona is reorganized into a four-block architecture with a dedicated explore strategy; prompts align to a modern structured workflow (todo rules, task-scope awareness); noisy dynamic turn-start reminders are retired.
  - Prompt/persona baselines resolve reliably so built-in safeguards are never silently dropped; MCP child processes are reclaimed deterministically; home/config resolution is unified to a single source.

- **[MCP, Skills & Capabilities] One capability surface with hot reload**:
  - MCP servers and skills share a unified GLOBAL/PROJECT capability state with hot reload; capability switches are the single authority and project trust is confirmed silently.

- **[Networking & Remote Access] IPv6 dual-stack support**:
  - WebUI binds IPv6 alongside IPv4 with shareable-address ranking and RFC-compliant bracketed URLs; the remote access panel surfaces IPv6 addresses across platforms.

- **[Security & Dependencies] Hardened dependency chains and path guards**:
  - Vulnerable WebUI dependency chains removed and `npm audit` gated in CI; Mermaid output sanitized before injection; `code_explore` honors the sensitive-path gate; credential files are excluded from the code graph via a dedicated ignore list.

- **[Internationalization, Desktop & VSCode]**:
  - Full Vietnamese localization across WebUI, TUIx, daemon, desktop startup, and the VSCode extension, with three-tier OS locale detection.
  - Desktop startup status localized (EN/ZH/VI); accessibility labels and native terminal guidance localized; VSCode extension receives an updated icon and packaging fixes.

- **[CI, Release Pipeline & Engineering]**:
  - The release pipeline is rebuilt as a fully parallel per-architecture matrix with global Rust caching, nearly halving critical-path build time; temporary release watchers are removed.
  - The portability workflow runs native and subset cross-platform suites; the TUI library suite is gated in CI; the all-features suite is made hermetic; the CI-first verification policy is documented.
  - Repository hygiene: LF line endings pinned via `.gitattributes` / `.editorconfig`; the version bump script cascades the Tauri lockfile and desktop metadata; bilingual commit bodies are now required.
  - Build health restored across jobs (workspace warnings cleared, compile blockers and cross-platform assertions fixed).

---

- **[对话流式与会话连续性] 单事件总线、可续传游标与全链路幂等渲染，刷新/切换/多端查看全部稳妥**:
  - 缓存性能与画布数据一致性全面提升，防止重复重放、消息渲染错位等情况。
  - 全量对话流式收敛至唯一广播事件总线，`/chat` 以无状态 RPC 触发；历史重放旧机制物理退役。
  - 会话级单调游标让断线重连精确续接：刷新、失焦、切换会话后，提问、思考与正文不再重复或丢失。
  - 修复工具调用后的多轮实时输出、流式思考/正文中途碎裂、刷新后最新提问消失等问题；重复重放严格幂等。
  - 消息与部件身份贯穿 kernel、daemon 与 WebUI，配合跨实例增量事件通道，多标签页与多设备实时同步。
  - 会话流按会话隔离；热切换自动对账磁盘态；侧栏运行指示自愈校准，重连风暴彻底平息。

- **[对话历史与交互] 气泡内联编辑、回溯与重新生成，可靠的转向与停止控制**:
  - 历史气泡支持内联编辑与多图回填：「改写历史」（原地更新、不触发重新生成）与「回溯并提交」（截断后续历史、重新分支生成），并支持单轮临时模型覆盖；助手回答支持「重新生成」与「删除」。
  - 所有历史变更原子落盘，并差量广播到全部打开的标签页。
  - Steer 卡片刷新不丢失，取消即清理内核缓冲；回合时钟在断线重连后继续累计真实耗时。
  - 「立即发送」可靠终止在跑回合并即时投递；停止会等待真实离场、不再有任意超时；409 冲突平滑回退到队列；停止按钮秒级响应并带防反弹屏障。

- **[性能与冷启动] 画布秒开、分级缓存与空闲零轮询**:
  - 内存 + IndexedDB 双层会话缓存配合空闲预取，刷新后全态画布瞬时还原：提问大纲、待办清单、Token 用量一并恢复。
  - 内嵌静态资源分级 HTTP 强缓存；重量级面板懒加载（主包缩减逾 70 kB）；非关键启动检测错峰延后。
  - 彻底拔除 500ms~5s 高频轮询，全面事件驱动；新增模型手动刷新按钮；空闲态网络请求归零。

- **[WebUI 体验与视觉] Git 面板、画布搜索、Mermaid、Markdown、媒体与主题**:
  - Git 面板重建为项目级单飞缓存 + HEAD 锚定图谱缓存 + DOM 常驻保活，后台 Git 进程由约 11 个压到 2 个；中文文件名与分支切换问题修复。
  - 画布 Ctrl+F 全量搜索并居中平滑跳转；提问大纲锚定修复；自动跟屏尊重手动翻阅。
  - Mermaid 图表不再消失（水合崩溃修复、流程图标签保留、嵌套围栏妥善处理），工具栏精简；流式 Markdown 的围栏、标题、列表不再碎裂。
  - 支持 8MB 图片上传并保持纵横比转码；输入框 ↑/↓ 历史召回；移动端布局修复；护眼亮色主题与圆形电源开关。
  - TUIx：支持 legacy `list` 动作、流式中 `/clear` 与 `/new`、`read` 工具详情格式化。

- **[后台进程与终端运行时] 常驻服务与回合解耦、实时日志与原生 PID**:
  - 后台常驻服务在回合结束、用户停止、刷新与会话切换后依然存活，仅在显式 kill、删除会话或宿主退出时终止。
  - 后台输出实时落盘为系统临时日志并附 tail 读取指南；会话级日志池滚动复用、级联清理。
  - 虚拟 ID 全链路退役：注册、取消与状态钩子全部改用操作系统原生 PID。
  - Windows Git-Bash/MSYS 可靠性：路径与环境归一（`$TMPDIR` / `$DESKTOP`）、后台任务回报真实 PID、混合编码正确解码、交互式命令快速失败不再挂起、退出前排空管道。

- **[工具、编辑与代码智能] 压缩输出带取回钥匙、规范工具名与编辑加固**:
  - 超长工具输出统一压缩并携带 artifact 钥匙，可随时取回全文；终端输出拥有独立可配置阈值。
  - 工具名全栈收敛为规范 `read` / `write` / `edit` / `run_command`，旧名仅作别名继续兼容；worker 作用域闸门识别现代调用。
  - edit 工具：拒绝失真恢复、50% 相似度守卫与跨文件提示、更丰富的失配诊断、冲突选项明确报错。
  - grep 容忍裸花括号并在目标缺失时优雅兜底；Windows 路径归一加固（verbatim UNC 大小写、多字节路径切片）。
  - 目录选择器现代化（Windows 原生对话框 + 远程会话内置网页浏览器）；Windows 下 Python venv 启动器上下文保留。
  - 子代理获得 `code_explore`，task 分发宽松化并支持别名与错误自愈；todo 的只读 `list` 动作转正。

- **[内核、上下文与提示词] 水位预算、persona 架构与工作流纪律**:
  - 上下文预算采用水位机制，消除「每轮报警但从不压缩」的困扰；模型面板提供 32K~384K 档位与自定义。
  - 系统 persona 重组为四段式架构并引入独立 explore 策略；提示词对齐现代结构化工作流（todo 规范、任务边界意识）；无意义的回合开始动态提醒退役。
  - 提示词/persona 基线解析稳定，不再静默丢失内置防线；MCP 子进程确定性回收；home/配置解析统一为单一来源。

- **[MCP、Skills 与能力面] 统一能力状态与热重载**:
  - MCP 与 Skills 共享统一的 GLOBAL/PROJECT 能力状态并支持热重载；能力开关是唯一权威，项目信任静默确认。

- **[网络与远程访问] IPv6 双栈支持**:
  - WebUI 同时监听 IPv6 与 IPv4，可分享地址按优先级排序并采用 RFC 规范中括号 URL；远程访问面板跨平台展示 IPv6 地址。

- **[安全与依赖] 依赖链与路径防护加固**:
  - 移除存在漏洞的 WebUI 依赖链并将 `npm audit` 纳入 CI；Mermaid 输出注入前净化；`code_explore` 纳入敏感路径闸门；凭据文件由图谱专用忽略清单隔离。

- **[国际化、桌面与 VSCode]**:
  - WebUI、TUIx、daemon、桌面启动与 VSCode 扩展全面支持越南语，配合三级系统语言自动探测。
  - 桌面启动状态本地化（英/中/越）；无障碍标签与原生终端引导本地化；VSCode 扩展更新图标并修复打包。

- **[CI、发布流水线与工程化]**:
  - 发布流水线重建为全架构真并行矩阵并接入全局 Rust 编译缓存，关键路径耗时缩短近半；临时发布监控脚本下线。
  - portability 工作流全量运行 native 与 subset 跨平台测试；TUI 套件纳入 CI 门禁；all-features 套件密闭化；CI-first 验证策略成文。
  - 仓库卫生：LF 行尾全局钉死（`.gitattributes` / `.editorconfig`）；版本 bump 脚本级联 Tauri 锁文件与桌面元数据；提交正文双语规范确立。
  - 构建健康恢复：workspace 告警清零，编译阻塞与跨平台断言问题修复。

## v7.2.2-beta.7 (2026-10-12)

- **[Daemon & WebUI Live Streaming / Canvas] Monotonic live sequence tagging and global idempotency against duplicate replays**:
  - **Technical Root Cause / Detail**: 
    1. Stale client cursor: Live stream frames from `live_stream` omitted `seq` tags (`None`), causing client-side stream cursors (`streamCursor`) to freeze at 0 during active generation. Upon blur or refresh, the client requested reconnects with stale cursors (`after_seq = 0`), prompting the server to re-emit the entire turn replay from the beginning.
    2. Missing global text/thinking deduplication: When a full replay re-emitted initial reasoning while the canvas already displayed trailing text, `mergeReasoningIntoParts` and `mergeTextIntoParts` erroneously appended new parts instead of updating in place, resulting in duplicate interleaved blocks (`[reasoning] -> text -> [reasoning] -> duplicate text`).
  - **Implementation Mechanism**: 
    1. Continuous monotonic sequence counter: Daemon's `live_stream` now tags all live events with monotonically increasing `seq` values (`AtomicU64`), ensuring client cursors advance in real time and reconnects only pull unreceived suffixes.
    2. Global content idempotency: In `sessionProjection.ts`, `mergeReasoningIntoParts` and `mergeTextIntoParts` now globally search existing parts: if content is already present or identical, it is cleanly discarded; if it is a prefix extension, it updates in place.
  - **Verification & Testing**: 472 WebUI unit tests pass (`node --test`), 401 daemon lib tests pass (`cargo test --lib -p jeikcode-daemon`), and TypeScript checks clean (`tsc --noEmit`).

---

- **[Daemon 与 WebUI 流式与画布] 实时流递增序号赋权与防重复重播全局内容幂等**:
  - **技术机理 / 现象溯源**: 
    1. 客户端游标僵死：后端在推送实时事件（`live_stream`）时帧上未带 `seq`（为 None），导致前端在推流期间本地游标始终定格在 0。失焦或刷新重连时前端只能发回 `after_seq = 0`，服务端被迫将本轮整段历史（从最早的思考到正文）全量重新重播一遍。
    2. 全量重播跨类型追加：当全量重播帧到达时，画布末尾已经是正文，此时首帧思考过程到来因类型不同被强制在正文后面新建了思考块；紧随其后的正文帧又在思考块后新建了正文块，导致思考与正文被双倍重复追加。
  - **实现防线 / 核心改动**: 
    1. 实时流全链路单调递增游标：后端 `live_stream` 全局使用 `AtomicU64` 为每一帧实时流赋以严格单调递增的 `seq` 序号，前端毫秒级实时推进本地游标，断线/刷新重连精准按序续接，服务端绝不多发一条旧内容。
    2. 全局内容级幂等防线：在 `sessionProjection.ts` 中，`mergeReasoningIntoParts` 与 `mergeTextIntoParts` 建立全局检测防线：若已有部件已包含该内容，直接丢弃，绝不在末尾造出第二个重复块；若为前缀延伸则原地扩展。
  - **验证与交付**: WebUI 472 项单测全绿，daemon 401 项单测全绿，`tsc --noEmit` 0 报错。

## v7.2.2-beta.6 (2026-10-12)

- **[WebUI Live Stream / Canvas] Unify thinking blocks and eliminate reasoning duplication across tool rounds**:
  - **Technical Root Cause / Detail**: During stream reconnection or focus changes, `appendReasoningPart` checked `tail.id !== id` and `mergeReasoningIntoParts` returned early when part ids diverged. Consequently, replayed or newly arriving thinking deltas failed part-id matching against existing elements and bypassed whole-text deduplication (`existing.includes(content)`), creating consecutive duplicated thinking blocks on screen.
  - **Implementation Mechanism**: Restored the fundamental rule for reasoning streams in `appendReasoningPart`: as long as the trailing part is a reasoning block, incoming thinking chunks unconditionally append in place (`tail.text += delta`), strictly preventing multiple consecutive thinking blocks. Restored full-text deduplication in `mergeReasoningIntoParts` across all part-id checks.
  - **Verification & Testing**: 472 WebUI unit tests pass (`node --test`), 401 daemon lib tests pass (`cargo test --lib -p jeikcode-daemon`), and TypeScript checks clean (`tsc --noEmit`).

---

- **[WebUI 流式与画布] 合并思考流式输出，杜绝工具轮次间思考块分叉与重复**:
  - **技术机理 / 现象溯源**: 在流式断点重连或失焦切回时，`appendReasoningPart` 严苛校验 `tail.id !== id`，且 `mergeReasoningIntoParts` 在 partId 不匹配时直接提前 return。导致已存在的思考块无法被命中，进而跳过了全量文本去重防线（`existing.includes(content)`），在工具调用之间硬生生追加出了多个连续重复的思考折叠块。
  - **实现防线 / 核心改动**: 确立思考流式输出的绝对合并铁律：在 `appendReasoningPart` 中只要末尾已是思考部件，任何新来的思考 chunk 无条件在尾部拼接（`tail.text += delta`），绝不分裂；并在 `mergeReasoningIntoParts` 中恢复全量文本去重防线。
  - **验证与交付**: WebUI 472 项单测全绿，daemon 401 项单测全绿，`tsc --noEmit` 0 报错。

## v7.2.2-beta.5 (2026-10-12)

- **[WebUI & Daemon Live Stream / Canvas] Fix post-refresh user prompt loss and streaming reasoning/text fragmentation**:
  - **Technical Root Cause / Detail**: 
    1. Prompt disappearance on refresh: When a turn was active, `/chat/watch` filtered replay frames using `seq >= after_seq`. Because the turn's `ChatEvent::User` was tagged with `seq_base`, any connection reconnecting with an advanced cursor filtered out the active turn's user prompt. Simultaneously, reloading disk history during an active turn lacked unpersisted user prompts and erroneously overwrote the memory/IndexedDB cache, completely vanishing the user prompt across refresh.
    2. Streaming fragmentation across refresh/blur: During continuous live streaming, `appendReasoningPart` and `mergeTextIntoParts` erroneously checked `tail.id === id`. Whenever a slight part-id divergence or focus reconnection occurred, incoming chunks failed this check and were pushed as entirely separate parts rather than appending text in place, fragmenting single coherent thoughts and responses into dozens of disjointed blocks.
  - **Implementation Mechanism**: 
    1. Guard active user prompts in replay: Daemon's `subscribe_live_with_replay` now explicitly preserves `ChatEvent::User` at the head of `replay_head` regardless of `after_seq` filtering. Front-end `paintUserMessage` idempotently restores missing user prompts while deduplicating existing ones. In `Chat.tsx`, active sessions strictly skip `saveSessionCache` overwrites from incomplete disk state.
    2. Seamless text and reasoning streaming: `appendReasoningPart` and `mergeTextIntoParts` now unconditionally append incoming streaming chunks to the trailing part of the same kind unless a distinct part-id boundary is explicitly encountered, eliminating streaming text/thinking splitting.
  - **Verification & Testing**: 472 WebUI unit tests pass (`node --test`), 401 daemon lib tests pass (`cargo test --lib -p jeikcode-daemon`), and TypeScript checks clean (`tsc --noEmit`).

---

- **[WebUI 与 Daemon 流式与画布] 修复刷新后最新用户消息丢失与思考/正文流式输出碎裂分叉**:
  - **技术机理 / 现象溯源**: 
    1. 刷新后用户提问消失：当回合处于活跃执行中，后端 `/chat/watch` 重放过滤以 `seq >= after_seq` 截断。本回合提问 `ChatEvent::User` 携带 `seq_base`，任何持有递增游标重连的连接均将本轮用户消息过滤拦截；同时刷新时读取磁盘因尚未完结落盘而缺少最新提问，并错误覆写了缓存，导致刷新后用户消息 100% 丢失。
    2. 失焦/刷新导致思考与正文碎裂断开：在流式生成期间，`appendReasoningPart` 与 `mergeTextIntoParts` 严苛校验 `tail.id === id`。一旦发生失焦重连或部件 ID 微小差异，后续到来的 chunk 校验失败便全部作为新部件 push，将原本同一段连续输出切碎为十几个孤立的折叠块与文本块。
  - **实现防线 / 核心改动**: 
    1. 活跃用户提问重放铁律守护：后端 `subscribe_live_with_replay` 明确保证无论 `after_seq` 游标如何过滤，本回合活跃提问 `ChatEvent::User` 恒定保留在重放头部送达；前端 `paintUserMessage` 幂等自愈恢复提问并自动去重；`Chat.tsx` 严格禁止在活跃期间用未落盘的磁盘历史覆写会话缓存。
    2. 流式思考与正文连贯合并：`appendReasoningPart` 与 `mergeTextIntoParts` 恢复同类型部件流式文本无缝合并原则，仅在跨工具或显式跨段时另起部件，彻底根治流式内容被碎尸万段的顽疾。
  - **验证与交付**: WebUI 472 项单测全绿，daemon 401 项单测全绿，`tsc --noEmit` 0 报错。

## v7.2.2-beta.4 (2026-10-12)

- **[WebUI / Daemon Streaming] Session-level resume cursor and identity-idempotent canvas**:
  - **Technical Root Cause / Detail**: The canvas is fed by a single event bus (`/chat/watch`) that carries BOTH replayed buffer frames and live deltas. The client hard-coded "this frame may already be painted" for the whole stream, so `mayPaintUnroutedDelta` rejected every round after the first tool call whenever the session already had an earlier turn — thinking and body text after tool execution never appeared until a manual refresh re-read the disk. Replay de-duplication additionally compared a frame against the concatenation of ALL text parts of a message, so re-sent mid-segments were re-appended (the whole in-flight turn was re-typed) and cross-round frames were glued into the previous round's parts (thinking split in two, body text swallowed).
  - **Implementation Mechanism**: `/chat/watch` now takes `after_seq` (`-1` = brand-new session → no replay, only a `session_start` handshake carrying the starting cursor; `N` = replay only frames with `seq >= N`; absent = full replay). Replayed frames carry `seq`, live frames do not; the cursor is a strictly increasing SESSION-level counter that survives turn boundaries, context compaction, and history rewrites. Tool boundaries open a new streaming part id (`end_streaming_part`). The WebUI stores the cursor per session and per stream (`streamCursor.ts`), dispatches by WHAT THE CONNECTION REQUESTED instead of guessing per frame, merges replay frames by part id (idempotent), deletes the legacy gate, never merges cross-round frames into the previous round's parts, writes the canvas back to the L1/L2 session cache (debounced 800ms plus forced writes at turn end and on mutations), keeps display monotonic under compaction, and invalidates the cursor (clearing the stale turn buffer server-side) on session mutations.
  - **Verification & Testing**: `tsc --noEmit` clean; 477 WebUI unit tests pass; 401 daemon lib tests pass; `cargo check --lib -p jeikcode-daemon` clean.

---

- **[WebUI / Daemon 流式传输] 会话级断点续传游标与纯身份幂等画布**:
  - **技术机理 / 现象溯源**: 画布由单事件总线（`/chat/watch`）推进，而这条流同时搬运回放帧与实时增量。前端对整条流硬编码「这帧可能已经画过」，于是只要会话已有历史回合，`mayPaintUnroutedDelta` 就会拦掉第一轮工具调用之后的每一轮思考与正文 —— 只有手动刷新才出现。回放去重还拿「整条消息所有正文的拼接」当基线：从中间重发的片段被再次追加（整个在途回合被逐帧重打一遍），跨轮的帧还会被粘进上一轮的部件里（思考被拆成两段、正文被吞掉开头）。
  - **实现防线 / 核心改动**: `/chat/watch` 支持 `after_seq`（`-1` = 新会话 → 不补发，只回一条携带起始游标的 `session_start` 握手帧；`N` = 只补 `seq >= N` 的回放帧；缺省 = 全量补发）。回放帧带 `seq`，实时帧不带；游标为会话级严格递增计数器，跨回合、跨上下文压缩、跨历史改写都成立。工具调用处闭合当前流式部件（`end_streaming_part`），工具前后的正文各自拥有独立段编号。前端新增 `streamCursor.ts` 按会话、按流分别存游标，按「本次连接请求了什么」分发，回放帧按段编号幂等合并，删除旧守卫，跨轮帧绝不并进上一轮，画布反哺 L1/L2 缓存（防抖 800ms + 回合收尾与变更时强制写入），压缩时显示只增不减，会话变更即时作废游标并清空服务端失效缓冲。
  - **验证与交付**: `tsc --noEmit` 干净；webui 477 项单测全过；daemon 401 项 lib 测试全过；`cargo check --lib -p jeikcode-daemon` 通过。

## v7.2.2-beta.3 (2026-10-12)

- **[WebUI Live Streaming & Turn Settlement] Unblock multi-round live streaming and auto-reconcile disk at turn boundary**:
  - **Technical Root Cause / Detail**: In turns involving tool executions, Round 1 (tool execution) stamped the assistant bubble with `last.id = "m-round-1"`. When Round 2 (final summary response text) began streaming with a new round identity (`message_id: "m-round-2"`), the anti-ghost-replay gate `mayPaintUnroutedDelta` erroneously rejected all live text deltas because `last.id` was already set. Consequently, live streaming of the final text after tool execution was completely dropped on the canvas, only appearing after manual page refresh or window blur triggered disk reconciliation.
  - **Implementation Mechanism**: Unblocked live streaming by ensuring `mayPaintUnroutedDelta` unconditionally permits live streaming deltas (`replay === false`), guaranteeing real-time token-by-token rendering on screen during active LLM generation. Enhanced `identifiedAssistantIndex` to match both `message.id === messageId` and any part whose id starts with `${messageId}:`, enabling multi-round assistant bubbles to route subsequent events cleanly. Added `settleDiskCatchUp` with a `force` option to proactively reconcile disk state upon turn completion (`settleToIdleWatch`), user stop (`handleStop`), or premature stream closures without waiting for window blur.
  - **Verification & Testing**: Added regression test `live streaming of multi-round turn (tools in round 1, final text in round 2) is NEVER blocked` in `sessionProjection.test.ts`. All 479 WebUI tests pass, `tsc --noEmit` is clean, and `npm run build` succeeds.

---

- **[WebUI 实时流式传输与回合结算] 放行多轮工具后实时流式输出，并在回合收尾时主动对账磁盘**:
  - **技术机理 / 现象溯源**: 当回合包含工具调用时，Round 1（工具轮）为助手气泡盖上了 `last.id = "m-round-1"`。随后 Round 2（最终回复正文）带着新分配的 `message_id: "m-round-2"` 推流到达时，画布拦截守卫 `mayPaintUnroutedDelta` 因发现 `last.id` 已存在而错误地拒绝了所有实时文本增量。导致工具执行后的最终正文在推流期间完全无法在画布渲染，只响铃弹通知，正文必须等到用户手动刷新或窗口失焦触发磁盘回读后才显现。
  - **实现防线 / 核心改动**: 彻底放行实时推流：`mayPaintUnroutedDelta` 增加 `!replay` 检查，在直播推流状态（`replay === false`）下 100% 放行，确保活动生成期间实时逐字上屏。强化轮次部件前缀索引：`identifiedAssistantIndex` 除了比对 `message.id` 外，新增按部件前缀 `${messageId}:` 匹配，打通同一气泡跨多轮次（多 round）的精准寻址。回合收尾磁盘对账：新增 `settleDiskCatchUp`（携带 `force` 选项），在终态到达、用户停止或长连接意外提前关闭等收尾时机主动补偿拉取磁盘，无需等待窗口失焦。
  - **验证与交付**: 在 `sessionProjection.test.ts` 中新增多轮工具调用后最终正文实时推流回归测试；全量 479 项 WebUI 单元测试 100% 通过；`tsc --noEmit` 0 报错；`npm run build` 成功。

## v7.2.2-beta.2 (2026-10-12)

- **[WebUI & Daemon Interaction] Robust send-now, idempotent turn replay, and todolist replay dedup**:
  - **Technical Root Cause / Detail**: Three replay/stop consistency defects. (1) "Send now" never stopped the running turn: `handleSendImmediately` only tried `requestIdRef.current`, which is cleared as soon as POST /chat is admitted, so the stop was skipped entirely and the immediate delivery hit 409 session_busy — the card flashed and bounced back into the queue. (2) The canvas projection appended any replay frame whose `message_id` was missing from the canvas to the LAST assistant row; a mid-turn steer splits a turn into several assistant rows, so old body/reasoning was repainted into the newest bubble on every reconnect — the background session cache had dropped the wire id when painting, and the id-less row was later adopted as the canvas and persisted to IndexedDB. (3) `todowrite` is stateless and a full plan / batch add replaces the whole list, so re-folding a replayed call restored the statuses frozen in that call's arguments; the idempotency key was deleted exactly when the list completed, was not persisted across refresh, and was seeded by overwriting (visible window only) — which is why a fully checked list reverted after a refresh.
  - **Implementation Mechanism**: `stopRunningTurn` becomes the single stop channel shared with the stop button (session id + request id aliases); `POST /chat/stop` reports an authoritative `released` verdict and waits for the real release (no 2.5 s cap, false while a native-runtime turn still occupies the session). Queue cards are dequeued only when the message actually becomes content (`dispatchQueuedCard`), and every queue mutation goes through `persistSessionQueue` / `updateQueuedForSession` so the in-memory map, localStorage and the backend `/chat/queue` stay identical. Every canvas writer stamps the wire identity (background cache via `paintCachedAssistantDelta`, tool rows via `withAssistantIdentity`), `mayPaintUnroutedDelta` refuses to paint an unrouted frame when the trailing assistant row already owns another identity so replays stay byte-identical, and a healthy `/chat/watch` is no longer torn down on every focus/visibility change. New `todoAppliedIds` persists the applied call-id set per session (localStorage, synchronous hydration, merge-only seeds, never cleared on completion).
  - **Verification & Testing**: webui 472 unit tests pass (new regression tests for stop aliases and the programmatic stop mark, projection idempotency, background-cache identity stamping, and the replayed-plan revert); `tsc --noEmit` clean; `npm run build` succeeds; `cargo check --lib -p jeikcode-daemon` and the two targeted `stop_and_wait` tests pass.

- **[Repository Hygiene] Pinned LF line endings via `.gitattributes` + `.editorconfig`**:
  - **Technical Root Cause / Detail**: Line endings were unpinned (no `.gitattributes`, `core.autocrlf=true`), so the working tree was checked out as CRLF while the index stored LF; any tool rewriting a file with its own EOL style left *mixed* endings behind, and the next save produced a whole-file whitespace diff with zero content change.
  - **Implementation Mechanism**: `* text=auto eol=lf`, with CRLF explicitly kept for `*.bat`/`*.cmd`/`*.ps1` and binary assets marked `binary`; `.editorconfig` aligns editors and formatters (LF, final newline, no trailing whitespace, Rust at 4-space indent, Markdown exempt). The index already stored LF for 1172 of 1173 text files, so this is a zero-churn change.
  - **Verification & Testing**: `git check-attr` confirms the rules; the 7 previously mixed-endings files were normalized on disk with unchanged git content; `git hash-object --path` matches the index blob for CRLF working-tree samples (zero churn).

- **[WebUI & Docs / MCP Trust] Auto-confirm MCP project trust, capability switches become the only authority**:
  - **Technical Root Cause / Detail**: The sidebar rendered a "blocked N MCP server(s) from an untrusted project" banner plus a "Trust this project" button, so enabling a project-level MCP server always ended in an authorization prompt.
  - **Implementation Mechanism**: The WebUI now confirms that trust silently and never prompts (`maybeAutoTrustProjectMcp`); toggling a capability ON clears the gate first (`onToggleCapability`) while OFF never touches it; new `webui/src/lib/mcpTrust.ts` isolates the policy as pure functions with regression tests; project switches revalidate the capability list; the dead `mcp.trustProject` copy and styles were removed and the docs now state the boundary — the trust gate only audits whether a server MAY load, while the GLOBAL/PROJECT switches decide whether it DOES load.
  - **Verification & Testing**: `npm run build` and `node --test` (478/478, including the new trust-policy cases) pass.

---

- **[WebUI 与 Daemon 交互] 立即发送可靠化、回合重放幂等与 todolist 重放去重**:
  - **技术机理 / 现象溯源**: 三类停止/重放一致性缺陷：（1）“立即发送”从未真正停止运行中的回合——`handleSendImmediately` 只尝试 `requestIdRef.current`，而它在 POST /chat 被 admit（202）之后即被清空，停止被整体跳过，紧接着的投递必然撞上 409 session_busy，卡片闪一下又弹回队列；（2）画布投影会把“`message_id` 在画布上找不到”的重放帧追加到最后一条 assistant 上，而中途 steer 会把一个 turn 劈成多条 assistant 行，于是旧正文/思考每次重连都被画进最新气泡——根源是后台会话缓存落笔时丢掉了 wire 身份，缺 id 的行随后被采用为画布并写入 IndexedDB；（3）`todowrite` 无状态，全量 plan / 批量 add 是整表替换，重复折叠重放帧就会把清单打回该调用参数里冻结的状态，而幂等键恰好在清单全完成时被删除、不跨刷新持久化、种子是覆盖式（只看得到当前窗口），所以“全部打钩”的清单刷新后会回退。
  - **实现防线 / 核心改动**: `stopRunningTurn` 成为与“停止”按钮共用的唯一停止通道（会话 id + request id 双别名）；`POST /chat/stop` 返回权威 `released` 结论并等待真正离场（去掉 2.5s 上限，native runtime 仍占用时保持 false）。队列卡片只在消息真正成为正文时才出队（`dispatchQueuedCard`），所有队列变更统一走 `persistSessionQueue` / `updateQueuedForSession`，保证内存映射、localStorage 与后端 `/chat/queue` 三处一致。所有画布写入者统一盖章 wire 身份（后台缓存经 `paintCachedAssistantDelta`，工具行经 `withAssistantIdentity`），新增 `mayPaintUnroutedDelta` 在末行已属别轮时拒绝落笔（同一帧重放任意多次，画布一字不变），健康中的 `/chat/watch` 不再在每次失焦/可见性变化时被拆除。新增 `todoAppliedIds`：按会话持久化“已消费的调用 id”（localStorage、同步水合、种子只并入、全完成不清空）。
  - **验证与交付**: webui 472 项单测全绿（新增停止别名/程序化停止标记、投影幂等、后台缓存身份盖章、重放 plan 不得回退的回归测试）；`tsc --noEmit` 干净；`npm run build` 成功；`cargo check --lib -p jeikcode-daemon` 与两个 `stop_and_wait` 定向单测通过。

- **[仓库卫生] 行尾约定钉死：`.gitattributes` + `.editorconfig`**:
  - **技术机理 / 现象溯源**: 行尾此前未被钉死（无 `.gitattributes` 且 `core.autocrlf=true`）：索引存 LF、工作区检出为 CRLF，任何工具按自己的行尾风格重写文件都会留下 mixed 行尾，下一次保存就产出“整片空白 diff、内容零变化”的噪音。
  - **实现防线 / 核心改动**: `* text=auto eol=lf`，`*.bat`/`*.cmd`/`*.ps1` 显式保留 CRLF，二进制资产标记 `binary`；`.editorconfig` 对齐编辑器/格式化器（LF、末尾换行、不留尾部空白，Rust 4 空格，Markdown 豁免）。索引中 1172/1173 个文本文件本就是 LF，因此零内容变更。
  - **验证与交付**: `git check-attr` 确认规则生效；7 个 mixed 行尾文件已在工作区归一且 git 内容不变；`git hash-object --path` 与索引 blob 逐字节一致（零 churn）。

- **[WebUI 与文档 / MCP 信任] MCP 项目信任自动确认，能力开关成为是否加载的唯一权威**:
  - **技术机理 / 现象溯源**: 侧栏原先渲染“已拦截 N 个来自不受信任项目的 MCP server”横幅与“信任本项目”按钮，导致每次启用项目级 MCP 都要过一次授权提示。
  - **实现防线 / 核心改动**: WebUI 静默完成该信任、不再弹任何提示（`maybeAutoTrustProjectMcp`）；开关 ON 前先清信任闸门（`onToggleCapability`），OFF 永不触碰信任闸门；新增 `webui/src/lib/mcpTrust.ts` 纯策略函数与回归测试；项目切换时重新校验能力列表；删除失效的 `mcp.trustProject` 文案与样式，文档统一到“信任闸门只管能不能加载，全局/项目开关决定是否加载”。
  - **验证与交付**: `npm run build` 与 `node --test`（478/478，含新增信任策略用例）通过。

## v7.2.2-beta.1 (2026-10-12)

- **[Unified Tool-Output Compression (capabilities/kernel/config)]**:
  - **Technical Root Cause / Detail**: Two independent mechanisms — a 64 KiB artifact fold at execution time and a 24 KiB wire prune at request time — left the 24–64 KiB band trimmed for the model with NO retrieval handle, and the terminal class had no dedicated line.
  - **Implementation Mechanism**: One compression seam at tool return (`ArtifactMiddleware`): non-exempt results above `[tools.tool_output] max_bytes` (default 64 KiB) and terminal (`run_command` / `bash`) results above `min(max_bytes, terminal_max_bytes)` (default 24 KiB) become a uniform head 1500 + tail 2200 preview carrying the `artifact_id` handle (`fetch_output(artifact_id=...)`); the full text is spilled to the artifact store first, so the handle always resolves. `terminal_max_bytes` is configurable (config.toml + `JEIKCODE_TOOL_OUTPUT_TERMINAL_THRESHOLD_BYTES`, env wins; `0` follows `max_bytes`). The kernel's `adaptive_prune_tool_output_for_llm` / `prune_messages_for_wire` are deleted; `model_history()` is verbatim.
  - **Verification & Testing**: kernel lib 131; capabilities lib 936 (terminal split, alias, config override, uniform preview); coding artifact wiring roundtrip; config 245; workspace `check --all-targets`; `cargo fmt --check` clean.

- **[Kernel: Watermark Context Budget, Canonical Tool Names & Deterministic MCP Teardown]**:
  - **Watermark Budget**: `[models.X] max_tokens` is a capability declaration and per-protocol output budget — never context math. `effective_input_limit` is replaced by `input_watermark_budget` = window − min(20K, window/4); the wire sends the declared value verbatim; auto-compaction, the pre-send guard and `CompactionView` share one denominator; `compact_threshold` moves to 0.9 of the watermark, killing the "warns every turn but never compacts" gap (the reported 491K warning at 49% on a 1M window). The model editor offers 32K/64K/128K/256K/384K tiers + custom.
  - **Tool-Name Retirement**: `read_file`→`read` (now also lists directories), `list_directory` dropped, `write_file`→`write`, `edit_file`→`edit`; legacy names remain dispatch aliases only. Real defects fixed with it: compaction's "never stub file reads" exemption compared the literal `read_file` (now `is_file_read_tool`), the wander meter missed `read`, goal summaries only collected legacy names, the reviewer mounted the purged `list_directory`, tuix/daemon file-class arms lacked canonical names, and model-facing prose was aligned.
  - **MCP Child Lifecycle**: the last `SessionMcpLease` drop parked the process for an async TTL reaper that lives ON the runtime — a host that tears its runtime down (tests / one-shot CLI / embedded SDK) could never run it, leaking the npx/cmd/node tree while `Runtime::drop` waited forever on the child's still-open stdout. Added `McpClient::kill_now` / `StdioClient::kill_now`, `McpRegistry::kill_all_children_now` and a process-global weak registry; the last owner now reaps synchronously unless the host's idle reaper has proven itself.
  - **Verification & Testing**: `cargo check --lib -p jeikcode-daemon`; kernel 131 lib + integration; capabilities 927 lib + compaction_cache/tools_integration; coding 366 lib + full_assembly (un-ignored, ~2.4s) / plan_mode / sensitive_path / tool_args_repair / system_context; review 67+1; tuix display/format 30; webui build.

- **[Git-Bash/MSYS Reliability: Paths, Background PIDs & Mixed-Encoding]**:
  - **Technical Root Cause / Detail**: Git-Bash/MSYS integration made tool paths and background tasks unreliable on Windows: POSIX-polluted `TMP`/`TEMP` reached child shells, `$VAR`/`%VAR%` handling was inconsistent, background reports carried the wrapper PID only, and a single GBK line garbled neighbouring UTF-8 lines.
  - **Implementation Mechanism**: one `special_dirs` source for `$TMPDIR`/`$TMP`/`$TEMP`/`$DESKTOP`/`$HOME` (desktop registry-backed); tool path params accept `$VAR`/`${VAR}`/`%VAR%` plus one quote pair with undefined names kept verbatim (fail-closed); temp normalized end to end (`BASH_ENV` rc re-exports native values, `TMPDIR_WIN`/`DESKTOP_WIN` alias handles, host env sanitized at three entry points); background tasks report the workload's two real ids (`WinPID` + Git-Bash pid, leaf via Toolhelp) with the exact stop recipe; readiness probes detected ports on 127.0.0.1; `decode_mixed_span` decodes per same-class line run; `//X`→`/X` and native `/dev/null`→`NUL` normalization.
  - **Verification & Testing**: `tools::bash` 143/143, `tools_integration` 11/11 (real background start/stop with the printed recipe), `special_dirs` 6/6, `pathutil` 12/12, `mixed_encoding` 4/4, `bash_runtime` 14/14, registry consistency 18/18, reminder 9/9, `temp_env_sanitize` 1/1.

- **[Pipeline Identity & the Cross-Instance Incremental Event Bus (kernel/daemon/webui)]**:
  - **Technical Root Cause / Detail**: Without a stable per-part identity, live streaming, refresh and session switching produced ordering errors, card resurrection and ghost answer replay.
  - **Implementation Mechanism**: kernel `Message.id` + a new `AgentEvent::UserMessage` boundary event; `SteeredInput` carries the landed `message_id`; daemon `message_id`/`part_id`/`part_seq` on chat/live deltas; replay merging scoped by `message_id`/`part_id`; id-driven render keys and directed painting in the WebUI (`withAssistantIdentity` uniqueness guard, whitespace-delta self-healing); a process-wide broadcast bus + `GET /events` incremental channel (`session_upsert`/`session_deleted`/`activity`/`review_asked`/`review_resolved`) with a route-level SSE test.
  - **Verification & Testing**: `cargo check --workspace --all-targets`; daemon lib tests; webui `tsc`, `node --test`, production build.

- **[Single Home-Root Derivation & Thread-Local Test Home Seam]**:
  - **Technical Root Cause / Detail**: every path layer re-implemented the home rule (env → legacy → real home); tests repointed the process-wide environment, so one test's `update_config` rewrote the file another test was asserting on (observed: a provider key resolved to "").
  - **Implementation Mechanism**: `capabilities::paths::config_dir` delegates to `Config::resolve_config_dir`; `Config::config_dir` memoizes production resolution in a `OnceLock`; all 91 `set_var` sites on `JEIKCODE_HOME`/`TMPDIR`/`TMP`/`TEMP` across 22 files move to a thread-local home override (`IsolatedHome::at`); kernel `isolate_home` resolves through the POSIX-normalized resolver; a source-scanning guard fails the build for new `set_var` sites outside the two sanctioned startup points (backlog now empty).
  - **Verification & Testing**: capabilities lib 927/927, coding lib 364/364, daemon lib 396/396 (x3), env guard green, workspace `--all-targets` clean.

- **[Prompt/Persona Baseline Resolution (coding)]**:
  - **Technical Root Cause / Detail**: an existing-but-empty prompts dir was treated as the whole persona set (silently dropping the embedded baseline — PROHIBITIONS vanished); routing resolution solely through `Config::config_dir()` dropped the real-home fallback and removed the `<environment>` block.
  - **Implementation Mechanism**: an absent dir yields `None` while the interim `exists()` gate is reverted (a not-yet-existing dir is the normal state — persona assembly seeds it from embedded defaults); resolution order keeps the thread-local test override, then env → `~/.jeikcode/prompts`; init prompts fall back to the embedded baseline; the prompt cache gains `invalidate_cache_for_test()`; `system_context` asserts design-independent invariants.
  - **Verification & Testing**: `system_context` 2/2, coding suite green.

- **[Tool-Name & Alias Convergence Across the Stack]**:
  - **Edit repair (#38)**: `extract_edit_file_args` matched only the literal `edit_file`, so a modern `edit` call with unescaped quotes fell through to generic extraction; a single `is_edit_tool_name` now covers both names and all four check sites converge on it.
  - **Daemon formatting (#40)**: artifact extraction and `format_tool_args` were hardcoded to legacy names/`file_path`; now `write|write_file|create_file|edit|edit_file`, `path` before `file_path`, `command` or `cmd`, plus modern `read`/`write`/`edit`/`run_command`/`code_explore`/`task` formatting.
  - **Worker scope gate**: `WorkerScope::violation` matched a hardcoded list and allowed anything else, so `create_file` silently escaped a worker's declared scope; the name set now lives once (`FILE_MUTATION_TOOLS` / `is_file_mutation_tool` + `is_search_replace_tool`).
  - **todo `list` (read-only first-class)**: the legacy `{"action":"list"}` shape half-worked (summary/apply returned an error merely carrying the list, with a self-contradictory hint); it is now a real read-only action (short-circuit, no-op fold, batch rejection, schema advertises `list` plus the long-accepted `remove`).
  - **Edit ambiguity**: mixing `edits[]` with a top-level `replace_all` is a loud error; a missing `old_string` names the exact `edits[N]` index; occurrence-vs-replace_all precedence documented and pinned.
  - **TUix**: legacy `list` action recognized, mid-stream `/clear` and `/new` whitelisted, `format_tool_detail("read", …)` accepts `file_path`/`path`, and the never-passable auth-gated login tests are deleted with a comment.
  - **Verification & Testing**: focused unit regressions per area (capabilities 931, tool_format_tests 69/69, menu_tests 54/54, write_approval 18/18).

- **[Security & Indexing: `code_explore` Sensitivity + Graph-Only Credential Ignores (#41)]**:
  - **Technical Root Cause / Detail**: `SensitivePathGate` only resolved targets for `read`/`read_file`/`grep`/`glob`, so a `code_explore` on a benign symlink pointing at credentials bypassed the prompt; and the shipped `.codegraphignore` (with `.env`/`.env.*`) applied to BOTH the graph and the search walk, so an explicit glob/grep silently lost `.env.local` (green in isolation, red in the full suite).
  - **Implementation Mechanism**: `code_explore` joins `local_tool` + `local_read_target` with symlink-intercept tests; the ignore list splits into `.codegraphignore` (noise, both scopes) and the new graph-only `.codegraphignore.graph` (`.env*`, `.ssh/`, `*.pem`, `*.key`, `id_rsa*`/`id_ed25519*`), registered in `BUNDLED_ASSETS` (+ localized description) so upgrades receive it as a default-selected New diff.
  - **Verification & Testing**: `--all-features` suite 1644 passed / 0 failed / 1 ignored (previously never finished); default suite 928; tools::glob 24/24; an integration test locks the asset diff.

- **[Grep Correctness & Windows Path Normalization]**:
  - **Lenient braces**: rust's regex parser treats any unescaped `{` as a quantifier, so `.sidebar {` failed pattern build and silently degraded; `escape_bare_braces`/`build_regex_lenient` keep legal quantifiers and escape the rest (PCRE/GNU ERE aligned), with an `is_regex=true` guidance line on zero-hit patterns containing bare `.`/`{`/`}`.
  - **Missing target**: a non-existent path now searches the same-named candidate, then the nearest existing ancestor directory, stating the fallback in the output header.
  - **UNC (#39)**: `strip_verbatim` was case-sensitive on `\?\UNC\`/`\??\UNC\`, corrupting lowercase verbatim UNC paths into `unc\server\share`; all verbatim UNC forms (backslash + slash) now normalize case-insensitively to canonical UNC.

- **[Subagents Gain `code_explore` (#37)]**: `child_reg` never registered codeintel tools, so explore/worker subagents calling the flagship semantic graph failed with "tool not found" and fell back to flat grep; `codeintel` now mounts into `child_reg` and `code_explore` joins both profiles, with parts.rs regressions.

- **[WebUI: Mermaid Labels, Power Switches & Eye-Care Palette]**:
  - **Mermaid**: DOMPurify's SVG namespace validation stripped HTML inside `foreignObject`, making all flowchart labels vanish; foreignObject inner HTML and outer SVG are now sanitized separately under their respective profiles and restored via placeholder tokens, preserving labels, line breaks and KaTeX while keeping strict XSS protection.
  - **Theming**: circular IEC 5009 power-key switches (energised green micro-glow / red standby glow, press-scale micro-interactions, spinning busy glyph) and a low-glare matte-slate light palette (#f4f5f7 / #eaecee) with deepened borders, darker typography, deep forest-green success/JSON tones, a deep-amber reasoning accent, and light-mode overrides for settings surfaces.

- **[CI & Suite Hygiene]**:
  - **TUI suite gated**: `ci.yml` / `portability.yml` now run `cargo test -p jeikcode-tuix --lib -- --test-threads=1` (1,700+ tests previously only exercised locally), and `retained_small_frame_single_write` pins the Unix DA1 parser query separately (adapted from PR #44).
  - **Hermetic all-features suite**: isolated-home guard lifetime fixed (an unsafe-block-bound guard dropped immediately, reading the developer's real `~/.jeikcode/mcp.json`), plugin fixtures built with `serde_json`, trusted-domain expectations gated on the live list, the glob hidden-file test serialized, the explore workspace-root test bounded + ignored; rustfmt passes folded in for files CI's check-only policy left unformatted.
  - **Coding integration convergence**: `full_assembly` asserts prompt layout by shape (60s bounded drive loop, phase-labelled panics); `permission_grants` encodes correct allow-always semantics and canonical `write` (the fixture's `../..` path is an unresolved parent traversal that is deliberately never remembered).
  - **Portability gate**: the native-temp assertion in `special_dirs` is platform-gated — a leading `/` is POSIX pollution only on Windows; on Unix it IS the native form, so the slash/drive checks run under `cfg!(windows)` (the first real cross-platform run of this batch caught it).
  - **Process**: `AGENTS.md` now requires bilingual commit bodies (English pass, `---`, Chinese pass).

---

- **[统一工具输出压缩（capabilities/kernel/config）]**:
  - **技术机理 / 现象溯源**: 执行时的 64 KiB 折叠与请求时的 24 KiB wire 裁剪是两套独立机制，导致 24–64 KiB 区间被裁剪后**没有任何取回钥匙**，且终端类没有专属线。
  - **实现防线 / 核心改动**: 压缩只保留一处——工具返回时的 `ArtifactMiddleware`：非豁免结果超过 `[tools.tool_output] max_bytes`（默认 64 KiB）、终端（`run_command` / `bash`）结果超过 `min(max_bytes, terminal_max_bytes)`（默认 24 KiB）时，统一改写为「头 1500 + 尾 2200 字节」预览并携带 `artifact_id` 钥匙（`fetch_output(artifact_id=...)`）；改写前先落盘全量文本，钥匙永远可解析。`terminal_max_bytes` 可配置（config.toml + `JEIKCODE_TOOL_OUTPUT_TERMINAL_THRESHOLD_BYTES`，env 优先；`0` 表示跟随 `max_bytes`）。内核的 `adaptive_prune_tool_output_for_llm` / `prune_messages_for_wire` 整体删除，`model_history()` 不再二次改写。
  - **验证与交付**: kernel lib 131；capabilities lib 936（终端分档、别名、配置覆盖、均匀预览）；coding artifact 接线往返；config 245；全工作区 `check --all-targets`；fmt 干净。

- **[内核：水位上下文预算、权威工具名与 MCP 子进程确定性回收]**:
  - **水位预算**: `[models.X] max_tokens` 是能力声明与各协议输出预算，绝不进入上下文计算；`effective_input_limit` 改为 `input_watermark_budget` = 窗口 − min(20K, 窗口/4)，wire 按声明值原样下发；自动压缩、发前守卫与 `CompactionView` 共用同一分母；`compact_threshold` 提到水位 0.9，消除「每轮报警但从不压缩」死区（即 1M 窗口上的 491K / 49% 误报）。模型面板提供 32K/64K/128K/256K/384K 档 + 自定义。
  - **工具名退役**: `read_file`→`read`（兼列目录）、`list_directory` 删除、`write_file`→`write`、`edit_file`→`edit`，旧名仅作分发别名。随之修复的真实缺陷：压缩的「不打桩文件读取」豁免对 `read` 静默失效（改用 `is_file_read_tool`）、wander 漏数 `read`、goal 摘要清单恒空、review 挂载已删工具、tuix/daemon 文件类分支缺 canonical、模型可见文案全面对齐。
  - **MCP 生命周期**: 最后一个租约 drop 只把进程「停放」给活在运行时上的异步 reaper —— 销毁运行时的宿主（测试 / 一次性 CLI / 嵌入式 SDK）永远跑不到它，npx/cmd/node 进程树泄漏且 `Runtime::drop` 永久等待子进程未关闭的 stdout。新增 `McpClient::kill_now` / `StdioClient::kill_now`、`McpRegistry::kill_all_children_now` 与进程级弱登记表；最后一个 owner 在宿主 reaper 未证明可用时同步回收。
  - **验证与交付**: `cargo check --lib -p jeikcode-daemon`；kernel 131 lib + 集成；capabilities 927 lib + compaction_cache/tools_integration；coding 366 lib + full_assembly（解禁，~2.4s）/ plan_mode / sensitive_path / tool_args_repair / system_context；review 67+1；tuix 30；webui build。

- **[Git-Bash/MSYS 可靠性：路径、后台 PID 与混合编码]**:
  - **技术机理 / 现象溯源**: Windows 上 Git-Bash/MSYS 集成让工具路径与后台任务不可靠：被 POSIX 污染的 `TMP`/`TEMP` 进入子 shell、`$VAR`/`%VAR%` 处理不一致、后台只报包装进程 PID、一行 GBK 污染相邻 UTF-8 行。
  - **实现防线 / 核心改动**: `special_dirs` 单一事实源（`$TMPDIR`/`$TMP`/`$TEMP`/`$DESKTOP`/`$HOME`，桌面走注册表）；工具路径参数支持 `$VAR`/`${VAR}`/`%VAR%` 与一层引号，未定义变量原样保留（fail-closed）；temp 全链路原生化（`BASH_ENV` rc 重导出、`TMPDIR_WIN`/`DESKTOP_WIN` 别名、三入口清理宿主 env）；后台任务回报工作负载两个真实 ID（`WinPID` + Git-Bash pid，Toolhelp 取叶子）与可照抄停止配方；端口在 127.0.0.1 就绪探测；`decode_mixed_span` 按同类行段解码；`//X`→`/X`、原生 `/dev/null`→`NUL` 归一。
  - **验证与交付**: `tools::bash` 143/143、`tools_integration` 11/11（真实后台起停 + 配方照抄）、`special_dirs` 6/6、`pathutil` 12/12、`mixed_encoding` 4/4、`bash_runtime` 14/14、注册表一致性 18/18、提醒 9/9、`temp_env_sanitize` 1/1。

- **[管线身份与跨实例增量事件总线（kernel/daemon/webui）]**:
  - **技术机理 / 现象溯源**: 缺少稳定的部件身份时，流式、刷新与切会话会产生错序、卡片复活与幽灵回放。
  - **实现防线 / 核心改动**: kernel `Message.id` + 新 `AgentEvent::UserMessage` 边界事件；`SteeredInput` 携带落盘 `message_id`；daemon 在 chat/live 增量上带 `message_id`/`part_id`/`part_seq`；回放合并按 `message_id`/`part_id` 作用域；WebUI 按 id 定向落笔与渲染键（`withAssistantIdentity` 唯一性守卫、空白增量自愈）；进程级广播 + `GET /events` 增量通道（`session_upsert`/`session_deleted`/`activity`/`review_asked`/`review_resolved`）并附路由级 SSE 测试。
  - **验证与交付**: `cargo check --workspace --all-targets`；daemon lib 测试；webui `tsc`、`node --test`、生产构建。

- **[单一 home 根推导与线程级测试 home 缝]**:
  - **技术机理 / 现象溯源**: 各路径层各自重写 home 规则（env → legacy → 真实 home）；测试改向进程级环境变量，导致一个测试的 `update_config` 重写另一个测试正在断言的文件（实测 provider key 解析成 ""）。
  - **实现防线 / 核心改动**: `capabilities::paths::config_dir` 委派 `Config::resolve_config_dir`；`Config::config_dir` 用 `OnceLock` memo 生产解析；22 个文件里 91 处 `set_var` 全部改为线程级 home 覆盖（`IsolatedHome::at`）；kernel `isolate_home` 走 POSIX 归一解析；源码扫描守卫对新增 `set_var` 直接判失败（历史清单已清空）。
  - **验证与交付**: capabilities lib 927/927、coding lib 364/364、daemon lib 396/396（×3）、env 守卫绿、workspace `--all-targets` 干净。

- **[提示词/persona 基线解析（coding）]**:
  - **技术机理 / 现象溯源**: 「目录存在但为空」被当成完整 persona 集，静默丢掉内嵌基线（PROHIBITIONS 消失）；只走 `Config::config_dir()` 丢掉真实 home 回退，`<environment>` 块整体消失。
  - **实现防线 / 核心改动**: 目录不存在返回 `None`，期间引入的 `exists()` 门回滚（目录尚不存在是正常态——组装会从内嵌默认 seed）；解析顺序保留线程级覆盖，再 env → `~/.jeikcode/prompts`；init 提示词回退内嵌基线；提示词缓存新增 `invalidate_cache_for_test()`；`system_context` 改断言与设计无关的不变量。
  - **验证与交付**: `system_context` 2/2，coding 套件全绿。

- **[全栈工具名与别名收敛]**:
  - **edit 修复（#38）**: `extract_edit_file_args` 只认字面 `edit_file`，现代 `edit` 调用（含未转义引号）落到通用提取；新增单一真源 `is_edit_tool_name` 并收敛四处检查点。
  - **daemon 格式化（#40）**: artifact 提取与 `format_tool_args` 硬编码旧名/`file_path`；现支持 `write|write_file|create_file|edit|edit_file`、`path` 优先于 `file_path`、`command` 或 `cmd`，并补齐 `read`/`write`/`edit`/`run_command`/`code_explore`/`task` 格式化。
  - **worker 作用域门**: `WorkerScope::violation` 用硬编码名单、其余一律放行，`create_file` 可静默绕过声明作用域；名字集合收敛为 `FILE_MUTATION_TOOLS` / `is_file_mutation_tool` + `is_search_replace_tool`。
  - **todo `list` 一等公民**: 老形态 `{"action":"list"}` 此前半支持（返回夹带清单的错误与自相矛盾提示）；现为真正只读动作（短路回显、no-op 折叠、批次拒绝、schema 广告 `list` 与早已接受的 `remove`）。
  - **edit 歧义**: `edits[]` 与顶层 `replace_all` 混用改为响亮报错；缺 `old_string` 点名 `edits[N]`；occurrence 与 `replace_all` 优先级文档化并用回归锁定。
  - **TUix**: 识别 legacy `list`、流式中放行 `/clear` 与 `/new`、`format_tool_detail("read", …)` 同时接受 `file_path`/`path`、删除永远无法通过的账号登录测试并注明。
  - **验证与交付**: 各区域定向回归（capabilities 931、tool_format_tests 69/69、menu_tests 54/54、write_approval 18/18）。

- **[安全与索引：`code_explore` 敏感路径 + 图谱专用凭据忽略（#41）]**:
  - **技术机理 / 现象溯源**: `SensitivePathGate` 只为 `read`/`read_file`/`grep`/`glob` 解析目标，`code_explore` 经良性符号链接指向凭据可绕过审批；内置 `.codegraphignore`（含 `.env`/`.env.*`）同时作用于建图与搜索遍历，显式 glob/grep 会静默丢失 `.env.local`（单跑绿、全套红）。
  - **实现防线 / 核心改动**: `code_explore` 加入 `local_tool` + `local_read_target` 并附符号链接拦截测试；忽略清单拆为 `.codegraphignore`（噪声，双作用域）与新增图谱专用 `.codegraphignore.graph`（`.env*`、`.ssh/`、`*.pem`、`*.key`、`id_rsa*`/`id_ed25519*`），注册进 `BUNDLED_ASSETS`（含本地化描述），升级用户以默认勾选的 New 差异收到。
  - **验证与交付**: `--all-features` 全套 1644 passed / 0 failed / 1 ignored（此前跑不完）；默认套件 928；tools::glob 24/24；集成测试锁定资产差异。

- **[grep 正确性与 Windows 路径归一]**:
  - **花括号宽容**: rust regex 把任何未转义 `{` 当量词，`.sidebar {` 会让模式构建失败并静默降级；`escape_bare_braces`/`build_regex_lenient` 保留合法量词、其余转义（对齐 PCRE/GNU ERE），零命中且含裸 `.`/`{`/`}` 时追加 `is_regex=true` 引导。
  - **目标缺失兜底**: 路径不存在时先找同名候选、再退最近已存在祖先目录，并把落空事实写进输出头部。
  - **UNC（#39）**: `strip_verbatim` 对 `\?\UNC\`/`\??\UNC\` 大小写敏感，小写 verbatim UNC 会被毁成 `unc\server\share`；现所有 verbatim UNC 形态（反斜杠 + 斜杠）大小写不敏感归一到规范 UNC。

- **[子代理获得 `code_explore`（#37）]**: `child_reg` 从不注册 codeintel 工具，explore/worker 子代理调用旗舰语义图谱时报 "tool not found"、退回扁平 grep；现 `codeintel` 挂入 `child_reg`，`code_explore` 进入两个 profile，parts.rs 附回归。

- **[WebUI：Mermaid 标签、电源开关与护眼配色]**:
  - **Mermaid**: DOMPurify 的 SVG 命名空间校验会剥掉 `foreignObject` 内的 HTML，流程图节点标签全部消失；现将 foreignObject 内层 HTML 与外层 SVG 分别按各自 profile 净化并用占位符还原，标签、换行与 KaTeX 全保留，同时维持严格 XSS 防护。
  - **主题**: 圆形 IEC 5009 电源按键（通电绿色微光 / 红色待机辉光、按压缩放微交互、忙碌旋转）与低眩光哑光石板亮色配色（#f4f5f7 / #eaecee），加深描边与文字、成功/JSON 深森林绿、思考深琥珀色，并为设置面板补亮色覆盖。

- **[CI 与测试套件治理]**:
  - **TUI 套件门禁**: `ci.yml` / `portability.yml` 现跑 `cargo test -p jeikcode-tuix --lib -- --test-threads=1`（1700+ 单测此前只在本地被跑到）；`retained_small_frame_single_write` 单独钉住 Unix DA1 查询（改自 PR #44）。
  - **all-features 套件密闭化**: 修复 unsafe 块内即析构的 isolated-home guard（此前读开发机真实 `~/.jeikcode/mcp.json`）、插件夹具改用 `serde_json`、信任域期望按实时表 gate、glob 隐藏文件测试串行化、explore workspace-root 测试加有界护栏并 `#[ignore]`；并入 CI 只 check 未 fmt 文件的 rustfmt 收敛。
  - **coding 集成收敛**: `full_assembly` 按形状断言提示布局（60s 有界 drive、按阶段 panic）；`permission_grants` 采用正确的始终允许语义与规范 `write`（夹具的 `../..` 属设计上「每次问、不记住」的未解析父级穿越）。
  - **Portability 门禁**: `special_dirs` 的原生 temp 断言改为按平台判定 —— 前导 `/` 只在 Windows 上属于 POSIX 污染，Unix 上它就是原生形态；斜杠/盘符检查现仅在 `cfg!(windows)` 下执行（本批提交的首次真实跨平台运行抓到了它）。
  - **流程**: `AGENTS.md` 新增双语提交正文规范（英文整段、`---`、中文整段）。

## v7.2.2-beta.0 (2026-10-11)

- **[Subagent Dispatch, Shell-Alias Extraction & Worker Scope Gate]** (#32, #33, #34):
  - **Technical Root Cause / Detail**: Subagent dispatch rejected alias/lenient task shapes outright; the `cmd` shell alias was special-cased in two separate gates (`BashWorkspaceGate`, `TurnExecutionPolicy`); and `WorkerScopeGate` only recognized the legacy `edit_file`/`write_file` names + `file_path`, so modern `edit`/`write` calls fell through `_ => None` and escaped a worker's declared scope.
  - **Implementation Mechanism**: Lenient `task` dispatch with alias support and recoverable-error self-healing; one shared `shell_names::extract_shell_command` (also reused by argument repair) replacing per-gate alias handling; `WorkerScopeGate::violation` now matches `edit|edit_file|write|write_file` and both `path`/`file_path`.
  - **Verification & Testing**: Workspace `cargo check --all-targets` plus the three-OS Portability matrix; a new end-to-end repair→gate test covers the shared extractor; unit regressions in `task.rs`/`write_approval.rs` cover modern and legacy tool calls.

- **[Session Persistence: Native Catalog Timestamp Units]** (#36):
  - **Technical Root Cause / Detail**: `catalog_entry` guessed the timestamp unit from magnitude, mistaking small placeholder values for seconds and rewriting them.
  - **Implementation Mechanism**: Decide the unit by storage format instead — native `.meta` is passed through verbatim as milliseconds, legacy `.json` seconds still go through the checked conversion; the parallel narrower self-heal (`851d30ccc`) was superseded by this zero-guess formulation.
  - **Verification & Testing**: Unit tests extended to the native/legacy/native-precedence tri-state, plus a new CI persisted-catalog smoke step.

- **[Bash Runtime & Cross-Platform Shell Environment]**:
  - **Host Lifetime**: the per-turn bash runtime defaults to the process-global host state, so live tasks (including detached background resident services) survive turn teardown, page refresh and session reconfigure; runtime `Shutdown` now cancels foreground-only, so an ordinary turn completion no longer kills `background=true` services — they end only on explicit kill, session deletion, or host exit.
  - **Environment Normalization**: one cross-platform `apply_shell_env` on every shell path (Unix bash/sh, Windows bash, cmd.exe, PowerShell) exports `TMPDIR`/`TMP`/`TEMP` in native, forward-slash form and `DESKTOP` via the OS folder API; `sys1` environment facts (and the teaches doc) now hint to prefer `"$TMPDIR"`/`"$DESKTOP"`.

- **[Pipeline Identity Consistency (kernel/daemon/webui)]**:
  - **Technical Root Cause / Detail**: Without a stable per-part identity, live streaming, refresh and session switching produced ordering errors, card resurrection and ghost answer replay.
  - **Implementation Mechanism**: Kernel `Message.id` + a new `AgentEvent::AssistantMessage` boundary event; daemon `message_id/part_id/part_seq` on chat/live deltas and `/chat/steer` `client_input_ids` echo; id-driven render keys and reconciliation in the WebUI.
  - **Verification & Testing**: `cargo check --workspace --all-targets`; daemon lib tests; webui `tsc`, `node --test` and production build.

- **[Unified MCP + Skills Capability State (GLOBAL/PROJECT)]**:
  - **Implementation Mechanism**: one `control` surface (`CapItem`: global/project disabled + effective state) + `skills/controls` store (`skills.json` at both scopes); `mcp/config` union-disabled semantics + list/set surface; `SkillRegistry::retain_enabled`; a `SkillCatalogHook` that hot-reloads on `turn_start` (byte-stable when the catalog is unchanged). Daemon `/capabilities` + `/capabilities/toggle` endpoints; WebUI capability toggles, bare skill names, draggable notifications and zh/en/vi i18n.

- **[WebUI Dependency Security & Mermaid Toolbar]** (#35 + follow-ups):
  - **Technical Root Cause / Detail**: Tailwind's build chain retained an unpatched `braces`, Mermaid loaded an older KaTeX renderer independently of the patched stylesheet, and other locked CSS-tool deps had advisories.
  - **Implementation Mechanism**: Preserve the complete Tailwind 3 CSS output and MIT notices as static styles, patch the CSS tooling, and share Mermaid's KaTeX renderer with the existing patched stylesheet; drop the unused Tailwind CDN design draft; gate `npm audit --audit-level=high` into the WebUI quality job; DOMPurify-sanitize Mermaid SVG output before injection; remove the unused Tailwind generator chain from `site/` (site audit zero). The Mermaid badge is simplified to "Mermaid" with reactive tooltips. `webui/README.md` documents the residual Mermaid→KaTeX override risk.
  - **Verification & Testing**: 27 pre-change characterization checks + inherited-trust JS-link defect reproduction; after locked reinstall all 28 focused checks pass and `npm audit` is zero at every severity; browser smoke confirms unchanged reset/math/Mermaid output and stripped script/event-handler markup.

- **[CI & Build Hygiene]**:
  - **Technical Root Cause / Detail**: Subagent dispatch resolved `t.resolved_description(idx)` after `t.prompt` was moved, failing `cargo check --all-targets` with `E0382` across every CI "Rust quality" and Portability matrix job.
  - **Implementation Mechanism**: Reorder the calls so the borrow precedes the move; clear the residual workspace warnings (unused imports in `config`/`capabilities`, a Windows-only `mut` on `persist_res`, `parse_scutil_proxy` gated to `macOS`+test, `ToolResult`/`Message`+`Role` moved under `#[cfg(test)]`, an unused `tools::suppress_console_window` re-export removed, and the detached-driver `PgroupChild` reaped flag routed through `mark_terminated`).
  - **Policy**: `AGENTS.md` codifies a CI-first verification policy (#29).

---

- **[子代理分发、Shell 别名抽取与 Worker 作用域闸门]** (#32, #33, #34):
  - **技术机理 / 现象溯源**: 子代理分发直接拒绝别名/宽松形态的 task；`cmd` shell 别名在两个闸门（`BashWorkspaceGate`、`TurnExecutionPolicy`）各自硬编码；`WorkerScopeGate` 只识别遗留的 `edit_file`/`write_file` + `file_path`，现代 `edit`/`write` 调用落入 `_ => None`，绕过 worker 声明的目录作用域。
  - **实现防线 / 核心改动**: `task` 宽松分发 + 别名支持 + 可修复错误自愈；统一的 `shell_names::extract_shell_command`（argument repair 复用）替换各闸门的别名处理；`WorkerScopeGate::violation` 同时匹配 `edit|edit_file|write|write_file` 与 `path`/`file_path`。
  - **验证与交付**: workspace `cargo check --all-targets` 与三平台 Portability 矩阵；新增 repair→gate 端到端测试覆盖共享抽取器；`task.rs`/`write_approval.rs` 单测覆盖现代与遗留调用。

- **[会话持久化：原生 catalog 时间戳单位]** (#36):
  - **技术机理 / 现象溯源**: `catalog_entry` 按数量级猜测时间戳单位，会把小占位值误当秒级并改写。
  - **实现防线 / 核心改动**: 改由存储格式决定单位——native `.meta` 一律按毫秒透传，legacy `.json` 秒级仍走 checked 转换；并行的窄自愈提交（`851d30ccc`）被这套“零猜测”写法取代。
  - **验证与交付**: 单测扩展覆盖 native/legacy/native 优先三态，并新增 CI 持久化 catalog smoke 步骤。

- **[Bash 运行时与跨平台 Shell 环境]**:
  - **宿主生命周期**: 每轮 bash 运行时默认使用进程级全局宿主状态，使实时任务（含分离的后台常驻服务）在回合结束、页面刷新、会话重配后依然存活；运行时 `Shutdown` 仅取消前台，普通回合结束不再杀死 `background=true` 的服务（仅在显式 kill、删除会话或宿主退出时终止）。
  - **环境归一**: 各 shell 路径（Unix bash/sh、Windows bash、cmd.exe、PowerShell）统一经 `apply_shell_env` 导出原生正斜杠形式的 `TMPDIR`/`TMP`/`TEMP` 与经 OS 解析的 `DESKTOP`；`sys1` 环境事实（及 teaches 文档）提示优先使用 `"$TMPDIR"`/`"$DESKTOP"`。

- **[管线身份一致性（kernel/daemon/webui）]**:
  - **技术机理 / 现象溯源**: 缺少稳定的部件身份时，实时流式、刷新与会话切换会出现错序、卡片复活与幽灵重放。
  - **实现防线 / 核心改动**: kernel 侧 `Message.id` 与新增 `AgentEvent::AssistantMessage` 边界事件；daemon 侧增量携带 `message_id/part_id/part_seq`、`/chat/steer` 回传 `client_input_ids`；webui 侧渲染 key 与 reconcile 全面 id 驱动。
  - **验证与交付**: `cargo check --workspace --all-targets`；daemon lib 测试；webui `tsc`、`node --test` 与生产构建。

- **[统一 MCP + Skills 能力态（GLOBAL/PROJECT）]**:
  - **实现防线 / 核心改动**: 统一 `control` 能力面（`CapItem`：双 scope disabled + 生效态）+ `skills/controls` 存储（双 scope `skills.json`）；`mcp/config` 跨 scope 联合禁用语义 + list/set 能力面；`SkillRegistry::retain_enabled`；`turn_start` 热重载的 `SkillCatalogHook`（catalog 未变则字节稳定）。daemon 新增 `/capabilities` 与 `/capabilities/toggle` 端点；WebUI 增加能力开关、裸技能名、可拖拽通知与 zh/en/vi i18n。

- **[WebUI 依赖安全与 Mermaid 工具栏]** (#35 及后续):
  - **技术机理 / 现象溯源**: Tailwind 构建链包含未修复的 `braces`，Mermaid 独立加载较旧 KaTeX，其他锁定 CSS 工具依赖也存在已公开漏洞。
  - **实现防线 / 核心改动**: 将完整 Tailwind 3 CSS 输出与 MIT 声明保留为静态样式、修补 CSS 工具链、让 Mermaid 复用既有修复版 KaTeX；删除未使用的 Tailwind CDN 设计草稿；把 `npm audit --audit-level=high` 纳入 WebUI quality 作业；注入前用 DOMPurify 净化 Mermaid SVG 输出；移除 `site/` 未使用的 Tailwind 生成链（site audit 归零）。徽标简化为 “Mermaid”，提示随语言即时更新。`webui/README.md` 记录 Mermaid→KaTeX 覆盖的残余风险。
  - **验证与交付**: 修改前 27 项行为基线 + 继承 trust 的 JS 链接漏洞复现；锁定重装后 28 项针对性检查全部通过，`npm audit` 各严重度为零；真实浏览器验证 reset/公式/Mermaid 输出不变、脚本与事件属性被清除。

- **[CI 与构建卫生]**:
  - **技术机理 / 现象溯源**: 子代理分发在 `t.prompt` 被移动**之后**才解析 `t.resolved_description(idx)`，触发 `E0382`，令 CI “Rust quality” 与 Portability 全部矩阵作业失败。
  - **实现防线 / 核心改动**: 调整调用顺序使借用先于移动；清理残余 workspace 告警（`config`/`capabilities` 未使用导入、仅 Windows 需要的 `persist_res` `mut`、`parse_scutil_proxy` 归到 `macOS`+test、`ToolResult`/`Message`+`Role` 移入 `#[cfg(test)]`、移除未使用的 `tools::suppress_console_window` 再导出、分离驱动中的 `PgroupChild` reaped 标志改经 `mark_terminated`）。
  - **策略**: `AGENTS.md` 记录 CI-first 验证策略 (#29)。

## v7.2.1-beta.11 (2026-10-11)

- **[Markdown Hydration & Streaming Fence Robustness] Fix Mermaid Context Hydration Crash, Prevent Mobile GPU Compositor Tiling Ghosting, and Stop Nested Code Fence Fragmentation Across Protocols**:
  - **Mermaid Context Hydration Crash & Fallback Resolution**: Fixed a fatal unhandled exception where `MermaidDiagram` invoking `useT()` in an isolated Preact root crashed on `useSettings must be used within <SettingsProvider>`, causing diagrams and action toolbar icons to vanish across desktop, mobile, and WebUI. Added an automatic language fallback in `settings.tsx` when outside `<SettingsProvider>`, wrapped the mount point in `<SettingsProvider>` with `try...catch` error isolation, and relaxed Mermaid security level to `'loose'` to seamlessly parse rich HTML labels and `<br/>` tags.
  - **Mobile GPU Tile Compositor Ghosting Eradication**: Eliminated the rapid cascade of render-phase exceptions during token streaming that previously desynchronized mobile browser compositor threads, completely extinguishing the visual glitch where headers and input bars replicated as repeating tiles across the screen.
  - **Adaptive Fence Length Matching & Nesting Depth Tracking**: Upgraded daemon `ArtifactDetector` with variable fence length matching (`fence_len >= 3`) and depth tracking so that nested code blocks (e.g. 4-backtick markdown wrapping 3-backtick mermaid) are not prematurely terminated by inner closing fences or fragmented into stray backtick lines.
  - **Cross-Protocol Wire Fence Reconstruction**: Forwarded `fence_len` in `ArtifactStart` events and upgraded `Chat.tsx` along with OpenAI Chat (`/v1/chat/completions`), OpenAI Responses (`/v1/responses`), and Anthropic Messages (`/v1/messages`) stream projectors to reconstruct exact opening and closing fences, preserving post-block headings without markdown corruption.

---

- **[Markdown 水合容灾与流式围栏全链路稳固] 根治 Mermaid 跨端吞图与移动端鬼畜重叠残影，消除嵌套代码块碎裂与反引号堆叠**:
  - **Mermaid Context 水合断裂与环境安全降级**: 修复 `MermaidDiagram` 在独立 Preact 挂载孤岛中调用 `useT()` 时因脱离 `<SettingsProvider>` 抛出未捕获异常导致图表与工具栏图标全平台（桌面端、手机端、Web UI）被吞噬消失的致命缺陷；在 `settings.tsx` 中为 `useT()` 增加脱离 Provider 时的安全语言兜底，在 `Markdown.tsx` 中以 `<SettingsProvider>` 与 `try...catch` 隔离保护水合过程，并将 Mermaid 安全级别配置为 `'loose'` 以完美支持节点内 `<br/>` 换行与复杂富文本。
  - **移动端 GPU 瓦片合成器失步残影（鬼畜平铺）根除**: 彻底终结了流式输出过程中每秒数十次抛错导致的 Preact VNode 指针紊乱与移动端浏览器合成器线程（Compositor Thread）失步，彻底消除了顶栏与输入框在手机屏幕上像贴图一样疯狂复制重叠的视觉故障。
  - **变长围栏匹配与嵌套深度栈追踪**: 升级后台 Daemon `ArtifactDetector`，引入自适应围栏长度（`fence_len >= 3`）与嵌套深度栈（`depth`），确保 4 反引号等外层容器内的 3 反引号子代码块被完整作为普通内容保留，绝不被内层闭合误杀提前腰斩。
  - **全协议出站流式围栏精确还原**: `ArtifactStart` 协议事件携带 `fence_len` 规格，并在前端 `Chat.tsx` 以及 OpenAI Chat、OpenAI Responses 和 Anthropic Messages 等兼容流式投射器中动态还原精准匹配的围栏标记，彻底终结反引号乱葬岗并保全后续 `####` 块级标题解析。

## v7.2.1-beta.10 (2026-10-10)

- **[Background Process Decoupling, Lifecycle Isolation, and Native PID Refactoring] Complete Decoupling of Foreground Stop from Background Resident Services, Streaming Log Persistence, and Total Eradication of Legacy `bashid`**:
  - **Background Task Immunity & Foreground-Only Cancellation**: Separated foreground turn cancellation (`cancel_foreground_live_bash`) from irrevocable session transition (`cancel_all_live_bash`). User-initiated Stop actions, steer preemptions, and rapid sequential turns on OpenAI, Anthropic, and Responses APIs now terminate only blocking foreground commands and streaming LLM tokens, strictly exempting detached background resident services (`background=true`, such as FastAPI, Uvicorn, and dev servers) so they remain permanently active across turns.
  - **Transport Reconnection & 409 Conflict Safety**: Network jitters, tab refreshes, and 409 Conflict errors (`This session already has an active chat operation`) now strictly perform transport-level observer re-attaching via `/chat/watch`. Disconnections no longer cascade into task termination, guaranteeing long-running backend processes continue uninterrupted.
  - **Streaming Ephemeral Log Persistence & Smart Read Guidance**: Automatically writes detached background process output to an OS-managed temporary log file (`jeikcode-bg-{pid}.log`), updating in real time as chunks arrive from stdout and stderr pipes, and unlinking on process termination. Injected an English advisory note into `run_command`'s output teaching models to inspect live logs using negative offsets (`read(offset=-50)`) or targeted keywords (`read(key_string=..., upward=..., downward=...)`) without introducing tool clutter.
  - **Complete Physical Eradication of Legacy `bashid`**: Abolished the historical virtual ID generator (`new_bashid`, `NEXT_ID`) and obsolete `kill_by_id`. Refactored `LiveBash`, `ActiveBackgroundTask`, and `BackgroundAlert` to store native OS PIDs (`u32`), converted all internal registry lookups, cancellations, and status hooks to real PIDs, and purged obsolete `bashid` assertions across all Rust and WebUI test suites.

---

- **[后台进程生命周期解耦、前台终止隔离与原生 PID 彻底重构] 彻底隔离前台 Stop 与后台常驻服务、实时日志流式留存及伪 `bashid` 物理清零**:
  - **后台服务豁免机制与前台精准终止隔离**: 严格拆分轮次级前台取消（`cancel_foreground_live_bash`）与不可逆会话销毁（`cancel_all_live_bash`）。用户点击 Stop 停止生成、Steer 抢占式发送以及在 OpenAI、Anthropic、Responses API 快速叠发消息时，仅杀死阻塞中的前台终端命令与大模型生成流，绝对豁免通过 `background=true` 启动的常驻后台服务（如 FastAPI、Uvicorn、开发服务器），使其跨轮次持续稳定运行。
  - **传输层重连与 409 冲突无害化**: 网络波动、断网重连、页面刷新以及 409 Conflict 冲突（`This session already has an active chat operation`）完全收敛为纯传输层重连（通过 `/chat/watch` 作为观察者重新订阅总线），严禁级联下发任何停止或杀死信号，确保后端任务与生成进程持续演进。
  - **后台实时日志临时持久化与 Read 引导尾注**: 为每个后台常驻进程自动在系统临时目录建立独立日志文件（`jeikcode-bg-{pid}.log`），Tokio 异步管道在读取 stdout/stderr 时实时追加写入，服务停止后自动 unlink 清洁删除；在 `run_command` 返回尾部贴心注入英文指南，传授大模型使用 `read(offset=-50)` 逆序 tail 读取最新日志及 `read(key_string=...)` 锚点定位排错，零新增工具负担。
  - **历史遗留伪 `bashid` 物理清零**: 彻底物理删除虚拟 ID 自增器（`new_bashid`、`NEXT_ID`）与废弃的 `kill_by_id`；将 `LiveBash`、`ActiveBackgroundTask`、`BackgroundAlert` 等核心数据结构及注册/注销/查找方法全面重构为操作系统原生数字 `pid: u32`，全面净化全仓 Rust 与 WebUI 废弃测试断言，实现底层到表层的 100% 真实 PID 接管。

## v7.2.1-beta.9 (2026-10-10)

- **[Ghost Watch Elimination, Canvas Hydration, Git Unicode Path, and Steer Lifecycle] Watch Loop Storm Eradication, Full-State IndexedDB Hydration, Git Octal Path Decoding, and Steer Card Preservation**:
  - **Ghost Watch & Reconnect Loop Storm Eradication**: Fixed a critical backend bug in `subscribe_or_standby` and `subscribe_live_with_replay` where completed turns (`terminal_reached` or `stopped`) were erroneously returned as active `Live` streams over dead broadcast channels, instantly triggering connection EOFs. Injected a 1000ms backoff retry delay and a 3-strike circuit breaker with 30s cooldown in frontend `startIdleWatch`, completely extinguishing the 0ms tight reconnect loop storm.
  - **Full-State Canvas Hydration & TodoList Anti-Resurrection Guard**: Extended IndexedDB `sessionCache.ts` to persist `turns` (question outlines), `todos` (task checklists), and `tokenUsage` alongside messages, enabling 0ms instant first-paint restoration and completely eliminating timeline redraw jitter and right-panel 3-to-11 question jumps after refresh. Added `isTodoPlanCall` in `todos.ts` to recognize modern Agent batch actions (`{"actions":[{"action":"add"}]}`), preventing historical tasks from being discarded as fragments and stopping stale stashed plans from overwriting settled checklists.
  - **Git Unicode Path & Branch Switching Robustness**: Enforced `-c core.quotepath=false`, `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, and `LANG=C.UTF-8` across all daemon Git commands, and introduced an automated `unquote_git_path` octal-escape decoder in `api_git.rs`, completely eliminating `\346\226\260...` garbled filenames for Chinese files. Fixed `GRAPH_CACHE` branch staleness when switching between branches pointing to the same commit, supported Detached HEAD short hashes, and added a 1-click shortcut in the checkout error banner directing users to uncommitted changes.
  - **Steer Card Lifecycle Preservation & 409 Conflict Reconciliation**: Fixed a timing bug where the queue drain effect wiped out in-flight steer cards on the initial F5 render frame before active session discovery resolved, ensuring steer cards persist seamlessly until absorbed by the backend kernel. Enriched conflict error classification (`postChatPrompt` status and code attachment + `already has an active chat operation` matching), smoothly rolling conflicting submits into the queue without emitting connection error banners.

---

- **[幽灵监听风暴清零、全态画布秒开、Git中文八进制转码与转向生命周期闭环] 彻底终结 Watch 零延迟死循环、IndexedDB 全态持久化、Git 中文乱码修复与 Steer 刷新防丢**:
  - **幽灵监听与零延迟死循环风暴根除**: 修复后端 `subscribe_or_standby` 与 `subscribe_live_with_replay` 将已终结（`terminal_reached` / `stopped`）的僵尸回合误当 Live 流返回导致 channel 瞬间闪断的致命 Bug；在前端 `startIdleWatch` 注入 1000ms 异常断开退避延迟与连续 3 次闪断熔断机制（30s 冷却），彻底平息数千次请求的零延迟网络风暴。
  - **画布全态秒级直出与 TodoList 脏状态防招魂**: 扩展 IndexedDB 本地缓存引擎，将提问大纲（`turns`）、待办清单（`todos`）和 `tokenUsage` 全面纳入原子级持久化，实现 F5 刷新 1~3ms 全态秒开，彻底消除右侧栏从 3 个问题跳到 11 个以及消息重绘跳帧拉扯；在 `todos.ts` 引入 `isTodoPlanCall` 兼容现代 Agent `actions` 批处理语法，根治历史计划被误当碎片抛弃、导致过期的半成品待办被招魂复活的顽疾。
  - **Git 中文八进制乱码与分支切换全链路优化**: 在后端 `api_git.rs` 全面注入 `-c core.quotepath=false`、`GIT_TERMINAL_PROMPT=0` 与 `GIT_OPTIONAL_LOCKS=0`，并内置 `unquote_git_path` 双保险解码器，彻底消灭外部新建中文文件产生的 `\346\226\260...` 八进制转义乱码；修复同 Commit 分支切换与 Detached HEAD 状态下的缓存盲区，并在工作区代码冲突时提供一键直达“更改”标签页的中文指引。
  - **Steer 转向卡片生命周期保护与 409 冲突平滑重排**: 修复 F5 刷新首屏队列处理器在 `busy=false` 空窗期抢跑误杀 `kind === 'steer' | 'steering'` 转向卡片的漏洞，确保卡片稳健保留直到后端内核吸收并升级为正式正文；全面增强 409 Conflict 识别覆盖（包含 `already has an active chat operation`），将毫秒级停止抢跑平滑转入队列重排，彻底消除界面红字报错。

## v7.2.1-beta.8 (2026-10-10)

- **[Performance & State Synchronization] Client-Side IndexedDB Session Cache, Git Single-Flight Engine, Steer Persistence, and Universal Markdown Robustness**:
  - **IndexedDB Session Cache & Cold-Start Acceleration**: Implemented dual-layer session storage (`sessionCache.ts`: L1 memory LRU + L2 asynchronous browser-native IndexedDB), breaking the 5MB sessionStorage quota barrier and enabling 0ms instant first-paint restoration after refresh. Added idle prefetching for top 3-5 high-frequency sessions with automatic deduplication, plus Ctrl+F5 complete cache wipe support.
  - **Git Single-Flight Engine & DOM Keep-Alive**: Upgraded right-side inspector panel to permanent DOM Keep-Alive with CSS display toggling in `Chat.tsx`. Introduced global project-level singleton `gitStore.ts` with 500ms event-driven debounce and inflight queuing locks. Overhauled daemon `api_git.rs` to cache multi-repo scanning and bind `git log` graph calculation strictly to HEAD commit hash, slashing 11 redundant child processes down to 2 and eliminating heavy NTFS disk sweeps.
  - **Turn Navigation & Canvas Ctrl+F Overhaul**: Resolved the critical bug where hot-reloaded user turns failed to anchor or scroll in the TurnNav outline by implementing `userIndexToOrdinal` fallback resolution and pulse highlight feedback. Re-engineered canvas Ctrl+F search to scan all conversational elements (user input, model reasoning, assistant answers, tool arguments, tool outputs, and notices) with centered container scrolling, Enter/Shift+Enter navigation, and automatic reasoning block expansion.
  - **Steer Queue & Turn Clock Persistence**: Stashed in-flight steer queue cards and turn clock start epochs into `sessionStorage`, resolving the intermittent bug where refreshing caused queued steer cards to disappear and the bottom-left turn stopwatch to reset from 0s.
  - **Running Spinner Reconciliation & Multi-Session SSE Routing**: Enforced strict `session_id` attribution across all daemon SSE stream events (`TextDelta`, `ReasoningDelta`, `ToolCallStarted`, `ToolCallResult`, `Tokens`) for cross-tab and cross-device routing. Reconciled sidebar running state with the daemon's authoritative active chat registry every 12 seconds to completely eliminate stuck spinner indicators.
  - **Edit Tool 50% Similarity Gate & Universal Nested Markdown Promotion**: Enhanced capabilities edit tool with a 50% fuzzy match threshold gate and cross-file path detection, warning if an exact match exists in recently edited files. Promoted nested code fences universally across all programming languages (Rust, Python, Java, C#, C++, Go, Diff) and expanded `HASH_COMMENT_LANGS` preprocessor recognition to permanently prevent markdown truncation.

---

- **[性能加速与全端状态一致性] IndexedDB 会话大容量双层缓存、Git 单飞引擎保活、Steer队列持久化与通用Markdown健壮性增强**:
  - **IndexedDB 客户端会话缓存与冷启动直出**: 实现双层会话缓存架构（`sessionCache.ts`：L1 内存 LRU + L2 原生 IndexedDB），彻底打破 sessionStorage 的 5MB 配额枷锁，页面刷新 0ms 瞬间带图直出；配备空闲感知后台预热器（无打字时静默预加载 Top 3~5 会话并严格防重拉），支持 Ctrl+F5 彻底清空缓存逃生通道。
  - **Git 单飞引擎与抽屉 DOM Keep-Alive 保活**: 将右侧面板重构为 DOM 常驻保活（Keep-Alive），抽屉收纳切换 0ms 瞬间还原；引入项目级单例 `gitStore.ts` 配备 500ms 纯事件驱动防抖与 Inflight 原子单飞锁；后端 `api_git.rs` 深度优化，多仓库扫描 5 分钟 TTL 内存化，提交历史绑定 HEAD Hash 永久缓存，并发进程由 11 个压缩至 2 个，彻底终结 Windows 扫盘与 CPU 尖刺。
  - **提问历史跳转修复与画布 Ctrl+F 全量搜索重构**: 攻克提问大纲在热重载追加消息后点击毫无反应的致命缺陷，注入 `userIndexToOrdinal` 序数映射与大纲文本模糊兜底，附带脉冲高亮动效；全面重构对话画布 Ctrl+F 搜索，全量扫描用户提问、深度思考、正文、工具调用与输出，支持回车/上下箭头居中平滑跳转并自动展开命中的思考块。
  - **Steer 转向队列防丢与秒表防清零持久化**: 将运行中的 steer 队列与回合计时器时间戳安全落盘至 `sessionStorage`，彻底根治用户点击 steer 后刷新页面卡片离奇消失、左下角秒表重置从 0s 开始计时的重大 BUG。
  - **侧边栏蓝圈圈状态机与多会话 SSE 总线路由**: 后端 SSE 总线对外输出的所有细粒度事件（正文增量、思考过程、工具调用与结果、Token 统计）全面强制补齐 `session_id` 字段，打通跨端反向增量注入；在前端建立每 12 秒与后端权威活跃会话表自动对齐的幂等校准机制，彻底根除旋转菊花卡死。
  - **Edit 工具 50% 相似度守卫与多语言 Markdown 嵌套免疫**: 强化核心编辑工具，引入 50% 相似度门槛并联动最近修改文件交叉嗅探（若在最近文件 100% 命中则直接报警走错门，省掉 2 轮盲目重读）；WebUI 预处理器彻底打通所有编程语言（Rust, Python, Java, C#, C++, Go, Diff 等）的通用围栏提升，扩充 C#/C++ 预处理指令保护，排版彻底告别分叉吞字。

## v7.2.1-beta.7 (2026-10-10)

- **[Polling Storm Elimination & CPU Relief] Complete Eradication of Background Polling, Event-Driven Architecture, and Model Refresh Button**:
  - **Eradication of Aggressive Polling Storms**: Thoroughly eliminated `pollNotifyFocus` (500ms polling in `app.tsx`), stripped `getApprovalMode` and `listSessions` (`refreshNames`) out of `NotificationDock.tsx`'s periodic timer, and completely abolished the 5000ms polling timer in `Sidebar.tsx`. Network traffic in idle state drops to zero requests, completely extinguishing CPU spikes and memory churning.
  - **ModelSelector Manual Refresh Button & Reload Bus Sync**: Added an ergonomic physical refresh button (↻) in the model picker header next to the search box with smooth spinning animation feedback. Bound global event listeners (`jeikcode:config-reloaded` and `jeikcode:reload-models`) to silently re-fetch the model catalog whenever `jeikcode_config(action="reload")` is triggered, eliminating the 2000ms loop that repeatedly fetched an 18.6KB payload.
  - **Atomic Persistence & Inflight Cleanup for Bubble Mutations**: Fixed a critical issue where "Rewrite History", "Rollback & Submit", and "Delete Message" failed to take effect on disk after page refresh. Solved the physical index offset drift between compressed frontend bubbles and the underlying kernel message array by prioritizing `expected_text` reverse matching. Added automatic `manager.clear_inflight_snapshot(&id)` across mutation APIs (`truncate`, `patch`, `delete`) to prevent stale checkpoints from resurrecting deleted turns.
  - **Stop Button Optimistic Recovery & Anti-Bounce Guard**: Implemented immediate UI reset on clicking the stop square (`setBusyAndClock(false)`, `busyRef = false`, `transitionChatRecovery({ type: 'stop_succeeded' })`). Introduced a 2.5-second `manualStopGuardUntilRef` barrier preventing standby watch re-connections from misinterpreting daemon replay events during task termination as new turns.
  - **Long-Running Turn Clock Resume & Turn-Duplication Prevention**: Replaced `transcriptHasOpenUserTurn` gating in `startTurnClock` with `lastUserTs` epoch extraction, ensuring active turns spanning multiple minutes retain their real elapsed duration after reconnect/refresh instead of resetting to 0s. Refined `reconcileRunningTranscript` so existing turns are merged in place rather than erroneously appended to the bottom.
  - **Mobile Explorer Squeeze Guard & Drawer Turn-Nav Restoration**: Enforced `flex-shrink: 0; min-height: 180px;` and compact viewport rules (`@media (max-height: 640px)`) on `.dir-browser` in `CwdPicker` and `FilePicker`, preventing the directory tree from collapsing to 0px on narrow landscape screens. Removed mobile `.turn-nav { display: none; }` in right drawer mode so question navigation renders seamlessly on phones.

---

- **[轮询风暴清零与降温减负] 彻底拔除无脑高频轮询、事件驱动架构收敛与模型物理刷新按钮**:
  - **彻底清除多源恶性轮询风暴**: 坚决拔除 `app.tsx` 中每 500ms 一次的 `pollNotifyFocus` 死循环轮询；将 `NotificationDock.tsx` 中的审批模式与会话名拉取移出定时器；彻底删除 `Sidebar.tsx` 中每 5 秒跑 5 个接口的无脑轮询，全线切换为纯事件驱动与按需触发。空闲态网络请求直接清零，彻底平息守护进程与浏览器端 CPU 尖刺与发热。
  - **ModelSelector 物理刷新按钮与配置热重载联动**: 在模型选择弹窗顶部搜索框右侧新增物理刷新小按钮（↻），提供优雅的旋转反馈；彻底废除每 2 秒拉取 18.6KB 大包的死定时器，联动监听 `jeikcode:config-reloaded` 与 `jeikcode:reload-models`，在 `jeikcode_config(action="reload")` 热重载时静默对齐。
  - **气泡编辑/回溯提交/删除消息物理对齐与断点清理**: 修复了气泡历史改写、回溯并提交、删除消息仅在画布生效而刷新或重新提问后全盘失效的致命 Bug。解决了前端折叠展示气泡与底层物理消息数组物理索引偏移脱节（Offset Drift）的问题，全面强化 `expected_text` 逆向精准定位；在后端 `truncate`、`patch`、`delete` 接口落盘后无条件调用 `manager.clear_inflight_snapshot(&id)` 清理未决检查点，杜绝旧消息死而复生。
  - **停止按钮乐观秒回与防反弹屏障**: 点击红色停止方块时立即乐观复位（`setBusyAndClock(false)`、`transitionChatRecovery`），按钮零延迟变回白蓝色发送箭头；设立 2.5 秒的手动停止保护屏障（`manualStopGuardUntilRef`），杜绝待机监听重连将后端退出期间的重放事件误当新轮次弹回繁忙态。
  - **长任务断联刷新秒表防清零与防重复追加**: `startTurnClock` 修复为优先继承末尾用户提问的真实发送时间戳 `lastUserTs`，长任务断联刷新后秒表准确接续累积时间（绝不清零）；优化 `reconcileRunningTranscript` 对齐逻辑，已存在轮次就地合入 tail，坚决禁止将历史 1 2 3 轮次二次追加到画布最下方。
  - **移动端窄高资源管理器防塌缩与抽屉提问记录还原**: 为 `CwdPicker` / `FilePicker` 中的 `.dir-browser` 注入 `flex-shrink: 0; min-height: 180px;` 与 `@media (max-height: 640px)` 紧凑视口规则，彻底根除横屏手机或软键盘弹起时中间资源管理器被挤压消失的现象；修复移动端右侧检视抽屉中的 `.turn-nav` 样式穿透，提问大纲在手机端 100% 完整展示。



- **[Chat History Mutation & Branching] Inline Bubble Editing, Rollback & Re-generation, and Differential Session Bus (#27)**:
  - **Inline Bubble Editor with Steer Multi-Media Drop-back**: Introduced `InlineBubbleEditor` mirroring composer controls into history bubbles. Supports 1:1 multi-image drop-back, image upload, copy, and inline editing. Features dedicated dual actions: "Rewrite History" (in-place atomic disk update without re-generation) and "Rollback & Submit" (truncates subsequent turns and branches generation afresh with confirmation modal), as well as ESC/click-outside cancellation.
  - **Temporary Model Override & Assistant Turn Regeneration**: Added mini model selector within the bubble editor that temporarily overrides the model solely for the current edited turn without polluting global settings. Extended assistant response action rows with "Regenerate" (with confirmation dialog) and "Delete Response".
  - **Atomic Backend Mutation APIs & Conflict-Free Bus Fan-Out**: Mounted `PATCH /projects/:hash/sessions/:id/messages/:index`, `DELETE /projects/:hash/sessions/:id/messages/:index`, and `POST /projects/:hash/sessions/:id/truncate`. Integrated task fuse (`stop_and_wait`), dual-coordinate index resolution, atomic `save_snapshot` disk flush, and monotonic Revision Guard preventing duplicate deletions or ID misalignments. Broadcasts differential `ChatEvent::SessionMutation` over the unified event bus to all live and standby tabs without full-transcript reload.
  - **Mobile Responsive & Full i18n Alignment**: Enhanced dynamic layout for narrow viewports ($\le 768px$) with touch targets $\ge 36px$ and action bar folding. 100% synchronized tooltips, modals, and hints across English, Chinese, and Vietnamese.

---

- **[对话历史编辑与分支回溯] 气泡就地内联编辑、回溯重新生成与统一事件总线增量广播 (#27)**:
  - **内联气泡编辑器与 Steer 多媒体回退 1:1 复刻**: 全新开发 `InlineBubbleEditor` 内联气泡编辑器，1:1 复现 Steer 卡片的多图回填与上传逻辑；提供改写历史（原地原子落盘不触发重新生成）、回溯并提交（物理截断后续历史重新分支生成，带二次确认弹窗）与 ESC/点击外部取消复原。
  - **临时模型切换与助手回答重新生成**: 内联编辑器内置微型模型选择器，仅对本次编辑生成生效，不污染全局会话模型；助手最终回答操作栏新增「重新生成回答」（带确认弹窗）与「删除此回答」。
  - **后端原子落盘 API 与强一致性防冲突总线**: 挂载 PATCH/DELETE `/messages/:index` 与 POST `/truncate` 接口，集成任务熔断 (`stop_and_wait`)、双坐标寻址（绝对时间戳 + 位置兜底）、原子落盘 (`save_snapshot`) 与单调版本号 (Revision Guard) 防双重减库；通过统一事件总线 `ChatEvent::SessionMutation` 对在线异地实例仅广播差异变更，冷热启动数据绝对一致。
  - **移动端触控换行与三语全量适配**: 兼容移动端（$\le 768px$）与多尺寸窗口拖拽，操作栏自适应折叠；中、英、越三语 100% 对齐所有提示文字、按钮与确认弹窗。


## v7.2.1-beta.5 (2026-10-09)

- **[Performance & Cold-Start Acceleration] Static Asset HTTP Cache-Control, Dynamic Code Splitting, and Deferred Initialization**:
  - **Tiered HTTP Cache-Control for Embedded Assets**: Introduced standard Cache-Control headers in `crates/jeikcode-daemon/src/webui.rs`. Static hashed bundle assets under `/assets/*` are now marked with `Cache-Control: public, max-age=31536000, immutable`, enabling 0ms instant disk cache loading for both Tauri desktop shell (WebView2) and remote browser clients. Entry `index.html` strictly enforces `Cache-Control: no-cache` to guarantee atomic and immediate version updates without stale cache retention.
  - **Dynamic Lazy Loading & Code Splitting**: Extracted heavy secondary panels and dialogs (`GitPanel`, `DiffViewer`, `SettingsDialogs`, `UpdateDialog`, `ConfigSyncModal`, `OnboardingWizard`) into independent asynchronous chunks via `preact/compat` `lazy()` with smooth `<Suspense>` fallbacks, reducing the initial JavaScript main bundle from 894 kB down to 824 kB (over 70 kB core bundle reduction).
  - **Non-Critical Startup Deferred Execution**: Shifted post-upgrade configuration diff checks (`fetchUpgradeDiffs`) and update polling away from initial render frames, deferring them by 1.5 seconds to eliminate CPU and network contention during cold start first-paint.
  - **Remote Chunk Resilience**: Registered a global `vite:preloadError` listener in `webui/src/main.tsx` to automatically self-heal and refresh remote or LAN clients when server daemon upgrades invalidate stale chunk hashes.

---

- **[性能优化与冷启动加速] 嵌入式静态资源 HTTP 强缓存、前端动态按需分包与启动错峰调度**:
  - **嵌入式资源动静分级 HTTP 强缓存**: 在 `crates/jeikcode-daemon/src/webui.rs` 中为内嵌静态资源注入工业级 Cache-Control 响应头。`/assets/*` 目录下带内容哈希的静态文件（JS/CSS/字体）配置 `public, max-age=31536000, immutable`，实现桌面外壳（WebView2）与远程浏览器二次冷启动 0 毫秒磁盘直出；入口 `index.html` 强制 `no-cache`，确保发版更新时原子级无缝生效，绝不残留旧缓存。
  - **核心主包瘦身与模态框动态懒加载**: 将非首屏必需的重量级面板与弹窗（`GitPanel`、`DiffViewer`、`SettingsDialogs`、`UpdateDialog`、`ConfigSyncModal`、`OnboardingWizard`）全面重构为 `lazy()` 动态按需加载并配置平滑 `<Suspense>` 兜底，首屏 JS 主包由 894 kB 压缩至 824 kB（削减逾 70 kB 纯核心代码），显著加快 V8 编译与首帧挂载速度。
  - **首屏非核心检测错峰延迟**: 将升级配置覆盖比对 (`fetchUpgradeDiffs`) 移出首帧生命周期，推迟 1.5 秒与版本检测合并执行，消除冷启动初期本地线程与请求争抢，集中算力优先保障聊天主视图与历史记录瞬间呈现。
  - **异地与局域网版本自愈监听**: 在 `webui/src/main.tsx` 挂载 `vite:preloadError` 监听器，异地客户端或手机开着旧标签页经历服务端重启发版时自动自愈刷新，杜绝动态 chunk 404 脚本加载异常。


## v7.2.1-beta.4 (2026-10-09)

- **[Release Pipeline & CI Matrix] Multi-Architecture Matrix Parallelism, Global Rust Cache, and Runner De-congestion**:
  - **Full Matrix Parallelism**: Refactored release workflows to compile x86_64 and ARM64 targets concurrently on separate GitHub Actions runners across Linux, Windows, and macOS, eliminating sequential compilation bottlenecks and cutting critical-path build time by nearly half.
  - **Global Dependency Caching**: Integrated `Swatinem/rust-cache` across all compiler targets and Tauri desktop bundlers, enabling instant dependency reuse and caching upstream crates.
  - **Runner De-congestion & Dedicated Release Bandwidth**: Streamlined CI gating during release pushes to prevent redundant test execution and dedicate 100% runner capacity to release builds, while keeping full cross-platform regression suites intact.

- **[Turn Clock & Replay Synchronization] Accurate Session Resumption, Watch Timestamp Alignment, and Detached Chat Guard**:
  - **Daemon Replay Timestamp Calibration**: Extended `ActiveChatRegistry` to track exact millisecond operation start timestamps and propagate them into synthetic `ChatEvent::User` replay snapshots, preventing timestamp loss when background sessions stream without initial message metadata.
  - **Frontend Turn Clock Alignment**: Enhanced `Chat.tsx` turn clock anchoring to respect explicit message epochs on background watch reconnections, tab switching, and snapshot restoration, preventing elapsed timers from resetting or drifting.

---

- **[发布流水线与 CI 矩阵] 全架构矩阵真并行、全局 Rust 编译缓存与 Runner 算力解耦**:
  - **架构级矩阵真并行**: 全面重构 `build.yml`，将 Windows、Linux、macOS 的 x86_64 与 ARM64 目标彻底拆分为独立的 GitHub Actions 并行矩阵，消除单机串行等待瓶颈，关键路径编译等待时间缩短近半。
  - **全局 Rust 编译缓存**: 全面接入 `Swatinem/rust-cache@v2`，按 Target Triple 隔离缓存，实现三方依赖（tokio、serde、axum、tauri 等）毫秒级增量复用。
  - **Runner 配额智能避让**: 发版提交智能让路，消除多重流水线并发抢占 Runner，发版期间全量算力专享发版任务。

- **[回合时钟与重放定序] 毫秒级后台流时钟对齐、会话恢复精准校准与防飘移防护**:
  - **服务端重放时间戳校准**: 增强 `ActiveChatRegistry` 记录精确的毫秒级操作启动时间戳，补齐后台推送 `ChatEvent::User` 重放快照中的时间数据，杜绝重连缺少时间戳导致的假死与时钟错乱。
  - **前端回合计时器锚定**: 优化 `Chat.tsx` 中的 `adoptTurnUserTs` 与回合时钟初始化，在后台 Watch 重连、会话切换以及快照恢复时精准锚定用户提问时间点，保证计时器单调平滑递增且不跳变。


## v7.2.1-beta.3 (2026-10-09)

- **[Chat Architecture & Event Bus] Full Alignment with OpenCode Architecture: Unified Event Bus, Stateless RPC, and Entity State Machine**:
  - **Single Source of Truth Event Bus**: Deprecated legacy dedicated duplex streaming (`streamChat`) in WebUI, fully converging chat event reception onto the centralized broadcast event bus (`watchChatSession`). Re-architected daemon `POST /chat` as a high-performance stateless asynchronous RPC returning `202 Accepted`, and broadcasted all prompt submissions as `ChatEvent::User` through `fan_tx` with strict message coordinates (`message_id`, `turn_id`, `client_seq`).
  - **12-Entity Discrete State Machine**: Refactored `sessionStore.ts` into a declarative, monotonic entity state machine covering 12 message and interaction entity types. Replaced brittle optimistic text splicing with strict topological ordering for reasoning blocks and assistant streams, completely eliminating text tearing and inverted thinking-block rendering.
  - **Steer 4-State Lifecycle & Race Defense**: Standardized prompt steer states into `queued`, `consumed`, `cancelled`, and `superseded`. Completely eliminated frontend dual-stream mutual exclusion guards and redundant message replay locks, guaranteeing deterministic UI rendering across hot reconnects, multi-tab sync, and cold startups.

---

- **[对话架构与事件总线] 全面深度对齐 OpenCode 架构：单广播事件总线、无状态 RPC 触发与实体状态机**:
  - **唯一可信单广播事件总线**: 彻底下线 WebUI 历史专有双工流 (`streamChat`)，将所有消息交互全量收敛至唯一的广播事件总线 (`watchChatSession`)。将守护进程 `POST /chat` 改造为返回 `202 Accepted` 的高性能无状态异步 RPC，用户提问统一作为 `ChatEvent::User` 携带精准坐标元数据 (`message_id`、`turn_id`、`client_seq`) 经由 `fan_tx` 全局广播。
  - **12 实体离散状态机与防撕裂拓扑**: 重构 `sessionStore.ts` 为覆盖 12 种消息与交互实体的声明式状态机。为思考块 (`reasoning`) 与助手回复流建立严格的拓扑定序约束，彻底消除了并发流式传输中的乱序、文本撕裂与思考块倒置渲染风险。
  - **Steer 4 态生命周期与竞态防护**: 规范转向控制提示词为 `queued`、`consumed`、`cancelled`、`superseded` 四态流转。全面移除前端脆弱的双流互斥锁与重复消息重放保护，确保在热重连、多标签页并发及冷启动场景下的状态强一致性与确定性渲染。


## v7.2.1-beta.2 (2026-10-08)

- **[WebUI & Kernel Steer Control] Steer Cancellation Lifecycle, Monotonic Turn Deduplication, Composer Input History, and Auto-Follow Scrolling**:
  - **Steer Cancellation & Buffer Purge**: Introduced `AgentCommand::CancelSteer` in `jeikcode-kernel` and `cancel_steer` in `CodingRuntimeHandle` to purge unconsumed steer messages from the per-turn buffer and pending fallback queue. Added daemon `POST/DELETE /chat/steer/cancel` endpoints and WebUI `cancelChatSteer` API, ensuring that cancelling a queued steer card or clicking stop immediately clears the kernel buffer and prevents unexpected subsequent execution.
  - **Turn Replay Deduplication**: Replaced fragile greedy heuristics with a global monotonic match-pairs algorithm across `messages` and session cache using normalized `userTextsMatch`, preventing duplicate prompt insertion and freezing queue drain during session load. Fixed multiline regex bleeding in diff stats.
  - **Composer Input History**: Added bounded per-session/project in-memory composer history navigation via `Up`/`Down` arrow keys (`inputHistory.ts`), preserving multiline caret editing while deferring to autocomplete, IME, and modified keystrokes.
  - **Timeline Auto-Follow**: Introduced `timelineFollow.ts` to automatically pin scrolling to newest messages while preserving manual inspection positions when browsing older history.

- **[Capabilities & Tool Hardening] Interactive Bash Guard, Lossy Edit Rejection, and Deprecated Routing Removal**:
  - **Interactive Bash Detection**: Implemented proactive detection in `bash` tool to fail fast when interactive commands, pagers, or text editors (e.g. `vim`, `nano`, `top`) are invoked without non-interactive flags, providing helpful hints instead of hanging execution.
  - **Lossy Edit Rejection**: Enforced strict pre-application checks in `edit` tool to reject lossy recovery before modifying files. Preserved Windows venv launcher context in place.
  - **Deprecated Routing Removal**: Physically purged obsolete `shell_route.rs` and deprecated route hints from bash execution to eliminate dead code and unnecessary token overhead.

- **[i18n & Architecture] Comprehensive Vietnamese Localization, OS Detection, and Strict Agent Boundary**:
  - **Vietnamese Catalog**: Added full Vietnamese localization (`vi-VN`) across WebUI, TUIx phrasebooks, daemon, and onboarding.
  - **Cross-Platform OS Locale Detection**: Implemented 3-tier locale resolution: User Config > OS Auto-detection (Windows registry `LocaleName`, macOS `AppleLocale`, Linux `/etc/locale.conf`) > English Fallback baseline.
  - **Agent Core Purity**: Strictly isolated human-facing interfaces from agent internals—system prompts, tool definitions, schemas, and execution traces strictly remain native English.

---

- **[WebUI 与内核转向控制] 转向取消闭环与内核缓冲清除、单调轮次防重、输入历史回溯与平滑跟屏**:
  - **转向撤回与内核缓冲清理**: 在 `jeikcode-kernel` 中引入 `AgentCommand::CancelSteer`，在 `CodingRuntimeHandle` 中暴露 `cancel_steer` 控制方法，精准清除未消耗的每轮转向缓冲区与 fallback 队列。在守护进程中增加 `POST/DELETE /chat/steer/cancel` 端点，并在前端实现 `cancelChatSteer` API，使得用户点击取消转向卡片或点击停止键时立即清除内核缓冲区，彻底根绝下一小步被意外触发的问题。
  - **会话防重放与单调匹配**: 使用全局单调匹配对算法替换脆弱的贪心双指针比对，结合 `userTextsMatch` 规范化比对当前会话与全局缓存，杜绝重复提问气泡并在会话加载过渡期间冻结排队发送。修复 diff 统计中的多行正则穿透问题。
  - **输入框历史回溯**: 在 `inputHistory.ts` 中实现基于内存的会话级/项目级输入历史（支持方向键 `Up`/`Down` 快速召回历史输入），保留多行光标编辑并对齐自动补全与 IME 输入法行为。
  - **时间线自适应跟屏**: 引入 `timelineFollow.ts`，在有新输出时自动平滑滚动触底，而在用户手动回滚查阅历史记录时保持视口稳定不跳动。

- **[能力与工具强化] 交互式 Bash 挂起防护、失真编辑拒绝与废弃 Shell 路由物理清理**:
  - **交互式命令主动拦截**: 在 `bash` 工具中增加前置检测，对交互式命令、分页器与文本编辑器（如 `vim`、`nano`、`top`）实施快速失败拦截并给出明确提示，防止后台静默挂起。
  - **失真编辑拒绝**: 在 `edit` 工具中执行应用前检查，在任何代码块应用前拒绝失真恢复。在 Windows 虚拟环境中原地保留 venv 启动器上下文。
  - **废弃路由物理清理**: 物理删除已废弃的 `shell_route.rs` 模块及相关尾巴提示，精简底层工具说明与 token 消耗。

- **[多语言与架构纯正性] 越南语全栈本地化、操作系统语言自探测与 Agent 核心防污染**:
  - **越南语本地化支持**: 在 WebUI、TUIx 交互、守护进程与引导页面中全栈新增越南语（`vi-VN`）语言包。
  - **跨平台系统语言自探测**: 建立三层语言决策机制：用户显式配置 > 跨平台系统语言探测（Windows 注册表 `LocaleName`、macOS `AppleLocale`、Linux `/etc/locale.conf`） > 英语兜底基准。
  - **Agent 核心纯正原则**: 严格界定人机交互与 Agent 核心边界，多语言仅限人机交互界面，系统提示词、工具定义、架构 schema 与底层执行痕迹一律保持原生英文，杜绝翻译污染。

## v7.2.1-beta.1 (2026-10-08)

- **[WebUI & Canvas Replay] Steer-Safe User Message Deduplication, Robust Turn Projection, and Harmonious Reasoning Spacing**:
  - **Technical Root Cause**: When a mid-turn steer message was submitted, the canvas user tail became the steer message while the turn continued in-flight. On session switch, reconnect, or page refresh, the daemon replayed the admitted prompt of the ongoing turn via `/chat/watch`. Previous backwards-scanning heuristics mistakenly evaluated any subsequent user row as evidence of a settled historical turn, causing `userMessageAlreadyOnCanvas` to evaluate to `false` and re-appending the original user prompt at the bottom of the canvas below ongoing tool steps.
  - **Steer-Safe Turn Projection & Replay Defense**: Overhauled `userMessageAlreadyOnCanvas` in `chatTerminal.ts` to properly evaluate subsequent turns, recognizing that mid-turn steers and in-flight execution belong to the active turn. Fortified `paintUserMessage` in `sessionProjection.ts` with a canvas-wide `alreadyHasUserText` check, ensuring that unless explicitly marked with `repeatAfterSettled` by an idle observer watch, replayed prompts already on canvas are never duplicated at the bottom.
  - **Harmonious Reasoning Block Spacing**: Updated `.reasoning-block` styles in `app.css` with adaptive `margin: 12px 0 10px`, `:first-child { margin-top: 0 }`, and `.markdown-root + .reasoning-block { margin-top: 14px }`, eliminating cramped text-to-thinking transitions and creating balanced vertical rhythm across all prose and thinking segments.
  - **Verification & Testing**: Added unit tests in `sessionProjection.test.ts` verifying that replayed original prompts with multi-minute timestamp drifts and finished intermediate tool steps never duplicate user bubbles. Ran all 333 WebUI unit tests (100% pass) and completed clean production build (`tsc --noEmit && vite build`).

---

- **[WebUI 与会话投影] Steer 转向消息防重保护、稳态轮次投影与思考块垂直间距平衡**:
  - **技术机理 / 现象溯源**: 用户在生成中途发送 Steer 转向消息后，画布最新的用户消息变成了 Steer。当页面刷新或切换会话切回时，后端通过 `/chat/watch` 重放本轮被接受的初始提问。原回溯算法因在 Steer 之后发现已完成的中间工具步骤，误将初始提问判定为“已结算的历史旧轮次”，导致 `userMessageAlreadyOnCanvas` 误判为 `false`，从而在 Steer 和最新工具交互下方错误地再次追加原始提问气泡。此外，`.reasoning-block` 原 `margin-top: 0` 且富文本段落底间距为 0，导致正文接思考块时上下完全贴死。
  - **Steer 稳态投影与多端重放防线**: 重构 `chatTerminal.ts` 中的 `userMessageAlreadyOnCanvas`，精准识别中途 Steer 与在途轮次的归属关系；在 `sessionProjection.ts` 的 `paintUserMessage` 中筑牢 `alreadyHasUserText` 防线，确保在非 `repeatAfterSettled` 场景下，画布已有的提问绝不再次追加。
  - **思考块垂直排版间距优化**: 在 `app.css` 中为 `.reasoning-block` 增加自适应上外边距（`margin: 12px 0 10px`）、首节点顶间距归零（`:first-child { margin-top: 0 }`）以及 `.markdown-root + .reasoning-block { margin-top: 14px }`，彻底解决正文紧贴思考块的不协调感，恢复统一优雅的呼吸感排版。
  - **验证与交付**: 编写定向单测覆盖两分钟以上时间戳漂移及多步骤工具已结算场景下的 Steer 重放防重；全量 333 个前端单测 100% 通过；生产构建与类型检查 0 报错通过。

## v7.2.1-beta.0 (2026-10-08)

- **[Network & Remote Access] IPv6 Dual-Stack WebUI Binding, Universal Platform Interface Discovery, and RFC-Compliant Remote Access Surface**:
  - **Technical Root Cause & Architecture**: Historically, WebUI startup utilized `bind_scanning` with prebound listeners to resolve dynamic ports, but `run_server` hardcoded `dual_stack_v6` to `None` for prebound sockets while `bind_scanning` only bound IPv4. Consequently, WebUI instances never listened on IPv6, and the remote access panel only exposed IPv4 addresses.
  - **Dual-Stack Socket Implementation**: Overhauled `bind_scanning` and `run_server` to return and spawn primary and secondary listeners across both IPv4 (`0.0.0.0`) and IPv6 (`[::]`). Enabled isolated `IPV6_V6ONLY = true` on the secondary socket to prevent Windows dual-stack socket collisions and gracefully fallback to single-stack when IPv6 is unavailable.
  - **IPv6 Shareability & Address Ranking**: Implemented bitmask filtering in `ipv6_is_shareable` to strictly exclude loopback, multicast, link-local (`fe80::/10`), IPv4-mapped, and documentation prefixes, while allowing Global Unicast (GUA `2000::/3`) and Unique Local Addresses (ULA `fc00::/7`). Added `network_ip_rank` to prioritize primary LAN IPv4, followed by primary outbound IPv6, other GUA/ULA IPv6, and public IPv4.
  - **RFC 3986 URL Formatting & Cross-Platform Discovery**: Wrapped IPv6 hostnames in standard brackets (`http://[...]:port/?token=...`) across `format_access_url` and `ensure_webui`. Enhanced IPv6 parsing with CIDR mask stripping (`/64`) and added non-blocking interface inspection for Linux (`ip -o addr` / `ifconfig`) and macOS (`ifconfig`), paired with kernel routing table UDP dummy connect detection.

- **[WebUI & Session Projection] Isolated Multi-Session Active Streams and In-Place Reasoning Deduplication**:
  - **Technical Root Cause**: Rapidly switching between active sessions could cause local SSE stream controllers to leak or overlap, occasionally resulting in duplicate reasoning blocks or displaced user echoes when transitioning back to an active turn.
  - **Session-Scoped Stream Lifecycle**: Introduced `localActiveStreamsBySessionRef` and `pendingSelfEchoBySessionRef` in `Chat.tsx` to cleanly isolate abort controllers and pending echoes per session ID, ensuring clean handover and eliminating dual-stream race conditions.
  - **In-Place Reasoning Extension**: Fortified `paintAssistantReasoning` in `sessionProjection.ts` to detect existing identical or prefix reasoning parts, updating thinking content in place rather than appending redundant reasoning cards.

---

- **[网络与远程访问] WebUI IPv6 双栈全量绑定、多平台网卡探测与规范化远程面板发现**:
  - **技术机理 / 现象溯源**: 历史版本中 WebUI 启动为了支持动态端口分配采用了 `bind_scanning` 预绑定模式，但 `run_server` 在接收预绑定监听器时将次级 IPv6 监听器硬编码置为 `None`，同时 `bind_scanning` 仅单向绑定 IPv4。这导致 WebUI 实例完全未监听 IPv6，且地球图标远程访问面板仅展示 IPv4 地址，公网与局域网 IPv6 无法直连。
  - **双栈 Socket 分离与实现防线**: 重构 `bind_scanning` 与 `run_server`，使其在通配地址（`0.0.0.0` 与 `::`）下同时生成主监听器与次级双栈监听器。显式启用 `IPV6_V6ONLY = true` 分离双栈 Socket，规避 Windows 下 `[::]` 占用导致 IPv4 冲突的系统级陷阱，并在 IPv6 不可用时优雅回退。
  - **规范化地址过滤与优先级矩阵**: 在 `ipv6_is_shareable` 中采用严格位掩码过滤，精准剔除链路本地（`fe80::/10`）、IPv4 映射、组播、回环及测试网段，仅放行全球单播公网地址（GUA `2000::/3`）与唯一本地地址（ULA `fc00::/7`）。引入 `network_ip_rank` 形成“局域网私网 IPv4 -> 首选出网 IPv6 -> 其余 GUA/ULA -> 公网 IPv4”的清晰权重梯队。
  - **RFC 3986 标准中括号包裹与跨平台发现**: 在 `ensure_webui` 终端输出与面板链接中全面为 IPv6 补充中括号包裹；增强对 Linux CIDR 掩码（`/64`）的截断兼容，并为 Linux 与 macOS 补充带超时保护的接口探测，结合 UDP 路由选路全面覆盖各种复杂双栈网络拓扑。

- **[WebUI 与会话投影] 会话级流生命周期隔离与思考块就地去重**:
  - **技术机理 / 现象溯源**: 快速切换不同会话标签页时，未隔离的全局活跃流控制器容易在异步回调中产生跨会话干扰，导致重切回活跃会话时出现重放流重叠或思考过程卡片重复追加。
  - **会话级流生命周期隔离**: 在 `Chat.tsx` 中建立 `localActiveStreamsBySessionRef` 与 `pendingSelfEchoBySessionRef`，按会话 ID 严格隔离 AbortController 与回声去重队列，杜绝会话交替时的并发流污染。
  - **思考块防重与就地扩展**: 升级 `sessionProjection.ts` 中的 `paintAssistantReasoning` 防线，当新到推理片段包含在已有思考块中或为其更长前缀时，执行原地更新而非新建卡片，彻底根除思考块重复渲染。

## v7.2.0 (2026-10-08)

- **[Core Tools Overhaul & Robustness] Unified and Streamlined Tool Architecture, Enhanced `read` & `grep`, Deterministic Shell Execution, and LLM Glob Normalization**:
  - Streamlined the built-in toolset into canonical primitives, retiring fragmented helpers and consolidating all configuration guide and reload actions under `jeikcode_config`.
  - Unified codebase exploration into a modern, all-in-one `read` tool, permanently retiring the legacy `codeintel::repo_map` module. The new `read` tool seamlessly handles multi-hundred-line safe reads, directory trees, images, and centered keyword matching (`key_string`) with customizable upward and downward contexts.
  - Enhanced `grep` with multi-mode outputs (`content`, `files_with_matches`, `count`), dedicated context lines control (`context`, `before_context`, `after_context`), unified regex parsing, and word-boundary matching.
  - Hardened `glob` pattern matching with automatic `./` and `././` prefix stripping, backslash-to-slash normalization on Windows, empty pattern fallback to `*`, and strict subdirectory confinement.
  - Overhauled `run_command` terminal execution: eradicated heuristic shell guessing in favor of deterministic execution, added explicit workspace-relative `cwd` support, hardened MSYS2 and Git Bash path injection, provided native UTF-16LE PowerShell support on Windows (`shell: "powershell"`), and introduced process grace windows (`settle_secs`) with idle timeouts.
  - Revamped tool parameter validation with multi-field and hierarchical diagnostic reporting, delivering comprehensive and actionable error messages in a single turn.

- **[Prompts & Agentic Workflow Discipline] Overhauled Core System Prompts, Reinforced Operational Discipline, Stable High-Concurrency Tool Dispatch, and Aggressive Reading Strategy**:
  - Completely redesigned system prompts and workflow discipline across `rules.yaml` and `system.yaml`, enforcing strict task boundary awareness, atomic commit discipline, and checklist closure verification.
  - Enhanced multi-turn reasoning and tool invocation pipelines to launch independent tool calls (file inspections, grep searches, subagent tasks) in parallel concurrently whenever no data dependency exists, drastically reducing interaction latency.
  - Mandated wide-window context reading (reading several hundred lines or entire files in a single pass) to build a comprehensive mental model upfront, eliminating fragmented blind edits and incomplete inspections.
  - Hardened in-flight steer prompt guidance to safely incorporate user priority pivots without losing existing execution checklists or mid-edit consistency.

- **[CodeIntel & CodeGraph] Multi-Ecosystem Source Protection, Context-Aware MSBuild Pruning, and Adaptive Workspace Indexing**:
  - Purged all obsolete `codeintel::repo_map` references across the codebase and user configuration templates.
  - Unlocked language-level executable and toolchain source bins, preserving Rust crate binaries (`src/bin/*.rs`), Ruby tools (`bin/rails`), and Node entrypoints (`bin/cli.js`) from accidental exclusion.
  - Reclaimed ASP.NET/Blazor `wwwroot` web assets and hand-written legacy C# metadata (`Properties/AssemblyInfo.cs`), pruning only generated assembly attributes and context-situated build folders (`Debug`/`Release` directly nested under `bin/` or `obj/`).
  - Expanded standardized `.codegraphignore` ignore presets across modern ecosystems, including .NET SDK artifacts, Elixir/Erlang (`_build`, `deps`), Flutter (`.dart_tool`), Zig (`zig-cache`, `zig-out`), Haskell (`.stack-work`), Swift/Xcode (`.build`, `DerivedData`), Unreal Engine (`Binaries`, `Intermediate`), CocoaPods, and root-anchored Unity editor caches (`/Library/`).
  - Enabled automatic index generation for single-repository workspaces, improved guidance for unindexed workspaces, and wired bundled ignore template updates into config diff review.

- **[WebUI & Visual Polish] Refined Charcoal Palette, Streamlined Single-Line Composer, Interactive Mermaid Diagrams, and VSCode-Style Git Inspector**:
  - Completely redesigned the WebUI color palette inspired by Gemini, adopting an eye-friendly, deeply immersive charcoal canvas and setting dark mode as the default experience.
  - Redesigned the composer input box into a sleek, minimalist single-line pill, removing redundant menus and introducing a prominent live green-lightning token telemetry badge.
  - Integrated full interactive Mermaid diagram rendering for architecture topologies, flowcharts, and sequence diagrams directly in chat streams.
  - Overhauled the Git panel with a VSCode-style commit hover details card, a responsive Git Graph visualization, and a compact action menu.
  - Resolved nested Markdown code block fragmentation and double-fence rendering glitches.

- **[Mobile Experience] Comprehensive Mobile-First UI Overhaul, Touch Navigation, and Resilient Connection Architecture**:
  - Implemented an adaptive top navigation bar that automatically condenses and stacks controls on smaller mobile screens, preventing overlapping and visual clutter.
  - Optimized mobile virtual keyboard interaction: Enter key defaults to soft newlines, composer cleanly docks above the keyboard, and viewport resizes smoothly without jumpiness.
  - Introduced a dedicated Mobile Approval Dock with optimized touch targets, thumb-friendly button placement, and bottom anchoring to eliminate accidental taps.
  - Hardened mobile reconnection: seamlessly reconnects SSE streams and synchronizes authoritative session state upon app foregrounding or network transitions without screen blanking.
  - Fixed chat bubble displacement and scroll jittering during live generation and turns replaying on mobile viewports.

- **[Remote Browsing & Workspace Sync] Seamless Remote Directory Selection, Multi-Observer Project Synchronization, and Windows Verbatim Path Normalization**:
  - Replaced native OS directory dialog blocking on remote browser sessions with a built-in, responsive in-page directory picker, while preserving native file dialogs for local loopback connections.
  - Added user confirmation for project removal/hiding in the sidebar while strictly preserving session data on disk.
  - Introduced persistent sidebar project synchronization via `GET/POST /projects/sidebar`, syncing pinned and hidden project states across multiple tabs, devices, and observers in real time.
  - Implemented automatic recovery of running projects: background sessions actively executing a turn automatically resurface and expand in the sidebar with live progress indicators.
  - Stripped Windows extended verbatim path prefixes (`\\?\`, `//?/`, `/?/`) prior to breadcrumb generation and routing, preventing broken paths and hash partition mismatches.

- **[Session Architecture & Daemon Robustness] Direct Session Deep-Linking, Retirement of Legacy Sync Streams, Hardened Permissions, and Disk Quota Governance**:
  - Enhanced the TUI `/webui` command to pass the active session ID directly in the launcher URL (`&session=<id>`), enabling immediate browser navigation to current in-flight tasks.
  - Permanently retired legacy dual-stream synchronization (deprecated `/sync` slash command, `?sync=1` URL flags, and background disk polling), consolidating all real-time canvas updates onto unified `/chat` and `/chat/watch` SSE pipelines.
  - Hardened approval permission handling: instant one-click card dismissal, asynchronous response confirmation awaiting, and strict response correlation to prevent duplicate toasts or cross-session misrouting.
  - Hardened daemon security boundaries, path confinement, and session isolation.
  - Disabled overly verbose data logs by default, enforced hard disk storage quotas to prevent disk exhaustion, and provided automatic legacy configuration migration.
  - Synchronized authoritative Todo item status across all clients, fixing glyph imports in completion reminders.
  - Standardized universal Agent Skills discovery under plural `.agents/skills` directories across project and global hierarchies.

- **[Docs, CI/CD & Engineering Discipline] Full-Stack Docs Refresh, Hardened Native CI Matrix, and Upgraded Release Infrastructure**:
  - Revamped the official documentation website: elevated built-in tools to top-level navigation parallel with CodeGraph, condensed architecture overviews, and updated remote deployment security guides.
  - Hardened cross-platform desktop bundles on Linux x64 with unified Ubuntu 22.04 / 24.04 compatibility and reproducible build gates.
  - Automated multi-crate workspace version bumping in `Cargo.lock`.
  - Coupled `tsc --noEmit` into `npm run build` as an automated type-checking gate, preventing invisible frontend regressions.
  - Fixed CI workflow YAML command-string quoting and standardized Node test imports with explicit `.ts` specifiers.
  - Adopted a standardized Pull Request template (`.github/PULL_REQUEST_TEMPLATE.md`) to maintain strict review hygiene and self-contained commits.

---

- **[核心工具体系大精简与鲁棒性全面加固] 工具链收敛规范化、全能 `read` 与高级 `grep`、确定性命令执行与大模型 Glob 模式高容错适配**:
  - 全面精简核心内置工具链：废除碎片化的冗余辅助工具，将配置指引与配置热重载功能统一收敛至 `jeikcode_config` 工具下。
  - `read` 工具全能化统一：彻底淘汰旧式独立的 `codeintel::repo_map` 模块，将大范围安全读文件、目录树探查、多模态图片阅读全量收敛至 `read` 工具；新增 `key_string` 关键字居中匹配与上下文透视（`upward`/`downward`），格式全面对齐纯文本以极度节省大模型 Token 开销。
  - `grep` 工具全面增强：支持多模式输出（`content` 包含行号与上下文、`files_with_matches` 仅文件路径、`count` 统计匹配行数），支持独立的上下文行数控制（`context`、`before_context`、`after_context`），统一正则表达式与单词边界匹配机制。
  - `glob` 路径匹配兼容性防线：自动循环剥离大模型习惯性生成的 `./` 与 `././` 相对前缀；无条件规范化 Windows 反斜杠 `\` 为 `/`，规避正则转义歧义；空匹配模式（如纯 `./`）自动安全回退为 `*` 通配符；严格限定子目录匹配作用域，防止意外泄露根目录同名文件。
  - `run_command` 终端与命令执行重大架构加固：彻底废除不可靠的启发式 Shell 猜测，改为确定性分层路由；新增 `cwd` 工作目录参数，相对路径严格相对于工作区根目录解析；Windows 环境原生支持 `shell: "powershell"` 原生运行 PowerShell 脚本（UTF-16LE 直通），深度加固 MSYS2 与 Git Bash 分层 PATH 注入；引入进程启动宽限期（`settle_secs`）与空闲静默杀死策略，防御终端劫持。
  - 参数校验反馈机制重大升级：支持多字段（multi-field）与深层级（hierarchy）结构化错误诊断反馈，参数填写有误时一次性返回完整定位指引，消除单字段反复重试的死循环。

- **[系统提示词与 Agent 工作流纪律] 全新优化核心提示词、强化执行纪律、无依赖全并发调度与激进式上下文读取策略**:
  - 全面升级 `rules.yaml` 与 `system.yaml` 基础提示词体系，确立严格的任务范围意识（Task Scope Awareness）、原子化提交与清单闭环原则。
  - 全面优化多轮推理与工具调用链路，支持在无数据依赖时全并发发射独立工具调用（文件读取、grep 检索、子智能体派发等），大幅削减等待时延。
  - 确立大范围安全读取标准（Read Generously），单次调用鼓励阅读数百行乃至全量文件，快速构建完整代码认知全局图景，彻底杜绝盲目小步试探与片段式猜解。
  - 增强飞行中即时转向（Steer）提示词规范，保障用户中途调整需求时平滑挂起、优先级智能插队与上下文连贯恢复。

- **[代码智能与图谱引擎] 多语言生态源码资产保护、MSBuild 构建产物精准剪枝与自适应索引引导**:
  - 彻底清除全仓代码与用户配置模板中对已废弃 `codeintel::repo_map` 的全部引用。
  - 解绑粗暴拦截裸 `bin/` 的规则，完整放行各语言生态可执行源码：保留 Rust 二进制 crate 源码（`src/bin/*.rs`）、Ruby 命令行脚本（`bin/rails`）和 Node/npm 入口脚本（`bin/cli.js`）。
  - MSBuild 产物路径上下文感知过滤：仅当 `Debug`、`Release`、`RelWithDebInfo`、`MinSizeRel` 位于 `bin/` 或 `obj/` 层级下时才执行剪枝；解禁 ASP.NET/Blazor 的 `wwwroot` 静态源码；精准保留手写 `Properties/AssemblyInfo.cs`，仅过滤自动生成的 `*.AssemblyAttributes.cs`。
  - 全生态构建忽略规则库全面扩充：在 `.codegraphignore` 中原生补齐 .NET SDK artifacts、Elixir/Erlang（`_build`, `deps`）、Flutter（`.dart_tool`）、Zig（`zig-cache`, `zig-out`）、Haskell（`.stack-work`）、Swift/Xcode（`.build`, `DerivedData`）、Unreal Engine（`Binaries`, `Intermediate`）、CocoaPods 及根目录 Unity 编辑器缓存（`/Library/`）。
  - 单仓自适应索引与配置差异比对：单工程工作区无需额外干预即可自动构建图谱索引；内置 `.codegraphignore` 模板种子更新接入 `scan_jeikcode_config_diffs`，供用户透明审查同步。

- **[WebUI 颜值重构与深色交互美学] 灵感源自 Gemini 的高级炭灰调色板、极简单行输入框、交互式 Mermaid 图表与 VSCode 风格 Git 检视器**:
  - 深度重构 WebUI 调色板：汲取 Gemini 界面质感，默认启用护眼且沉浸的高级炭灰深色美学（eye-friendly charcoal canvas）。
  - 极简 Composer 输入框重构：流线型单行胶囊设计，剥离冗余折叠菜单，引入灵动醒目的绿色闪电（green-lightning）Token 实时监测徽标。
  - 交互式 Mermaid 图表支持：在对话画布中直接渲染交互式架构图、时序图与流程图。
  - Git 面板全套体验升级：引入 VSCode 风格的 Commit 悬停详情浮窗卡片，新增响应式 Git Graph 可视化提交拓扑图与紧凑型操作菜单。
  - 修复 Markdown 嵌套代码块碎裂与反引号（double-fence glitch）渲染瑕疵。

- **[移动端深度优化与触控体验飞跃] 顶栏自适应收纳排布、输入键盘平滑贴合、移动端专属审批停靠坞与断线韧性重连**:
  - 顶栏自适应收纳排布：小屏幕视口下自动折叠收纳顶部导航与工具栏，彻底消除拥挤遮挡。
  - 移动端虚拟键盘与输入体验加固：移动端点击回车默认换行，输入框平滑吸附键盘上方，视口弹性贴合无跳变。
  - 移动端专用审批停靠坞（Mobile Approval Dock）：重构权限审批浮层，优化触控靶心大小与吸边排布，彻底消除手机端误触。
  - 移动端断线韧性重连（Mobile Reconnect）：移动端切换后台或网络波动恢复后，自动重建连接并平滑同步最新会话状态，杜绝界面白屏与数据脱节。
  - 气泡防抖与滚动稳固：防止移动端消息流由于重绘导致的对话气泡位移与视觉跳变。

- **[远程浏览器体验与多端工作区项目同步] 远程环境内置网页目录选择器、跨端项目侧边栏同步与 Windows 驱动级路径规范化**:
  - 远程浏览器选目录无缝支持：彻底解决远程浏览器访问时点击“添加目录”触发服务器端原生不可见弹窗导致请求卡死的顽疾；远程环境自动切为网页端内置目录浏览器，本机访问保留原生文件选择器。
  - 侧边栏项目管理防误触与持久化同步：新增项目隐藏/移除安全二次确认，绝对不删磁盘会话文件；`GET/POST /projects/sidebar` 实现置顶与隐藏状态在多设备、多标签页、多观察者之间实时双向同步。
  - 运行中项目智能拉回：后台若有正在执行的活跃回合，被隐藏的项目会自动恢复至侧边栏并展开，带有加载动画，历史会话无损呈现。
  - Windows 扩展路径标准化：自动剥离 `\\?\`、`//?/`、`/?/` 等 Windows 驱动级扩展前缀，修复面包屑导航显示问号及跨平台路径哈希错位问题。

- **[会话流架构收敛与守护进程鲁棒性防线] 会话直连开箱即用、废弃冗余同步流、审批流精准关联与磁盘日志配额治理**:
  - TUI `/webui` 会话无缝直达：在 `/webui` 命令生成的 URL 中自动携带当前活跃会话短 ID（`&session=<id>`），打开浏览器直开对应任务。
  - 废弃历史遗留同步流：彻底移除 `/sync` 斜杠命令、`?sync=1` 参数及磁盘后台轮询，将全量会话同步统一收敛至高性能的 `/chat` 与 `/chat/watch` 画布 SSE 流。
  - 审批流（Approval）精准关联防线：强化权限请求与响应的相关性匹配，首击即消（instant dismissal），彻底解决多端会话切换时飞行中工具触发的重复审批通知 Bug。
  - 守护进程安全边界加固：强化进程、路径边界与沙箱访问权限，杜绝恶意跨路径或跨会话读取。
  - 数据日志磁盘硬配额：默认禁用详尽 datalog，增加磁盘硬配额限制，杜绝长时间运行占满磁盘空间；自动无感迁移老旧配置格式。
  - Todo 待办权威状态同步：跨端同步待办列表最终态，修复完成提醒中的字形导入异常。
  - 通用 Skills 规范对齐：统一采用复数 `.agents/skills` 约定，支持全层级技能自动发现与挂载。

- **[官方文档、CI/CD 与工程规范全方位升级] 官网结构与导航焕新、桌面端跨平台打包加固与严密类型门禁**:
  - 官网结构与指引升级：重排文档侧边栏，内置工具与代码图谱并列首位，精简架构说明，更新远程部署安全指南。
  - 跨平台编译与构建加固：修复 Ubuntu 22.04 / 24.04 Linux 桌面端打包兼容性，建立可复现构建防线。
  - 自动化版本联动：多 crate 工作区版本自动级联同步更新至 `Cargo.lock`。
  - 类型安全前置检查：将 `tsc --noEmit` 固化为 WebUI 构建前置门禁，彻底杜绝前端隐式类型回归。
  - CI 命令转义与单元测试修复：修复 CI 脚本中命令字符串带空格时的解析报错，完善 Node 单测覆盖与规范化导入。
  - 引入规范化 PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`），严明分支与开发协作规约。

## v7.2.0-beta.11 (2026-10-08)

- **[WebUI / Node Test Imports] Give `api.ts` an explicit `.ts` import for `displayPath` so `node --test` can load the module**:
  - **Technical Root Cause / Detail**: `api.ts` imported `./lib/displayPath` without an extension. Vite resolves that form, but the WebUI CI job runs `node --test`, which requires a resolvable ESM specifier. All 25 `api.test.ts` cases failed with `ERR_MODULE_NOT_FOUND` and blocked the beta.10 CI gate.
  - **Implementation Mechanism**: Changed the import to `./lib/displayPath.ts`, matching the rest of the Node-tested library modules under `webui/src/lib/`.
  - **Verification & Testing**: `node --test src/api.test.ts src/lib/displayPath.test.ts` — 34 passed. `cargo check --lib -p jeikcode-daemon` succeeded.

---

- **[网页 / Node 单测导入] 给 `api.ts` 的 `displayPath` 补上 `.ts` 后缀，让 `node --test` 能加载模块**:
  - **技术机理 / 现象溯源**: `api.ts` 写成了无后缀的 `./lib/displayPath`。Vite 能解析，但 WebUI CI 用的 `node --test` 不行，导致 `api.test.ts` 25 条全部 `ERR_MODULE_NOT_FOUND`，beta.10 CI 被拦住。
  - **实现防线 / 核心改动**: 改为 `./lib/displayPath.ts`，与 `webui/src/lib/` 下其他 Node 单测模块一致。
  - **验证与交付**: `api.test.ts` 与 `displayPath.test.ts` 共 34 条通过；`cargo check --lib -p jeikcode-daemon` 通过。

## v7.2.0-beta.10 (2026-10-08)

- **[WebUI & Daemon / Sidebar Projects] Confirm project removal, sync the list across observers, and bring a running project back**:
  - **Technical Root Cause / Detail**: The sidebar trash control wrote a browser-local hide set and removed the row immediately, so other tabs and machines never saw the change. Clicking add-folder called the daemon native folder dialog, which blocks the HTTP request on the instance; a remote browser waited on a dialog it could not see. After a folder was chosen, the client only opened a blank chat and left a previously hidden project off the list, so historical sessions never returned. Windows extended paths (`\\?\`, `//?/`, `/?/`) were split into a literal `?` breadcrumb and could hash into a different session bucket.
  - **Implementation Mechanism**: `POST /projects/sidebar/hide|show|reveal` plus `GET /projects/sidebar` persist pin and hide state beside the session catalog. Hiding asks for confirmation and keeps session files. A live turn unhides that project on the next sidebar read and on the client that sees `/chat/active` or optimistic output; the row expands, its sessions reload, and running sessions stay pinned with the spinner. Loopback pages still use the native picker; any other host opens the in-page directory browser. `strip_verbatim` and the webui path helpers collapse extended prefixes before breadcrumbs, joins, and `/cd`.
  - **Verification & Testing**: `node --test webui/src/lib/displayPath.test.ts` covers `E:/`, `D:/`, `\\?\`, `//?/`, and `/?/`. `cargo test -p jeikcode-capabilities --lib pathnorm::tests` passed. Sidebar hide/show unit tests live in `sidebar_projects`; the webui production build and a live remote-browser pass were not run in this workspace.

---

- **[网页与守护进程 / 侧栏项目] 移除项目需确认，列表在各观察者之间同步，运行中的项目会回到左侧**:
  - **技术机理 / 现象溯源**: 垃圾桶原先只写浏览器本地隐藏集合并立刻删行，其他标签页和机器看不到。加号走守护进程上的原生选目录，异地浏览器会一直等到实例机上那个看不见的对话框关掉。选完目录后右侧只开一个空会话，已被隐藏的项目不会回到左侧，历史会话也不出现。Windows 的 `\\?\`、`//?/`、`/?/` 会被拆成问号面包屑，并可能落进另一个会话桶。
  - **实现防线 / 核心改动**: `GET/POST /projects/sidebar` 把置顶和隐藏记在会话目录旁。隐藏先确认，不删会话文件。回合仍在跑时，侧栏读取和看到活跃会话的客户端会把该项目展开并拉回会话，转圈条目置顶。本机回环地址仍用原生选目录；其他主机打开网页目录浏览器。扩展路径前缀在面包屑、拼接和 `/cd` 之前被剥掉。
  - **验证与交付**: `displayPath` 单测覆盖 `E:/`、`D:/` 与三种扩展前缀；`pathnorm` 单测已通过。侧栏隐藏/显示单测在 `sidebar_projects`。本次未跑网页生产构建，也未在真实异地浏览器里点选。

## v7.2.0-beta.9 (2026-10-07)

- **[Tools & Capabilities / Glob Input Normalization & Pattern Compatibility] Harden `glob` pattern normalization for LLM path prefixes, Windows delimiters, and empty fallback semantics**:
  - **Technical Root Cause / Detail**: Large Language Models habitually formulate file glob queries with leading relative path prefixes (e.g., `./*.rs`, `./src/**/*.ts`) or Windows native separators (`.\\src\\*.rs`). In previous implementations, `GlobBuilder` evaluated patterns with `literal_separator(true)` strictly against walkdir relative paths (which do not contain `./` prefixes). This mismatch led to silent empty result sets for common model queries. Furthermore, Windows backslashes (`\`) were vulnerable to being misinterpreted as regex/glob escaping characters rather than directory delimiters.
  - **Implementation Mechanism**: Introduced `normalize_match_pattern` in `crates/jeikcode-capabilities/src/tools/glob.rs`:
    1. Unconditionally normalizes backslashes (`\`) to forward slashes (`/`) to eliminate Windows path escaping hazards;
    2. Repeatedly strips leading `./` path components (`strip_prefix("./")`), harmonizing relative model queries (such as `./*.toml` or `./nested/*.rs`) with canonical directory walk paths;
    3. Gracefully maps empty stripped queries (e.g., `./`) to `*` to safely enumerate base directories without triggering matcher errors or empty responses.
  - **Verification & Testing**: Added comprehensive unit tests in `tools::glob::tests` covering `./*.toml`, repeated `././`, Windows `.\\src\\*.rs`, nested path confinement (`./nested/*.rs` strictly scoping into subdirectories), and shipped `.codegraphignore` asset integration tests (`shipped_ignore_keeps_source_bins_in_glob`).

- **[CodeIntel & CodeGraph / Multi-Ecosystem Source Protection & MSBuild Output Pruning] Decouple bare `bin/` directory pruning, protect language source bins & ASP.NET assets, expand multi-language build ignores, and enable config sync diff tracking**:
  - **Technical Root Cause / Detail**: A naive bare `bin/` entry in `.codegraphignore` and the engine's hardcoded `SKIP_DIR_NAMES` caused catastrophic collateral damage across multiple language ecosystems: Rust binary crates (`src/bin/*.rs`, `src/bin/<name>/main.rs`), Ruby executable toolchains (`bin/rails`, `bin/setup`), and Node npm binary entrypoints (`bin/cli.js`) were entirely dropped from semantic indexing and symbol navigation. Similarly, ASP.NET/Blazor web assets under `wwwroot` (e.g., `site.js`, CSS) were prematurely suppressed as build dumps, and hand-written legacy .NET metadata in `Properties/AssemblyInfo.cs` was indiscriminately filtered out alongside generated assembly attributes. Moreover, modern ecosystems (Elixir, Flutter, Zig, Haskell, Swift, Unreal, Unity) lacked standardized build/cache pruning.
  - **Implementation Mechanism**:
    1. **Context-Aware MSBuild Pruning**: Pruned bare `"bin"` and configuration names (`"Debug"`, `"Release"`) from `SKIP_DIR_NAMES`. Replaced them with context-aware `should_prune_index_dir` and `parent_name_is_bin_or_obj`, specifically targeting `Debug`, `Release`, `RelWithDebInfo`, and `MinSizeRel` only when situated under `bin/` or `obj/` hierarchies (supporting multi-target/architecture outputs like `App/bin/x64/Release`), while keeping top-level and source-level `bin/` trees intact;
    2. **Source Asset Reclamation**: Removed `wwwroot` from `SKIP_DIR_NAMES` to retain ASP.NET web sources, and narrowed generated C# filtering in `is_generated_source` from all `assemblyinfo.cs` to `*.AssemblyAttributes.cs`, preserving hand-written `Properties/AssemblyInfo.cs`;
    3. **Multi-Ecosystem Ignore Hardening**: Expanded `.codegraphignore` to cover .NET SDK artifacts (`**/artifacts/bin/`, `**/artifacts/obj/`), Elixir/Erlang (`_build/`, `deps/`), Flutter (`.dart_tool/`), Zig (`zig-cache/`, `zig-out/`), Haskell (`.stack-work/`, `dist-newstyle/`), Swift (`.build/`, `DerivedData/`), Unreal Engine (`Binaries/`, `Intermediate/`, `DerivedDataCache/`), CocoaPods (`Pods/`), and root-anchored Unity editor cache (`/Library/`);
    4. **Config Sync Diff Tracking**: Clarified `CodeExploreTool::seed_fork_defaults` asset seeding lifecycle so updates to bundled ignore assets (`.codegraphignore`) are exposed through `scan_jeikcode_config_diffs` for safe, transparent user-reviewed synchronization.
  - **Verification & Testing**: Validated with `codeintel::index::tests::skips_msbuild_output_but_keeps_source_bins` asserting that Rust `src/bin`, npm `bin/`, ASP.NET `wwwroot`, and `AssemblyInfo.cs` are indexed while `App/bin/Debug` and `App/bin/x64/Release` remain pruned.

- **[WebUI & TUI Architecture / Direct Session Binding & Deprecated Sync Stream Retirement] Pass current session to WebUI launcher, consolidate canvas streaming to `/chat` and `/chat/watch`, and eliminate obsolete `/sync` commands**:
  - **Technical Root Cause / Detail**: Previously, the `/webui` command opened a generic browser window without session binding, requiring users to locate their active session manually. Meanwhile, a legacy dual-stream sync architecture (`/sync`, `?sync=1`, `postLiveSwitchSession`, background disk polling) created race conditions and UI flickering against the unified SSE stream.
  - **Implementation Mechanism**: Updated `ensure_server_and_open` in `crates/jeikcode-daemon` to accept `session_id: Option<&str>` and append `&session=<short_id>` so TUI's `/webui` command immediately opens the user's active session. Permanently removed the obsolete `/sync` slash command, its i18n entries, and `CreateSessionRequest.sync` broadcast logic; prioritized `/sessions` over `/setup` in TUI completion prefix matching. Unified WebUI canvas streaming onto `/chat` and `/chat/watch`, cleaning up leftover `?sync=1` URL parameters upon mounting, and refined `paintUserMessage` in `sessionProjection.ts` to ensure Working placeholders render correctly during watch mode while preventing duplicate user message echoes.
  - **Verification & Testing**: Verified `cargo check --lib -p jeikcode-daemon`, `cargo check --bin jeikcode`, passed `commands::tests::s_prefix_lists_sessions_before_setup`, executed full webui suite (323 tests passed via `npm test`), and built production assets via `npm run build`.

---

- **[工具与能力层 / Glob 输入规范化与路径匹配兼容性防线] 强化 `glob` 模式规范化，消除大模型路径前缀漏匹配、Windows 分隔符转义与空模式异常**:
  - **技术机理 / 现象溯源**: 大模型在生成文件匹配模式时极常携带相对路径前缀（如 `./*.rs`、`./src/**/*.ts`）或 Windows 反斜杠（如 `.\\src\\*.rs`）。在原有实现中，`GlobBuilder` 开启了 `literal_separator(true)`，且遍历文件系统产生的相对路径不包含 `./` 前缀，导致该类模式与实际相对路径字面不匹配而静默返回空结果；同时，Windows 反斜杠 `\` 易被底层构建器误判为正则/glob 转义字符，导致匹配行为偏离预期。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-capabilities/src/tools/glob.rs` 中实现 `normalize_match_pattern` 路径规范化机制：
    1. 无条件将反斜杠 `\` 转换为正斜杠 `/`，彻底消除 Windows 路径下的分隔符转义歧义；
    2. 循环剥离模式开头的 `./`（`strip_prefix("./")`），使大模型生成的 `./*.toml`、`./nested/*.rs` 等模式与标准相对路径完美对齐；
    3. 针对剥离后为空的边界情况（例如纯 `./` 查询），安全回退为 `*` 通配模式，保证稳定列出当前目录项而非报错或返回空集合。
  - **验证与交付**: 在 `tools::glob::tests` 中补充全套单元测试，涵盖 `./*.toml`、多层嵌套 `././`、Windows `.\\src\\*.rs`、子目录作用域限定（`./nested/*.rs` 严格匹配子目录内容而不泄露根目录同类文件）以及系统分发忽略规则测试（`shipped_ignore_keeps_source_bins_in_glob`）。

- **[代码智能与图谱引擎 / 多语言生态源码保护与 MSBuild 构建产物精准剪枝] 解耦粗暴的裸 `bin/` 规则，完整保留各生态源码级可执行目录与 ASP.NET 资产，扩充全生态忽略规则并打通配置同步差异比对**:
  - **技术机理 / 现象溯源**: 原先 `.codegraphignore` 与引擎硬编码的 `SKIP_DIR_NAMES` 中直接配置了裸 `bin/` 规则，导致多语言生态中的核心源代码被无差别误杀：Rust 二进制 crate 源码（`src/bin/*.rs`、`src/bin/<name>/main.rs`）、Ruby 命令行工具（`bin/rails`、`bin/setup`）以及 Node/npm 入口脚本（`bin/cli.js`）在构建代码图谱时被全量忽略，严重破坏符号跳转与代码理解。同时，ASP.NET/Blazor 的 `wwwroot` 静态源码（JS、CSS）被误当成构建产物剔除，旧式 .NET 工程手写的 `Properties/AssemblyInfo.cs` 也被当作生成代码拦截；现代语言生态（Elixir、Flutter、Zig、Haskell、Swift、虚幻、Unity 等）也缺乏系统级构建目录过滤。
  - **实现防线 / 核心改动**:
    1. **MSBuild 路径上下文感知过滤**: 从 `SKIP_DIR_NAMES` 中移除裸 `"bin"` 与配置目录名（`"Debug"`, `"Release"`），改由 `should_prune_index_dir` 与 `parent_name_is_bin_or_obj` 依据父级路径动态判定，仅当配置目录位于 `bin/` 或 `obj/` 层级下时（支持 `App/bin/x64/Release` 等多目标架构）执行剪枝，并扩充识别 `RelWithDebInfo` 与 `MinSizeRel`；
    2. **源码资产回收与精准放行**: 从 `SKIP_DIR_NAMES` 中解禁 `wwwroot`，保留 Web 静态源码索引；在 `is_generated_source` 中将 `assemblyinfo.cs` 粗暴拦截收敛为精准过滤 `*.AssemblyAttributes.cs`，手写 `Properties/AssemblyInfo.cs` 得以正常参与索引；
    3. **多生态构建忽略规则库扩充**: 在 `.codegraphignore` 中全面补齐 .NET SDK artifacts（`**/artifacts/bin/`, `**/artifacts/obj/`）、Elixir/Erlang（`_build/`, `deps/`）、Flutter（`.dart_tool/`）、Zig（`zig-cache/`, `zig-out/`）、Haskell（`.stack-work/`, `dist-newstyle/`）、Swift/Xcode（`.build/`, `DerivedData/`）、Unreal Engine（`Binaries/`, `Intermediate/`, `DerivedDataCache/`）、CocoaPods（`Pods/`）以及严格锚定项目根目录的 Unity 编辑器缓存（`/Library/`，杜绝误伤名为 Library 的源码目录）；
    4. **内置忽略规则配置同步比对闭环**: 在 `CodeExploreTool::seed_fork_defaults` 中确立资产种子生命周期，更新后的 `.codegraphignore` 不强制无感覆盖，而是接入 `scan_jeikcode_config_diffs` 配置比对链路，供用户透明审查并勾选同步。
  - **验证与交付**: 补充并运行 `codeintel::index::tests::skips_msbuild_output_but_keeps_source_bins` 专项测试，断言验证 Rust `src/bin`、npm `bin/`、ASP.NET `wwwroot` 及手写 `AssemblyInfo.cs` 均能被正常索引，而 MSBuild 构建产物被严格拦截。

- **[WebUI 与 TUI 架构 / 会话直连打通与废弃同步流收敛] TUI `/webui` 直开当前会话，统一收敛为 `/chat` + `/chat/watch` 画布链路并彻底移除冗余 `/sync` 机制**:
  - **技术机理 / 现象溯源**: 原先 TUI `/webui` 命令打开浏览器时未携带会话锚定，用户需在侧边栏手动寻找当前会话；同时，历史遗留的独立同步机制（`/sync` 命令、`?sync=1` 参数、`postLiveSwitchSession` 与磁盘后台轮询）与标准的 `/chat` / `/chat/watch` 流产生竞争，引发双流冲突、多端新建会话误广播及画布跳变。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-daemon` 的 `ensure_server_and_open` 中引入 `session_id` 参数，向打开的 URL 自动追加 `&session=<前8位短ID>`，实现 TUI `/webui` 无缝直达当前会话；彻底移除 `/sync` 斜杠命令及其国际化文案与后端的 `CreateSessionRequest.sync` 广播逻辑，并在 TUI 命令前缀匹配中将 `sessions` 优先级前置于 `setup`；WebUI 画布全面收敛至 `/chat` 与 `/chat/watch` 单一链路，挂载时自动净化旧 URL 中的 `?sync` 参数；增强 `sessionProjection.ts` 的 `paintUserMessage` 状态机，保证 watch 观察者模式下准确保留 Working 占位符且避免已结算轮次的文本回放抖动。
  - **验证与交付**: 通过 `cargo check --lib -p jeikcode-daemon` 与 `cargo check --bin jeikcode` 编译，通过 `s_prefix_lists_sessions_before_setup` 命令单测，前端 323 项单元测试全部通过 (`npm test`)，`webui` 构建生产包成功。

## v7.2.0-beta.8 (2026-10-07)

- **[WebUI / Live Turn Sync] External `--host` observers and a refreshed sender both keep the open turn and continue painting it**:
  - **Technical Root Cause / Detail**: An external browser joins with `sync=1`. Its `/live` snapshot is often the previous completed turn, so the idle-replay gate treated the in-flight prompt as leftover journal: Working never appeared, refresh dropped the latest bubble, and later tokens were discarded. The sender tab does not use that gate. After refresh, `/chat/watch` replay includes `session_assigned`, and the client marked every viewer as the owner of POST `/chat`, which dropped every following user, thinking, and tool event until the turn was fully on disk.
  - **Implementation Mechanism**: An open user tail is a live turn: it does not arm the idle gate, and an empty assistant is inserted so Working can render. Disk inflight is merged onto a sync canvas instead of being skipped. `session_assigned` claims the turn only when this tab already owns the POST `/chat` stream. A repeated prompt is held during idle replay and released only when the next delta does not continue the previous assistant, so an already-painted thinking block is still not appended a second time.
  - **Verification & Testing**: `node --test src/lib/chatTerminal.test.ts src/lib/sessionProjection.test.ts` (45 passed) and `npx tsc --noEmit` in `webui`.

---

- **[WebUI / 实时回合同步] 外部 `--host` 观察者和刷新后的发送端都会保住正在进行的回合并继续渲染**:
  - **技术机理 / 现象溯源**: 外部浏览器带 `sync=1` 进入。`/live` 快照经常仍是上一轮已完成的对话，空闲回放闸门把本轮提问当成残留日志：不显示 Working，刷新后最新气泡消失，随后的 token 被丢掉。发送端不走这条闸门。刷新后 `/chat/watch` 回放带有 `session_assigned`，客户端把所有观看者都标成 POST `/chat` 的拥有者，于是后面的用户消息、思考块和工具事件全部被丢弃，直到整轮落盘。
  - **实现防线 / 核心改动**: 以用户提问结尾、后面还没有助手正文的记录视为进行中的回合：不开启空闲闸门，并补上空白助手气泡，Working 才能画出来。同步画布会并入磁盘上的进行中记录，不再跳过。只有本标签已经持有 POST `/chat` 流时，`session_assigned` 才会把回合记成自己的。重复的提问在空闲回放里先挂起，只有下一截内容不属于上一条助手回复时才放出来；已经画过的思考块不会再追加一次。
  - **验证与交付**: `webui` 下 `node --test src/lib/chatTerminal.test.ts src/lib/sessionProjection.test.ts`（45 项通过）以及 `npx tsc --noEmit`。

## v7.2.0-beta.7 (2026-10-07)

- **[Docs Site & Navigation / Streamlined Installation Guide & Clean Sidebar Layout] Restructure Quick Installation to cover TUI & Desktop, eliminate top-left title border artifact, and widen sidebar for single-line title display**:
  - **Technical Root Cause / Detail**: The docs site installation guides had redundant WebUI daemon sections already covered in Quickstart, Desktop application guides were fragmented into a separate deploy section, top-left logo link had an orphaned 136px `border-bottom` artifact under `.VPNavBarTitle .title`, and sidebar width (`272px`) forced long Chinese and English feature titles to wrap awkwardly.
  - **Implementation Mechanism**: Unified desktop app installation into `Quick Installation (TUI, Desktop)` / `快速安装（TUI、桌面端）` while removing duplicate WebUI and verification sections; eliminated standalone `deploy/desktop.md` pages; explicitly cleared `.VPNavBarTitle .title` border-bottom and adjusted navbar glassmorphism borders; expanded `--vp-sidebar-width` to `324px` (`340px` on wide screens) for clean single-line title rendering; updated API compatibility titles to `API 兼容端点（OpenAI、Anthropic）`.
  - **Verification & Testing**: Successfully built with VitePress `npm run docs:build` (0 errors), verified dev server hot reloads, and verified layout fidelity.

- **[Capabilities & Engine / Directory Reading Budgeting & Git Panel Real-Time Fingerprinting] Enhance `read` directory pagination budgeting and real-time Git status tracking in WebUI**:
  - **Technical Root Cause / Detail**: Large directory listings could breach payload byte limits or leave ambiguous continuation footers; additionally, WebUI Git panel polling lacked stable fingerprinting to avoid unnecessary DOM redraws or dropped turn replays during live reconnections.
  - **Implementation Mechanism**: Refactored `ReadFileTool` directory rendering with strict output budgeting reserve (`DIR_CHROME_RESERVE`) and comprehensive pagination continuation footers recommending `glob`, `grep`, and `code_explore`; added `gitPanelFingerprint` to track worktree status and commit history immutably; introduced `idleReplayAlreadyPainted` to prevent stale journal playback while gracefully streaming live assistant thinking and tool results.
  - **Verification & Testing**: Executed `cargo check --lib -p jeikcode-daemon`, `cargo test` on read tools, `node --test` across 61 webui test suites (all 61 passed), and `npm run build` in `webui`.

---

- **[文档站点与导航体验 / 快速安装精简重构与侧边栏体验升级] 重构「快速安装（TUI、桌面端）」指南，消除左上角标题下边框孤立残影，加宽侧边栏实现标题单行完整展示**:
  - **技术机理 / 现象溯源**: 官方文档中桌面端应用原先散落在独立的 `deploy` 章节，且安装指南夹杂了快速开始中已有的 WebUI 远程访问与启动命令；顶栏站点标题 `.VPNavBarTitle .title` 在含有侧边栏时生成了 136px 孤立下边框灰色横条；原侧边栏宽度（272px）导致多处中英文长标题被被迫折行。
  - **实现防线 / 核心改动**: 将桌面端安装完全并入「快速安装（TUI、桌面端）」指南，剔除多余启动验证与重复 WebUI 内容并彻底清理废弃独立页面；在 `custom.css` 中重写 `.VPNavBarTitle .title` 边框样式彻底消除灰色孤立条条，加宽 `--vp-sidebar-width` 至 324px（大屏 340px）保证标题单行优雅展示；同步对齐「API 兼容端点（OpenAI、Anthropic）」双语大标题与侧边栏路由。
  - **验证与交付**: VitePress `npm run docs:build` 验证通过（0 警告 0 报错），本地服务热重载验证通过。

- **[运行时与交互引擎 / 目录读取预算控制与 WebUI Git 面板指纹监听] 增强目录列表分段读取与自适应引导，健全 Git 面板状态指纹与重放去重**:
  - **技术机理 / 现象溯源**: 大目录读取容易超出单次响应字节预算且缺乏直观指引；WebUI Git 面板在并发工具执行与重连时缺乏稳定指纹机制以避免不必要的界面抖动与重放文本冗余。
  - **实现防线 / 核心改动**: 在 `ReadFileTool` 目录输出中引入字节预留预算与引导尾注（推荐使用 `glob`/`grep`/`code_explore`）；在 WebUI 中实现 `gitPanelFingerprint` 实时监听工作区变更，增加 `idleReplayAlreadyPainted` 状态门控精准识别已渲染推理流与工具执行状态。
  - **验证与交付**: 运行 `cargo check --lib -p jeikcode-daemon`，执行 WebUI 61 项单元测试全量通过，`webui` 构建成功。

## v7.2.0-beta.6 (2026-10-07)

- **[Tools & Capabilities / Config Action Unification & Obsolete Tool Purge] Consolidate `jeikcode_config_reload` into `jeikcode_config` and cleanly eliminate deprecated tools**:
  - **Technical Root Cause / Detail**: Configuration management tools were historically fragmented across separate implementations (`jeikcode_config_guide` and `jeikcode_config_reload`), and internal prompts/documents still retained obsolete tools (`list_directory`, `bash_kill_by_id`, `open_file`, `global_search_replace`) and stale tool names (`read_file`, `bash`).
  - **Implementation Mechanism**: Unified configuration operations under `jeikcode_config` with `action: "guide" | "reload"`, adding `#[serde(default, alias = "actions")]` to gracefully tolerate alias serialization and removing the dead `jeikcode_config_reload` module. Purged all traces of defunct tools from `root_docs_内置工具.yaml`, `builtin-tools.txt`, and modular `teaches/` guides without writing noisy deprecation warnings. Canonized `read` with its strict schema (`path`, `offset`, `limit`, `key_string`, `upward`, `downward`, `max_matches`), verified plain text responses with dynamic footers for markdown and edit safety, and updated `run_command` documentation to detail native OS PID and port inspection.
  - **Verification & Testing**: Executed `cargo test -p jeikcode-capabilities --lib tools::jeikcode_config_guide::` (9 passed), `tools::read::` (38 passed), and verified schema integrity via `ci_check_keywords_and_constants_integrity`.

- **[WebUI & Canvas Engine / Truncated Thinking Stream In-Place Extension] Fix duplicate reasoning block generation during watch replay under display truncation**:
  - **Technical Root Cause / Detail**: When the daemon replayed streaming transcript events over `/chat/watch`, reasoning tokens that underwent display truncation carried `DISPLAY_TRUNCATION_MARK` (`\n… [truncated for display]`). Strict prefix matching treated the truncated block as distinct, causing the UI to paint a second, disconnected thinking block.
  - **Implementation Mechanism**: Enhanced `chatTerminal.ts` and `sessionProjection.ts` to detect `DISPLAY_TRUNCATION_MARK` during watch replay and transcript extension. Rather than appending a duplicate thinking node, the canvas projection strips the truncation marker and performs an in-place extension on the active reasoning buffer.
  - **Verification & Testing**: Added unit tests in `sessionProjection.test.ts` for truncated thinking in-place extension (4/4 passed) and verified clean production compilation with `npm run build` in `webui`.

---

- **[工具与能力层 / 配置工具动作收敛与废弃工具彻底清理] 将配置重载工具并入 `jeikcode_config`，彻底清理历史废弃工具与文档命名偏差**:
  - **技术机理 / 现象溯源**: 历史版本中配置管理分散在独立工具 `jeikcode_config_reload` 与 `jeikcode_config_guide`，且内置文档与提示词存在已废弃工具（`list_directory`、`bash_kill_by_id`、`open_file`、`global_search_replace`）残留与旧工具名（`read_file`、`bash`）混用问题。
  - **实现防线 / 核心改动**: 将配置管理功能统一收敛至 `jeikcode_config(action="reload"|"guide")`，通过 `#[serde(default, alias = "actions")]` 支持 `actions` 别名字段无缝兼容，并彻底物理移除 `jeikcode_config_reload` 冗余模块；在 `root_docs_内置工具.yaml`、`builtin-tools.txt` 与全部 9 篇 `teaches/` 文档中彻底剔除废除工具，不添加任何陈旧废弃声明；全面对齐权威工具命名（`read`、`write`、`edit`、`run_command`），确保 `read` 文本响应与动态尾注机制兼容语法高亮与局部编辑，完善 `run_command` 后台任务返回 PID 与端口的原生管理说明。
  - **验证与交付**: 运行 `jeikcode_config_guide`（9 项通过）、`read` 全量测试（38 项通过）及 `ci_check_keywords_and_constants_integrity` 确保契约一致。

- **[WebUI 与会话投影 / 截断思考流平滑原地扩展] 修复前端在重放截断推理流时产生重复思考气泡的渲染缺陷**:
  - **技术机理 / 现象溯源**: 当 `/chat/watch` 流重放包含 `DISPLAY_TRUNCATION_MARK`（`\n… [truncated for display]`）的截断思考块时，严格前缀匹配误判新旧内容不连续，导致前端在会话画布中额外追加一个新的断裂思考卡片。
  - **实现防线 / 核心改动**: 在 `webui/src/lib/chatTerminal.ts` 与 `sessionProjection.ts` 中引入截断标记感知的流重合比对逻辑，在检测到已有思考块带有显示截断标记时自动原地剥离并平滑补全，避免重复生成思考节点。
  - **验证与交付**: 补充 `sessionProjection.test.ts` 专项单测（4/4 通过），并在 `webui` 目录下执行 `npm run build` 成功完成生产打包。

## v7.2.0-beta.5 (2026-10-07)

- **[Capabilities & Tools / Read Tool Lifecycle & Schema Hardening] Complete bidirectional mode closure, 3A-3D / 4A-4D footer state machines, and discriminated union serialization for `read`**:
  - **Technical Root Cause / Detail**: Previously, the `read` tool suffered from leaky defaults in its parameter schema, conflicting mutex requirements, and incomplete footer lifecycles. Slice paging and `key_string` anchor mode lacked unified recovery paths under byte truncation, risking conversational deadlocks and redundant roundtrips.
  - **Implementation Mechanism**: Hardened `ReadFileTool` schema by pruning schema defaults and retaining only `path` as required, silently absorbing mutually exclusive parameters across modes. Established comprehensive 3A–3D range slicing footers and 4A–4D `key_string` anchor templates, notably implementing dynamic `fallback_offset` / `fallback_limit` calculations in 4C to guarantee single-pass recovery to range paging under byte-budget limits. Refactored response payload into `ReadResponse` with `ReadMeta` discriminated union (`#[serde(tag = "mode")]`), deriving top-level `mode` immutably to eliminate drift while pruning all optional fields to prevent `null` contamination.
  - **Verification & Testing**: Added and executed 38 dedicated unit tests in `tools::read::tests`, validating negative offsets, sparse line anchors, mode transitions, and schema invariants cleanly.

- **[Knowledge Base & System / Modular Teaches Streamlining & Subtle Parameter Hardening] Distill full modular `teaches` guides into crisp configuration tutorials, eliminate architectural theory bloat, and document critical subtle parameter behaviors**:
  - **Technical Root Cause / Detail**: Modular teaches documents (`teaches/*.md`) were cluttered with hundreds of lines of internal architectural narratives, theoretical justifications (Topological Reordering, VersionRing, 3-Way Auto-Rebase, Linux ETXTBSY lock mechanics), diluting high-density signal needed by models and developers.
  - **Implementation Mechanism**: Refactored all 9 documents across `crates/jeikcode-capabilities/assets/teaches/` down to a strict four-element model: exact configuration paths, precise snippet syntax, hot-reload behavior (mtime automatic vs explicit trigger), and direct operational effects. Restrainedly clarified subtle parameter distinctions, including `scope: "session"` MCP process reclamation after 10 minutes of inactivity (`idle_ttl_secs`), `maxConcurrentCalls` UI tool concurrency gating, `reasoning_history` ("exclude" vs "include") multi-turn trace transmission, `coalesce_system`, and the 3-tier bash timeout hierarchy.
  - **Verification & Testing**: Passed all 8 `jeikcode_config_guide` tests with zero regressions.

- **[CI Pipeline & Quality Engineering / Capabilities Integration Test Suite Activation] Fix legacy tool assertions in `tools_integration.rs` and officially integrate the 35-test integration suite into CI**:
  - **Technical Root Cause / Detail**: The 11 integration test files under `crates/jeikcode-capabilities/tests/` were compiled via `cargo check --all-targets` but never actually executed in CI pipelines. Furthermore, `tools_integration.rs` retained stale assertions referencing pre-unification tool names (`read_file`, `write_file`, `edit_file`, `list_directory`), causing it to fail if run.
  - **Implementation Mechanism**: Modernized core tool assertions in `crates/jeikcode-capabilities/tests/tools_integration.rs` to match authoritative unified tools (`read`, `write`, `edit`, `run_command`, `grep`, `glob`). Updated `.github/workflows/ci.yml` in the `rust-quality` job to run the comprehensive capabilities integration suite (`tools_integration`, `http_mock`, `anthropic_mock`, `ollama_mock`, `compaction_cache`, `session_fixture_invariants`), transforming dormant integration tests into an active gating defense.
  - **Verification & Testing**: Ran the full 35-test suite locally in under 2 seconds with 100% pass rate, and verified end-to-end compilation with `cargo check --lib -p jeikcode-daemon`.

- **[WebUI & Canvas Engine / Multi-Stream Projection & Session State Reconciliation] Introduce dedicated `sessionProjection` canvas pipeline, prevent watch-replay duplicate turns, and synchronize live TodoList baseline**:
  - **Technical Root Cause / Detail**: During active turns, concurrent `/chat/watch` events, background disk polling, tab switching, and page reloads could fight over the React messages canvas. A fixed lookback limit in `userMessageAlreadyOnCanvas` risked duplicate user bubble appends in long sessions. When watch streams replayed coalesced deltas, text was often duplicated, and incremental `todowrite` events dispatched before React state hydration folded against empty arrays, dropping prior task items.
  - **Implementation Mechanism**: Introduced decoupled `webui/src/lib/sessionProjection.ts` and `sessionProjection.test.ts` to manage deterministic canvas rendering across cold starts, incognito sessions, and active stream reconciliations (`reconcileRunningTranscript`). Expanded `userMessageAlreadyOnCanvas` to scan across the complete canvas length. Added `unpaintedReplaySuffix` and `visibleToolChunk` to deduplicate coalesced replay text, reasoning tokens, and streaming tool outputs. Implemented `todoBaselineForLiveApply` in `todos.ts` to prioritize hydrated ref baselines over uninitialized React state, ensuring incremental task updates never drop previous checklist plans.
  - **Verification & Testing**: Passed all 317 WebUI unit tests including new `sessionProjection.test.ts` and `todos.test.ts`, and verified production bundle with `npm --prefix webui run build`.

---

- **[能力层与工具系统 / Read 工具生命周期与契约收网] 全面闭合 `read` 工具双模式状态机、3A-3D / 4A-4D 尾注契约与标签化联合元数据序列化**:
  - **技术机理 / 现象溯源**: 此前 `read` 工具在参数 Schema、执行层和提示词层存在默认值污染与约束冲突，切片分页与 `key_string` 锚点模式在遇到字节预算截断时缺乏闭环的续读引导，容易导致模型在多轮会话中陷入死循环翻页或冗余调用。
  - **实现防线 / 核心改动**: 精简 `read` 的参数 Schema，仅保留必填 `path`，其余模式互斥参数改为静默吸收策略；确立了 Range 模式（3A-3D）与 `key_string` 锚点模式（4A-4D）的完整尾注模板，特别是在 4C 字节截断场景下自动换算 `fallback_offset` / `fallback_limit`，实现锚点模式向分页模式的单向状态转移；重构响应信封为带 `#[serde(tag = "mode")]` 的 `ReadMeta` 标签化联合（Discriminated Union），顶层 `mode` 纯函数派生保证恒等，可选字段按需序列化消灭 `null` 冗余。
  - **验证与交付**: `tools::read::tests` 38 项单测全绿通过，覆盖负数 offset、稀疏行锚点、状态机四态流转及防漂移断言。

- **[知识库与系统指南 / 内置 Teaches 文档全面治理与精简] 彻底剔除底层机理与长篇理论描述，收敛为极简配置教程并讲透微小参数细微差异**:
  - **技术机理 / 现象溯源**: 原 `teaches/*.md` 知识库包含大量底层算法原理解析（如 Topological Reordering、VersionRing 历史快照环、3-Way 变基算法、Linux ETXTBSY 内核锁机制），信息密度低且冗余，不符合指南知识源的高信噪比需求。
  - **实现防线 / 核心改动**: 重构并精简 `crates/jeikcode-capabilities/assets/teaches/` 下全部 9 篇文档，收敛为统一的“文件在哪 + 改动什么 + 是否自动热生效 + 触发方式”四要素结构；以克制精准的语言讲透关键微小参数的行为差异，涵盖 `scope: "session"` 模式下 10 分钟闲置自动回收机制（`idle_ttl_secs`）、`maxConcurrentCalls` 独占保护、`reasoning_history` 思考过程多轮回传策略、`coalesce_system` 缓存控制及 `[tools.bash]` 三档超时判定阶梯。
  - **验证与交付**: `jeikcode_config_guide` 8 项测试全量通过，文档体积缩减逾 50%。

- **[CI 流水线与质量工程 / Capabilities 集成测试套件正式纳管] 修复 `tools_integration.rs` 历史工具名断言，将 35 项端到端集成测试接入 CI 必跑防线**:
  - **技术机理 / 现象溯源**: `crates/jeikcode-capabilities/tests/` 下的 11 个集成测试文件此前仅在 CI 中参与类型编译检查，从未真正执行；且 `tools_integration.rs` 内部断言仍匹配历史旧工具名（`read_file`, `write_file`, `edit_file`, `list_directory`），导致集成测试一旦执行便会报错挂掉。
  - **实现防线 / 核心改动**: 将 `tools_integration.rs` 的核心工具断言更新为当前权威统一的 `read`、`write`、`edit`、`run_command`、`grep`、`glob`；在 `.github/workflows/ci.yml` 的 `rust-quality` 任务中增加集成测试套件执行步骤（覆盖 `tools_integration`, `http_mock`, `anthropic_mock`, `ollama_mock`, `compaction_cache`, `session_fixture_invariants`），使 35 项关键集成测试成为流水线每次触发的真实防线。
  - **验证与交付**: 35 项跨模块集成测试本地 1.3 秒极速通过，`cargo check --lib -p jeikcode-daemon` 编译校验通过。

- **[WebUI 与画布状态引擎 / 多流投影重合与会话状态调和] 重构引入独立 `sessionProjection` 状态管道，杜绝 Watch 重放气泡错位倒置与重复追加，并端到端同步实时任务清单基线**:
  - **技术机理 / 现象溯源**: 在活跃轮次中，并发的 `/chat/watch` 流、后台磁盘轮询、多标签页切换及页面刷新容易在 React 消息状态上产生竞争冲突。原画布检测窗口仍有边界限制，极长会话中用户提问仍可能被当作新消息置底追加；watch 重放的聚合增量容易导致文本与思考重复渲染；且在 React 状态未水合前到达的增量 `todowrite` 动作容易基于空数组 `[]` 折叠，导致已有任务清单被冲刷覆盖。
  - **实现防线 / 核心改动**: 构建独立的 `webui/src/lib/sessionProjection.ts` 投影层，统筹冷启动、无痕模式与活跃流的数据调和（`reconcileRunningTranscript`）；将 `userMessageAlreadyOnCanvas` 扩展为全画布穿透比对；引入 `unpaintedReplaySuffix` 与 `visibleToolChunk` 精准剥离重放中的已渲染文本、思考与工具输出增量；在 `todos.ts` 中实现 `todoBaselineForLiveApply`，优先绑定已水合的 ref 基准，确保增量任务操作绝不丢失既有清单。
  - **验证与交付**: `sessionProjection.test.ts` 与 `todos.test.ts` 等 317 项前端单测全绿，`webui` 生产构建（Vite）打包验证通过。

## v7.2.0-beta.4 (2026-10-07)

- **[Capabilities & Tools / Codebase Tools Streamlining] Retire standalone `repo_map` from model-facing tools catalog, consolidating all structural tree capability into `read`**:
  - **Technical Root Cause / Detail**: With `read` natively adopting index-backed 2-level architectural directory mapping and single-level fallbacks, keeping `repo_map` in the model-facing tool catalog introduced redundant cognitive tool-choice overhead and conflicting prompt guidance.
  - **Implementation Mechanism**: Removed `repo_map` from `codeintel_tool_names()` and `register_codeintel_tools_with_mode()` in `crates/jeikcode-capabilities/src/codeintel/mod.rs`, leaving `code_explore` as the sole specialized code-intelligence tool. Purged `repo_map` from `default_no_fold_tools` across `config/mod.rs`, `default-config.toml`, and builtin tool catalogs. Updated `crates/jeikcode-coding/src/assemble.rs` test suite to assert `repo_map` is cleanly retired.
  - **Verification & Testing**: Passed all `assemble::tests` and `codeintel` test suites, and verified with `cargo check --lib -p jeikcode-daemon`.

- **[WebUI & Task Engine / Mobile Reconnect Resilience & TodoList State Sync] Fix mobile background disconnects, prevent user message bubble displacement after reload, and synchronize authoritative TodoList state**:
  - **Technical Root Cause / Detail**: Mobile browsers freeze background tabs, silently breaking long-lived SSE connections. Upon foreground switch, `refreshOnFocus` failed to detect severed sockets, leaving the UI deadlocked in a broken state. When users refreshed or re-entered via incognito, a narrow 8-message deduplication window (`userMessageAlreadyOnCanvas`) caused existing user questions to slip past detection and get erroneously re-appended to the very bottom, causing AI tokens to stream below the user bubble. Furthermore, incremental `todo_write` calls during detached reattach reduced against an empty baseline when the initial full plan fell outside the message history window, shrinking multi-task checklists into a single card.
  - **Implementation Mechanism**: Enhanced `userMessageAlreadyOnCanvas` in `webui/src/lib/chatTerminal.ts` to scan across a deep 100-message canvas window, completely preventing misplaced user echo appends. Added automatic active-session reconnection and freshness catch-up to `refreshOnFocus` in `Chat.tsx` on `visibilitychange`. Extended backend `SessionDetail` in `crates/jeikcode-daemon/src/lib.rs` to derive and deliver authoritative `todos` from the full session transcript, and updated `reduceTodosFromCalls` in `webui/src/lib/todos.ts` to fold incremental actions against prior baseline stashes rather than empty arrays. Uncollapsed `SessionTodoPanel` by default to display the full multi-step task list.
  - **Verification & Testing**: Passed all 25 `todos.test.ts` tests, 36 `chatTerminal.test.ts` tests, 63 backend `tools::todo::tests`, and executed `npm run build` in `webui` cleanly.

---

- **[能力层与工具系统 / 核心工具集精简化] 正式从面向模型的工具集中退役 `repo_map` 工具，代码全览能力完全归一至 `read`**:
  - **技术机理 / 现象溯源**: 鉴于 `read` 工具已在底层全面接管基于代码图谱的 2 层架构树全览与单层自适应降级，继续在模型工具集中挂载独立的 `repo_map` 工具会导致模型在工具选择上产生认知困扰，且提示词出现冗余分支。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-capabilities/src/codeintel/mod.rs` 中将 `repo_map` 从 `codeintel_tool_names()` 和挂载注册中彻底移除，代码智能核心工具统一收敛为唯一主角 `code_explore`；从全局配置与各端资产的 `default_no_fold_tools` 白名单中移除 `repo_map`；同步更新 `crates/jeikcode-coding/src/assemble.rs` 单元测试，将 `repo_map` 纳入已退役工具断言列表。
  - **验证与交付**: `assemble::tests` 及 `codeintel` 单元测试全绿通过，`cargo check --lib -p jeikcode-daemon` 编译校验通过。

- **[WebUI 与任务状态机 / 移动端重连韧性与任务清单状态同步] 根治移动端退后台断开、修复大退刷新后用户气泡错位倒置、并端到端同步权威 TodoList 状态**:
  - **技术机理 / 现象溯源**: 移动端切后台后系统挂起导致 SSE 长连接中断，切回前台时原 `refreshOnFocus` 缺乏重连机制导致连接假死；大退或断线刷新后，因前端回溯窗口硬编码为 8 条，导致长回合中的用户提问滑出检测范围，在 watch 重放时被错误重新追加到画布最末尾，使得后续 AI 回复从该气泡下方吐出；此外，当最初的全量 plan 处于历史分页之外时，重连后的增量 `todo_write` 动作由于缺乏基准状态而退化为从空数组 `[]` 开始计算，导致前端多任务清单诡异消失仅剩 1 张卡片。
  - **实现防线 / 核心改动**: 在 `webui/src/lib/chatTerminal.ts` 中将 `userMessageAlreadyOnCanvas` 扩展为 100 条全量穿透回溯比对，彻底杜绝已存在的用户提问被置底追加；在 `Chat.tsx` 的 `visibilitychange` 事件中注入自动重连守卫，移动端切回前台时静默探测活跃状态并无感恢复连接；在后端 `SessionDetail` 中直接利用全量快照推导权威 `todos` 下发前端，并在前端 `reduceTodosFromCalls` 中增加 `baselineFallback` 兜底防线，杜绝从空列表开始累加增量动作；默认展开 `SessionTodoPanel` 完整任务清单。
  - **验证与交付**: `todos.test.ts` 25 项测试、`chatTerminal.test.ts` 36 项测试、Rust `tools::todo::tests` 63 项测试全部通过，`webui` 前端构建全量通过。

## v7.2.0-beta.3 (2026-10-07)

- **[Capabilities & Tools / Codebase Exploration & Adaptive Reading] Consolidate `repo_map` architectural overview into `read`, eliminate negative offset prompt steering, remove file size noise from directory listings, purge symbol extraction bloat, and introduce project-level `.codegraphignore`**:
  - **Technical Root Cause / Detail**: Previously, the `read` tool's schema carried negative prompting ("Only provide if the file is too large to read at once"), misleading LLMs into omitting `offset` during initial reads and file paging. Directory listings performed unnecessary file-metadata lookups and appended noisy size tags (`(60.9 KB)`), diluting context tokens. The standalone `repo_map` tool suffered from scope leakage (leaking unrelated project symbols into scoped paths) and symbol bloat (extracting low-signal HTML tags).
  - **Implementation Mechanism**: Upgraded `read` in `crates/jeikcode-capabilities/src/tools/read.rs` to automatically render an index-backed 2-level architectural tree when reading directories without explicit pagination, seamlessly falling back to clean single-level listings when unindexed. Removed negative phrasing from `offset` parameter schema and eliminated file-size formatting from directory entries. Streamlined `repo_map.rs` by removing legacy symbol extraction and obsolete `full`/`symbols` modes. Purged legacy `repo_map` references across system prompts (`rules.yaml`, `root_docs_内置工具.yaml`, `persona.rs`, `code_tools_first.rs`) and Teaches documents. Added project-level `.codegraphignore` rules ignoring static sites, caches, and test artifacts.
  - **Verification & Testing**: Passed all 35 `tools::read` tests, 2 `repo_map` tests, 42 `persona` tests, and 11 `code_tools_first` tests. Validated with `cargo fmt` and `cargo check --lib -p jeikcode-daemon`.

- **[WebUI & Streaming Engine / Watch Conflict Isolation & Local Turn Protection] Protect local in-flight turns from premature state resets and isolate streaming from idle watch conflicts**:
  - **Technical Root Cause / Detail**: During active turns initiated by the local web client, background watch polling or slight synchronisation delays in active session lists could prematurely drop the busy state or attach duplicate watch connections, risking dual-stream race conditions and transcript fragmentation.
  - **Implementation Mechanism**: Fortified `webui/src/components/Chat.tsx` by tracking local active session turns (`localTurnSessionsRef`) across generation lifetimes; ensured `setBusyAndClock(true)` remains enforced when in-flight, preventing 2.5s timeouts from misidentifying active turns as idle; strictly prevented idle watch connection creation when local turns are active; and added `requireReplayDedup` protection when handling replay and watch events.
  - **Verification & Testing**: Ran `npm run build` in `webui` successfully.

---

- **[能力层与工具系统 / 代码库全览与自适应阅读] 将 `repo_map` 架构全览能力收敛至 `read` 工具、彻底消除 offset 负向诱导与目录文件大小杂余、移除符号提取噪音并配置项目级 `.codegraphignore`**:
  - **技术机理 / 现象溯源**: 此前 `read` 工具参数 schema 存在“只有文件过大才提供”的负向暗示，导致模型在初次调用或需要分页时本能偷懒不传 `offset`；目录展示对每个文件执行元数据系统调用并追加冗余的大小标记（如 `(60.9 KB)`），浪费 Token 并分散注意力；独立 `repo_map` 工具存在子目录查询时泄露全局不相关符号的作用域 Bug，且符号大纲提取中充斥无意义的纯 HTML 原生标签（如 `ui div`、`ui span`）。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-capabilities/src/tools/read.rs` 中将 `repo_map` 的全览能力融合接入：在读取目录且未传分页参数时优先自动渲染紧凑的 2 层架构树，无索引时平滑降级为纯净单层展示；彻底剔除 `offset` schema 中的负向诱导描述，并在截断尾注中提供显式动作指引；去除目录列表中的文件大小拼接；重构 `repo_map.rs`，彻底废弃冗余的 `full`/`symbols` 模式与符号打分杂余；地毯式清理全仓提示词（`rules.yaml`、内置工具字典、`persona.rs`、`code_tools_first.rs`）及 Teaches 知识库中关于 `repo_map` 的残留唠叨；在 `.jeikcode/.codegraphignore` 中配置项目级站点产物与缓存过滤。
  - **验证与交付**: `tools::read` 的 35 项单测、`repo_map` 2 项单测、`persona` 42 项单测、`code_tools_first` 11 项单测全部绿灯通过，`cargo fmt` 格式化规范检查通过，`cargo check --lib -p jeikcode-daemon` 编译校验通过。

- **[WebUI 与流式引擎 / 待机冲突隔离与本地轮次守护] 守护本地活跃生成状态免遭提前重置，并杜绝待机监听流与主流冲突**:
  - **技术机理 / 现象溯源**: 当 Web 端正在发起本地流式生成时，后端会话活跃列表的微秒级同步滞后或超过 2.5 秒的耗时可能会导致忙碌状态被意外解除；同时待机监听流（idle watch）的不当连接可能产生双流竞争与正文撕裂隐患。
  - **实现防线 / 核心改动**: 在 `webui/src/components/Chat.tsx` 中通过 `localTurnSessionsRef` 登记并守护本地轮次；无论后端同步状态如何，只要本端有活跃轮次即坚决锁定忙碌态（`busyRef`）；在存在本地活跃发送流时坚决杜绝建立任何待机 watch 连接；在消费重放与监听事件时追加 `requireReplayDedup` 去重保护。
  - **验证与交付**: `webui` 目录下执行 `npm run build` 构建编译全量通过。

## v7.2.0-beta.2 (2026-10-07)

- **[Capabilities & Tools / Shell Hardening & Precision Reading] Fix Windows WSL bash hijacking in `run_command`, enhance `read` with anchor matching, and modernize notification audio**:
  - **Technical Root Cause / Detail**: On Windows environments with WSL enabled, running scripts with `#!/usr/bin/env bash` shebangs (such as Node.js `npm`/`npx` wrappers) through `run_command` previously triggered exit code 127 (`No such file or directory`) because Windows `System32\bash.exe` shadowed Git Bash's `/usr/bin/bash` in `PATH` and failed to resolve MSYS2 drive paths (`/d/...`). Furthermore, inspecting symbols in large files previously required reading entire pages or manual offset guessing, OS desktop toasts suffered from unstackable popup spam, and leftover database paths lingered in `index_db.rs`.
  - **Implementation Mechanism**: Hardened Windows shell execution in `crates/jeikcode-capabilities/src/tools/bash.rs` by prepending a dedicated `/tmp/.jeikcode_shims` directory containing Git Bash `bash`/`sh` symlinks to `PATH`, completely eliminating WSL binary shadowing while preserving native Windows compiler precedence. Upgraded `read` tool with `key_string`, `upward`, `downward`, and `max_matches` arguments supporting 4-tier fuzzy matching and centered inspection windows with line numbers. Replaced OS popup toasts with pure platform alert sounds (`MessageBeep`, `afplay`, `paplay`) protected by an 800ms atomic debounce lock in `notify.rs`. Purged a leftover path fallback in `index_db.rs`.
  - **Verification & Testing**: Passed all 34 read tool unit tests in `jeikcode-capabilities`, verified `npm` execution via the new shim mechanism, and passed `cargo check --lib -p jeikcode-daemon`.

- **[WebUI & Chat Interface / Stream Integrity & Multi-Repo Navigation] Shield active streaming against watch stream tearing, eliminate scroll jitter, and add multi-repo Git switching**:
  - **Technical Root Cause / Detail**: During active agent generation, watch stream reattachment could race with local streams and pop typing message bubbles, resulting in truncated or shredded assistant transcripts. In addition, browser scroll anchoring caused visual jitter during rapid streaming, user steering envelopes leaked into the session outline rail, and multi-repo workspaces lacked Git panel switching.
  - **Implementation Mechanism**: Fortified `Chat.tsx` with guard rails that forbid watch stream connection or bubble dropping while `abortRef` or `activeStreamRequestIdRef` holds an active stream. Applied `overflow-anchor: none` to the chat scroll container to ensure silky smooth pinned scrolling. Applied `stripSteerEnvelopeForDisplay` across `turnNav.ts` to keep navigation clean. Implemented `fetchGitRepos` workspace repository switching and status auto-refresh in `Chat.tsx`.
  - **Verification & Testing**: Executed `npm run build` in `webui` (tsc + vite) successfully and passed all 20 tests in `historyMessages.test.ts` and `turnNav.test.ts`.

---

- **[能力层与工具系统 / Shell 加固与精准阅读] 根治 Windows WSL bash 路径劫持、强化 `read` 锚点定位并升级轻量系统通知音**:
  - **技术机理 / 现象溯源**: 在启用了 WSL 的 Windows 机器上，`run_command` 执行带 `#!/usr/bin/env bash` Shebang 的脚本（如 Node.js 自带的 `npm`/`npx` 包装器）时，因系统 `System32\bash.exe` 在 PATH 中先于 Git Bash 被 `env` 检索，导致 WSL 的 Linux bash 被误唤起并因无法识别 MSYS2 盘符路径（如 `/d/...`）报出 127 错误；同时大文件符号检视缺乏精准锚点窗口支持、系统级 Toast 弹窗存在无法堆叠的弹窗轰炸问题，且 `index_db.rs` 存在历史遗留路径。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-capabilities/src/tools/bash.rs` 的 Windows bash 初始化逻辑中，注入最高优先级的 `/tmp/.jeikcode_shims` 目录并建立指向当前 Git Bash `bash`/`sh` 的软链接，彻底杜绝 WSL `System32\bash.exe` 劫持 `env bash`，同时严密保护宿主原生编译工具链（Cargo/MSVC/Python）的优先级；为 `read` 工具引入 `key_string`、`upward`、`downward` 与 `max_matches`，支持四级容错匹配、居中行窗口与精确定位；在 `notify.rs` 中全面移除 OS 弹窗，改为纯系统提示音（`MessageBeep`/`afplay`/`paplay`）并配合 800ms 原子防抖锁；清理 `index_db.rs` 中已废弃的路径。
  - **验证与交付**: `jeikcode-capabilities` 的 34 项 read 工具单测全绿通过，实测 Git Bash 下 `npm` 顺利执行，`cargo check --lib -p jeikcode-daemon` 编译校验通过。

- **[WebUI 与交互界面 / 流式防撕裂与多仓库支持] 阻断流式会话被重放撕裂、消除滚动锚定抖动并支持多仓 Git 切换**:
  - **技术机理 / 现象溯源**: 当本地前端正持有活跃流式输出时，watch stream 的重连与快照重放可能与主流冲突，并错误地将正在打字的消息气泡弹栈截断，造成正文吞字或撕裂；浏览器默认的 `overflow-anchor` 机制在密集吐字时易引发视图抖动与跳动；会话中途插话转向（Steer）信封结构会泄露至右侧大纲导航栏；包含多个 Git 仓库的工作区缺乏仓库切换能力。
  - **实现防线 / 核心改动**: 在 `Chat.tsx` 中建立关键防线，凡本端持有活跃主流（`abortRef` 或 `activeStreamRequestIdRef` 存在），严禁接入 watch stream 或弹栈气泡；在 `#chat-scroll-container` 增加 `overflow-anchor: none`，消除密集流式输出时的滚动位移冲突；在 `turnNav.ts` 中引入 `stripSteerEnvelopeForDisplay` 深度过滤转向信封噪音；在 `Chat.tsx` 中新增多仓库探测（`fetchGitRepos`）与动态切仓支持。
  - **验证与交付**: `webui` 构建（`npm run build`）全量成功，`historyMessages.test.ts` 和 `turnNav.test.ts` 的 20 项单元测试全部通过。

## v7.2.0-beta.1 (2026-10-07)

- **[Prompts & Workflow Rules / Steer & Execution Discipline] Upgrade mid-turn steer prompt guidance and enforce architectural root-cause workflow rules**:
  - **Technical Root Cause / Detail**: Previously, mid-turn steer requests lacked explicit safeguards against accidental task cancellation or dropping pending TodoLists, causing models to prematurely abort ongoing user goals upon receiving follow-up input. Furthermore, workflow prompt instructions lacked clear multi-task scope boundaries, objective technical review discipline, and concurrent commit isolation constraints, while redundant `doing_tasks` blocks in prompt configurations caused cognitive duplication.
  - **Implementation Mechanism**: Overhauled `steer_prompt.rs` with a robust 4-pillar guidance framework: non-destructive default retention (`Acknowledge and Retain by Default`), safe-checkpoint transition with automatic resumption (`TodoList Priority Injection and Safe Transition`), testing phase fast-path (`Testing Phase Fast-path`), and surgical conflict replacement (`Surgical Conflict Replacement`). Upgraded `rules.yaml` system prompts with imperative, non-prohibitive task scope awareness, architectural root-cause problem solving (pattern matching, normalization, strategy/adapter patterns, dynamic upstream fallbacks), objective technical review against sycophancy and architectural debt, and commit scope discipline to prevent multi-session collision. Purged redundant `doing_tasks` blocks from prompt templates to ensure a single source of truth under `raw`.
  - **Verification & Testing**: Updated and passed prompt unit tests and integration tests in `crates/jeikcode-coding`, formatted modified Rust code with `cargo fmt`, synchronized user prompts under `~/.jeikcode/prompts/`, and validated version consistency across manifests.

---

- **[提示词工程与工作流规范 / 转向机制与工程执行纪律] 升级会话中途转向 (Steer) 提示词引导架构，并确立架构级根因治理工作流规约**:
  - **技术机理 / 现象溯源**: 此前会话在执行中途接收插话转向请求（Steer）时，缺乏对既有任务及待办清单（TodoList）的明确保留与断点续做约束，导致模型在处理新输入时极易误将新需求当成覆盖指令，从而提前清空或放弃原任务；同时系统工作流提示词缺乏多任务讨论时的执行边界确认、技术方案客观审视准则以及并发提交隔离纪律，且提示词配置文件中存在 `raw` 与 `doing_tasks` 双重冗余。
  - **实现防线 / 核心改动**: 彻底重构 `steer_prompt.rs`，确立四维健壮转向准则：默认保留原任务及清单（非显式指令绝不丢弃）、在语法合规与自洽的检查点安全切换并于新任务完成后自动回跳续做、单测阶段快速暂停并待新老需求合并统一验证、局部冲突仅外科手术式精准置换（A $\to$ B）而不干扰其余不冲突项；在 `rules.yaml` 中以纯祈使避免句式重构任务执行规范，确立任务范围意识（指定任务完成即停机交付，避免擅自扩大范围）、架构级治本原则（倡导模式匹配、归一化、适配器/策略模式与动态兜底，替代死代码与硬编码穷举）、客观技术审视（拒绝盲从讨好与吹毛求疵，主动识别并优化架构隐患）以及严格的提交范围纪律（仅提交自己改动的文件以保障并发安全）；彻底移除 `doing_tasks` 冗余块，统一收敛为单一事实来源。
  - **验证与交付**: 同步更新并验证了 `jeikcode-coding` 模块下的转向提示词单元测试及集成测试断言，执行 `cargo fmt` 确保格式合规，完成本地 `~/.jeikcode/prompts/` 实时配置同步与热重载验证，全仓版本号一致性校验通过。


## v7.2.0-beta.0 (2026-10-07)

- **[Capabilities & Tools / Core Coding Suite] Streamline core coding tools, upgrade file inspection resilience, and direct-pass shell execution**:
  - **Technical Root Cause / Detail**: Previous tool proliferation introduced cognitive confusion and fragmentation across file operations (`list_directory`, `open_file`, `global_search_replace`), prompt bloat with negative nagging, fragile file reading under Windows/CRLF and escaped newlines, and unnecessary wrapper abstractions over bash background processes (`bashid`). Furthermore, `code_explore` and `repo_map` required more precise identifier prioritization and accurate subdirectory scope boundaries.
  - **Implementation Mechanism**: Upgraded the `read` tool into a unified file and directory inspector with negative-offset tail reads, asymmetric anchor slicing, backward keyword search, and 4-tier escape/newline fault tolerance; enhanced `grep` with `word_match` and compact grouped outputs; unchained `run_command` with full flags and pipeline passthrough to native shells; replaced pseudo-bashid with real OS process PID and port reporting; consolidated configuration actions under `jeikcode_config` (guide and reload); purged redundant tools (`list_directory`, `open_file`, `global_search_replace`, `bash_kill_by_id`); hardened WebUI session switching against 409 concurrency conflicts; and modernized GitPanel commit details with responsive layouts and compact action menus.
  - **Verification & Testing**: Executed Rust capability unit test suites (`cargo check --lib -p jeikcode-daemon`), verified version consistency, and tested WebUI builds.

---

- **[能力层与工具系统 / 核心编码工具栈] 全面精简核心编码工具集、强化多层容错文件检查并直通原生 Shell 执行**:
  - **技术机理 / 现象溯源**: 此前核心文件操作存在工具膨胀与认知分歧（`list_directory`、`open_file`、`global_search_replace` 职责重叠），提示词存在负面唠叨（negative nagging）与内部别名噪音；在 Windows CRLF 及跨平台换行转义场景下文件截取存在脆弱性；后台进程过度封装虚拟 `bashid` 掩盖了系统原生进程管控能力；同时 `code_explore` 与 `repo_map` 在子目录过滤与符号精确匹配上仍有优化空间。
  - **实现防线 / 核心改动**: 彻底升级 `read` 工具，统一文件与目录浏览能力，原生支持负数 offset 尾部切片读取、非对称锚点上下切片、反向关键字定位及四级跨平台转义/换行容错；强化 `grep` 支持整词匹配（`word_match`）与紧凑分组输出；直通 `run_command` 支持任意标志位（如 `ls -la`）与复杂管道，废除 `bashid` 改由系统真实 PID 与端口接管后台任务；收敛配置工具为单一 `jeikcode_config`；剔除冗余工具；加固 WebUI 会话并发切换防止 409 竞态，重构 Git 面板响应式提交详情卡片。
  - **验证与交付**: 运行 `cargo check --lib -p jeikcode-daemon` 校验通过，运行版本一致性检查无漂移，WebUI 构建通过。


## v7.1.53-beta.13 (2026-10-06)

- **[Daemon / Approval & Runtime Correlation] Harden interactive approval correlation, eliminate liveness races, and enforce fail-closed runtime semantics**:
  - **Technical Root Cause / Detail**: Tool approvals previously suffered from correlation and liveness races across `/chat`, native `/live`, clients, and desktop notifications. Stale approval responses could outlive their source request; `/chat/permission` could return success before the runtime consumed the decision; daemon and kernel timeouts competed; cancellation could race already-ready approvals; native runtime generations reset upon runtime owner replacement so `(session, generation, request_id)` alone was not durable; reused request ids could resolve against wrong runtime owners; and UI deduplication/notification tags collapsed distinct approvals.
  - **Implementation Mechanism**: Correlated `/chat` approvals by exact `(session_id, approval_id)` with `Expired` tombstones and ACK-on-consume delivery; unified timeout ownership under daemon and disabled competing kernel timers; linearized user stop against approval consumption via per-operation stop gates with fail-closed semantics; assigned stable UUID instance IDs to `CodingRuntimeHandle`; bound `/live/permission` to exact `(session_id, runtime_instance_id, generation, request_id)` and verified `APPROVAL_KIND`; aligned strong live identity across WebUI state, JetBrains / VS Code extensions, and OS notification URIs/tags.
  - **Verification & Testing**: Merged PR #8; passed all targeted unit and concurrency tests across `session_runtime_registry`, `live_hub`, `live_permission`, `chat_permission`, `permission_bridge`, and `tuix`; validated WebUI and Rust CI checks.

---

- **[Daemon / 审批与运行时关联] 全面加固交互式工具审批关联机制、根治生命周期竞态并推行 Fail-Closed 安全语义**:
  - **技术机理 / 现象溯源**: 此前在 `/chat`、原生 `/live`、WebUI、IDE 扩展与系统通知的多端流转中存在多处审批关联失效与生命周期竞态问题：陈旧或重复的审批响应可能穿透至后续不相关的工具调用；`/chat/permission` 在运行时实际消费决定前即提前返回成功；Daemon 与 Kernel 双重定时器相互竞争；用户中断（Stop）与审批确认存在纳秒级调度竞态；原生运行时替换时世代（generation）重置导致三元组无法跨实例隔离；客户端与操作系统通知标签未绑定具体运行时实例，存在幽灵卡片与误放行风险。
  - **实现防线 / 核心改动**: `/chat` 审批改由精确的 `(session_id, approval_id)` 路由并引入 `Expired` 墓碑与两阶段 ACK 确认机制；将交互式超时所有权统一收敛至 Daemon 层并关闭竞争内核定时器；通过各操作独立的 `stop_gate` 线性化停止与审批消费，并发时中断优先并严格 Fail-Closed；为 `CodingRuntimeHandle` 分配全局唯一的实例 ID（`runtime_instance_id`），保留 generation 0 并实施来源戳记；将 `/live/permission` 严格升级为四元组验证并确认 `APPROVAL_KIND`；全链路对齐 WebUI 状态机、VS Code / JetBrains 扩展及系统通知 URI/Tag。
  - **验证与交付**: 合并 PR #8；全量通过 `session_runtime_registry`、`live_hub`、`live_permission`、`chat_permission`、`permission_bridge` 以及 `tuix` 等模块的并发与边界单测；CI 质量门禁全绿通过。


## v7.1.53-beta.12 (2026-10-06)

- **[Release Pipeline / Build & Release] Trigger fresh beta release pipeline and re-synchronize distribution assets**:
  - **Technical Root Cause / Detail**: Re-triggered release pipeline as a clean prerelease re-cut to ensure seamless end-to-end asset distribution and installer script routing across all supported target platforms.
  - **Implementation Mechanism**: Incremented prerelease version sequence to `v7.1.53-beta.12` across core shipping manifests and verified multi-target configuration consistency.
  - **Verification & Testing**: Passed version consistency verification via `node scripts/check-version-consistency.js`.

---

- **[发布流水线与版本交付] 重新触发 Beta 发布流水线并同步多端安装分发资产**:
  - **技术机理 / 现象溯源**: 为确保多端构建产物、Release 资产与一键安装脚本路由在全平台环境下的分发可用性，重新触发全量构建与发版流水线。
  - **实现防线 / 核心改动**: 将预发布版本号一键同步递增至 `v7.1.53-beta.12`，保持各端配置清单严格对齐。
  - **验证与交付**: 运行 `node scripts/check-version-consistency.js` 验证全仓版本清单一致性通过。


## v7.1.53-beta.11 (2026-10-06)

- **[CI & Quality Gates] Restore pull request CI triggers, isolate concurrency keys, and reinstate Windows installer integrity coverage**:
  - **Technical Root Cause / Detail**: Following pipeline streamlining, the `pull_request` trigger was removed while `ci.yml` only listened on branch `push` events, leaving incoming PRs targeting `main` and `beta` without automated quality gate validation prior to merging. Furthermore, installer integrity tests were reduced to Ubuntu-only, leaving Windows PowerShell installers unexercised on hosted Windows runners, and the previous concurrency key lacked event scoping, which could allow branch push events to cancel PR validation runs.
  - **Implementation Mechanism**: Restored `pull_request` triggers for `main` and `beta` branches in `.github/workflows/ci.yml`; isolated concurrency groups using `ci-${{ github.event_name }}-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.ref_name }}` to prevent push/PR run collisions; expanded the `installer-integrity` job into a matrix spanning both `ubuntu-latest` and `windows-latest`.
  - **Verification & Testing**: PR #7 checks passed across Ubuntu and Windows installer integrity suites, Rust quality checks, WebUI build, and version consistency.

---

- **[CI 与质量门禁] 恢复 Pull Request 自动化 CI 触发、隔离并发分组并补回 Windows 安装脚本完整性测试**:
  - **技术机理 / 现象溯源**: 此前流水线精简时移除了 `pull_request` 触发，而 `ci.yml` 仅监听 `push` 事件，导致提交至 `main` 和 `beta` 的 PR 在合并前缺少自动化 CI 门禁；同时安装脚本完整性测试被缩减为仅在 Ubuntu 上运行，导致 Windows PowerShell 安装脚本与包装器缺少托管 Windows Runner 的自动化覆盖；原 concurrency key 亦未隔离事件类型，分支 push 存在误取消 PR 运行的隐患。
  - **实现防线 / 核心改动**: 在 `.github/workflows/ci.yml` 中为 `main` 与 `beta` 分支重新挂载 `pull_request` 触发器；将 concurrency 组重构为 `ci-${{ github.event_name }}-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.ref_name }}`，显式隔离 push 与 PR 事件避免相互抢占；将 `installer-integrity` 作业扩展为 `ubuntu-latest` 与 `windows-latest` 跨平台矩阵测试。
  - **验证与交付**: PR #7 对应各项质量门禁（Ubuntu/Windows 安装脚本完整性、Rust 代码质量、WebUI 构建与版本一致性）均验证通过。


## v7.1.53-beta.10 (2026-10-06)

- **[Release Pipeline / Desktop Bundle] Keep the Linux x64 desktop bundle on ubuntu-22.04 and treat the runner image as a compatibility contract**:
  - **Technical Root Cause / Detail**: The desktop matrix built the x64 deb/appimage/rpm bundles on `ubuntu-22.04`. A migration to `ubuntu-24.04` was attempted on the assumption that the job's `Install Linux WebKit` step could not resolve `libwebkit2gtk-4.1-dev` on 22.04. The assumption was wrong, and the move raised the glibc floor from 2.35 to 2.39, silently dropping Ubuntu 22.04, Debian 12 (glibc 2.36) and Debian 11 (glibc 2.31) from the deb. The runner image is therefore not a free upgrade: it decides which distributions can install the package.
  - **Implementation Mechanism**: `.github/workflows/build.yml` desktop matrix x64 entry restored to `ubuntu-22.04`, keeping the arm64 entry on `ubuntu-24.04-arm` by design. The CLI artifacts are unaffected because they are musl statically linked; only the desktop installers carry the glibc constraint. The migration is deferred until GitHub announces the 22.04 deprecation date, at which point the correct fix is a `ubuntu-24.04` runner hosting a `ubuntu:22.04` container rather than changing the image.
  - **Verification & Testing**: Confirmed against the beta.6 release run (37343831117) and its `Desktop ubuntu-22.04 deb,appimage,rpm` job (111888657395) that `Install Linux WebKit`, `Build desktop installers` and `Upload desktop installers` all conclude `success` on `ubuntu-22.04`, proving the 4.1 packages resolve correctly there. Workflow-only change; no Rust or WebUI sources touched.

---

- **[发布流水线与桌面安装包] Linux x64 桌面安装包维持在 ubuntu-22.04，并把 runner 镜像确立为兼容性契约**:
  - **技术机理 / 现象溯源**: desktop 矩阵此前在 `ubuntu-22.04` 上构建 x64 的 deb/appimage/rpm。因误判该镜像无法解析 `Install Linux WebKit` 步骤所需的 `libwebkit2gtk-4.1-dev`，一度迁移至 `ubuntu-24.04`；但该判断不成立，而迁移会把 glibc 下限从 2.35 抬升到 2.39，导致 Ubuntu 22.04、Debian 12（glibc 2.36）与 Debian 11（glibc 2.31）用户无法安装 deb。runner 镜像不是可随意升级的版本号，它直接决定安装包的发行版覆盖面。
  - **实现防线 / 核心改动**: 将 `.github/workflows/build.yml` desktop 矩阵的 x64 条目回退为 `ubuntu-22.04`，arm64 条目按设计继续使用 `ubuntu-24.04-arm`。CLI 二进制走 musl 静态链接不受影响，glibc 约束仅作用于桌面安装包。迁移推迟到 GitHub 正式公告 22.04 弃用日期之后，届时的正确解法是 runner 使用 `ubuntu-24.04`、构建放进 `ubuntu:22.04` 容器，而不是更换镜像。
  - **验证与交付**: 依据 beta.6 发布运行（37343831117）中 `Desktop ubuntu-22.04 deb,appimage,rpm`（job 111888657395）的实测结果确认：`Install Linux WebKit`、`Build desktop installers`、`Upload desktop installers` 三个步骤在 `ubuntu-22.04` 上均为 `success`，证明 4.1 系列包在该镜像上可正常解析。本次为纯 workflow 改动，未触及任何 Rust 或 WebUI 源码。

## v7.1.53-beta.9 (2026-10-06)

- **[Datalog & Disk Protection] Disable per-turn datalog by default, enforce hard disk quotas, and migrate legacy configurations**:
  - **Technical Root Cause / Detail**: Datalog dumps raw per-turn requests and responses into `~/.jeikcode/datalog/` for offline model training/debugging without size caps or retention policies, causing long-term sessions to accumulate up to 26+ GB of dump files and fill user system disks; default configs previously shipped with `enabled = true`.
  - **Implementation Mechanism**: Switched default initialization of `datalog.enabled` to `false` in `DatalogConfig` and all bundled templates (`default-config.toml`); introduced `max_total_mb` (512 MB) and `max_days` (7 days) bounds with automatic FIFO pruning in `crates/jeikcode-capabilities/src/datalog.rs`; updated `merge_user_config_preserving_models` in `crates/jeikcode-coding/src/config_sync.rs` so template sync diff checks actively detect and flip legacy enabled datalogs to `false`.
  - **Verification & Testing**: Passed `prune_datalog_directory_cleans_excess_files` and config roundtrip tests, formatted with `cargo fmt`, and passed full WebUI build gate.

---

- **[会话日志与磁盘保护] 默认彻底关闭 datalog 全量 dump，加设容量硬上限并自动迁移关闭历史遗留开启项**:
  - **技术机理 / 现象溯源**: 历史版本中 `[datalog]` 默认开启且缺乏文件容量限制与保留期机制，导致每一轮对话都将完整提示词、代码上下文与工具输出全量 dump 到 `~/.jeikcode/datalog`，长期使用后累积达到数十 GB 甚至撑爆 C 盘；且模板默认初始化均为 `enabled = true`。
  - **实现防线 / 核心改动**: 将 `DatalogConfig` 核心初始化与所有内置模板（`default-config.toml`）默认值彻底改为 `enabled = false`；增加 `max_total_mb`（512 MB）与 `max_days`（7 天）双重硬顶上限，并在写入前自动执行基于 mtime 的 FIFO 滚动淘汰清理（`prune_datalog_directory`）；在 `config_sync.rs` 配置更新合并逻辑中加入安全防线，在检测到配置更新时自动将老用户遗留开启的 `datalog.enabled` 修正覆盖为 `false`，彻底保护磁盘空间。
  - **验证与交付**: 增加目录超限自动修剪单测并验证通过，`cargo fmt` 格式化通过，前端 TypeScript 强类型校验与生产构建顺利通过。

## v7.1.53-beta.8 (2026-10-06)

- **[Daemon & Session Switch] Prevent duplicate approval toast prompts when switching sessions during tool execution**:
  - **Technical Root Cause / Detail**: In `pending_interactive_from_replay` and `replay_resolves_call` within the daemon, only `ToolCallResult` and `ToolOutputChunk` marked a tool call as resolved, omitting `ChatEvent::ToolCallStarted`. During long-running or silent tool executions (such as `run_command`), `GET /chat/pending` incorrectly classified the running tool as waiting for approval. In WebUI, `transcriptToolCallIsResolved` returned false for in-flight tools with `status === 'pending'`, causing `restorePendingInteractive` to falsely demote executing tools to `waiting_approval` upon session switching and repeatedly trigger OS approval toasts.
  - **Implementation Mechanism**: Added `ChatEvent::ToolCallStarted` to `resolved_call_ids` and `replay_resolves_call` in `crates/jeikcode-daemon/src/lib.rs` to recognize started tools as resolved; updated `transcriptToolCallIsResolved` in `webui/src/lib/chatTerminal.ts` so that tools not in `waiting_approval` (i.e. `pending`, `done`, `error`, `incomplete`) are treated as resolved, preventing resurrecting approval cards or firing desktop notifications when switching sessions.
  - **Verification & Testing**: Passed 36/36 unit tests in `chatTerminal.test.ts` including tests verifying `pending` in-flight tools are resolved, and verified clean TypeScript build.

---

- **[守护进程与会话切换] 彻底修复工具执行期间来回切换会话反复触发审批通知的缺陷**:
  - **技术机理 / 现象溯源**: 后端守护进程中的 `pending_interactive_from_replay` 与 `replay_resolves_call` 在判断某个 `call_id` 是否已解决时仅匹配了 `ToolCallResult` 和 `ToolOutputChunk`，漏掉了 `ChatEvent::ToolCallStarted`，导致耗时或无输出的正在运行中工具在 `GET /chat/pending` 中被误判为未审批；前端 `transcriptToolCallIsResolved` 对处于 `'pending'` 执行中的工具返回了 false，导致用户来回切换 session 时 `restorePendingInteractive` 将正在运行的工具误改回 `waiting_approval` 并反复调用 `dispatchSystemNotification` 触发系统 Toast 弹窗通知。
  - **实现防线 / 核心改动**: 在 `crates/jeikcode-daemon/src/lib.rs` 中为 `resolved_call_ids` 及 `replay_resolves_call` 增加对 `ChatEvent::ToolCallStarted` 的匹配，工具一旦启动即标记为已解决；重构 `webui/src/lib/chatTerminal.ts` 中的 `transcriptToolCallIsResolved`，只要工具状态不为 `waiting_approval`（即处于 `pending` 运行中或已完成）均判定为已处理，彻底杜绝切换会话时卡片复活与重复弹窗。
  - **验证与交付**: `chatTerminal.test.ts` 36 项单测全绿，涵盖运行中状态判定用例，前端全量构建通过。

## v7.1.53-beta.7 (2026-10-06)

- **[Approval & Multi-Client Sync] Real-time approval mode synchronization across mobile and desktop clients**:
  - **Technical Root Cause / Detail**: ApprovalMode changes triggered on mobile devices or secondary browser tabs were updated in daemon memory, but other active WebUI clients lacked live cross-client notification and only queried the mode upon initial mount.
  - **Implementation Mechanism**: Introduced the `broadcastApprovalMode` utility leveraging `BroadcastChannel('jeikcode_approval_mode')` and custom events in `api.ts`; added edge-triggered broadcast dispatch in `NotificationDock.tsx`; and subscribed `Chat.tsx` to broadcast channels, document visibility changes, and window focus events to seamlessly sync `ApprovalMode` without page reloads.
  - **Verification & Testing**: WebUI production build passed cleanly, and real-time mode transitions verified across active tabs and polling ticks.

- **[Mobile UX & Notification Dock] Fix approval capsule collapse persistence and header edge placement**:
  - **Technical Root Cause / Detail**: Once a mobile user expanded an approval card, `mobileExpanded` remained true even after the review completed, forcing subsequent approval tasks to display as expanded cards instead of compact capsules; additionally, the capsule top offset of `12px` overlapped top navigation actions and model triggers.
  - **Implementation Mechanism**: Tracked card lifecycle in `NotificationDock.tsx` to automatically restore collapsed capsule state when all cards resolve; ensured newly incoming approval requests default to collapsed capsules; added a dedicated "Collapse ▲" button in the deck header for single and multi-card states; and repositioned `.notify-dock` top anchor to `calc(48px + env(safe-area-inset-top, 0px) + 6px)` immediately flush beneath the top navigation boundary.
  - **Verification & Testing**: Verified responsive mobile breakpoint layout in CSS and automated test pass in `sessionNotify.test.ts`.

- **[Localization & Action Buttons] Pure language notifications and eliminate bilingual button mixing**:
  - **Technical Root Cause / Detail**: Toast action buttons previously displayed mixed bilingual text ("Approve / 同意", "Deny / 拒绝", "Answer / 作答") and hardcoded a Chinese "会话:" prefix regardless of the active language setting.
  - **Implementation Mechanism**: Refactored Windows Toast XML and Linux `notify-send` scripts in `crates/jeikcode-capabilities/src/notify.rs` to dynamically detect language context; enforced pure English ("Approve", "Deny", "Answer", "Session:") and pure Chinese ("同意", "拒绝", "作答", "会话:") with zero bilingual mixing; expanded `i18n.ts` with localized notification action keys.
  - **Verification & Testing**: Executed `cargo fmt` and updated unit tests in `notify.rs` verifying strict unilingual button content.

- **[Theme & Visual System] Refine dark canvas background to eye-friendly charcoal and preserve message bubble contrast**:
  - **Technical Root Cause / Detail**: The main chat stage previously defaulted to pure pitch-black (`#131314`), causing harsh visual contrast and eye fatigue, while message bubbles and todo panels required balanced separation from both the canvas and the sidebar.
  - **Implementation Mechanism**: Softened `--app-primary-background` and `--app-header-background` in `theme.css` to warm charcoal grey (`#1b1c1e`), visually aligning with the sidebar (`#1e1f20`); refined the user message bubble background to `#2c2e32` to maintain prominent, comfortable contrast against the canvas; and styled `.session-todo-panel` with a subtle translucent secondary fill.
  - **Verification & Testing**: Verified dark and light palette readability, border consistency, and successful TypeScript typecheck and build.

---

- **[审批系统与多端同步] 移动端与多标签页 WebUI 跨端实时同步审批模式 (ApprovalMode)**:
  - **技术机理 / 现象溯源**: 移动端手机或其他浏览器标签页切换 Build / Auto 等审批模式后，后端进程虽然更新了模式，但已打开的其他 WebUI 客户端仅在组件初次挂载时读取一次，导致客户端之间无法感知对端模式切换。
  - **实现防线 / 核心改动**: 在 `api.ts` 中封装 `broadcastApprovalMode`，利用 `BroadcastChannel('jeikcode_approval_mode')` 与自定义 DOM 事件广播最新模式；在 `NotificationDock.tsx` 2 秒周期轮询中检测模式跳变并触发跨端广播；在 `Chat.tsx` 中监听广播、窗口重新聚焦与可见性恢复事件，使各端无需手动刷新即可毫秒级无感同步审批模式。
  - **验证与交付**: WebUI 生产打包通过，多端模式广播与轮询边缘触发逻辑验证完备。

- **[移动端交互体验] 修复审批卡折叠状态保持失效并下移横条贴齐顶栏下沿**:
  - **技术机理 / 现象溯源**: 移动端审批卡在用户点击展开一次后，`mobileExpanded` 状态未在卡片审批完成或清空时重置，导致后续新的审批请求直接以全屏卡片形式弹出而无法恢复为消息小胶囊；且收纳小条原定位在 `top: 12px`，恰好重叠遮挡了顶栏菜单按钮与模型选择器。
  - **实现防线 / 核心改动**: 在 `NotificationDock.tsx` 中监听卡片总数与变更生命周期，当卡片清空或新审批到来时自动恢复折叠横条态；单张卡片或多张卡片展开时均在顶部提供常驻“收起 ▲”按钮；将 `.notify-dock` 移动端顶部定位调整为 `calc(48px + env(safe-area-inset-top, 0px) + 6px)`，紧贴状态栏与顶栏下沿首位展示，彻底消除按钮遮挡。
  - **验证与交付**: 移动端视口样式校验通过，`sessionNotify.test.ts` 8 项单测全绿。

- **[国际化与通知操作] 纯英文/纯中文系统通知与审批按钮，杜绝中英混杂**:
  - **技术机理 / 现象溯源**: Windows Toast 与桌面通知按钮此前采用 "Approve / 同意"、"Deny / 拒绝" 等中英混排，且会话行强行硬编码中文“会话:”，在英文语言模式下弹出体验割裂。
  - **实现防线 / 核心改动**: 重构 `crates/jeikcode-capabilities/src/notify.rs` 中的 Windows Toast XML 与桌面通知脚本生成逻辑，按标题语言上下文精准路由：英文语言下输出纯英文（`Approve` / `Deny` / `Answer` / `Session:`），中文语言下输出纯中文（`同意` / `拒绝` / `作答` / `会话:`），严禁中英交叉混排；在 `i18n.ts` 中补全通知操作的中英文字典。
  - **验证与交付**: 执行 `cargo fmt` 代码格式化，更新 `notify.rs` 单元测试并通过断言验证。

- **[主题视觉与护眼调色] 会话面板告别刺眼纯黑，对齐左侧炭灰质感并强化气泡层级**:
  - **技术机理 / 现象溯源**: 暗色模式主会话面板底色原为高对比深黑（`#131314`），长时间凝视容易产生视觉疲劳；同时用户消息气泡、任务面板与侧栏底色需兼顾整体一致性与层次区分度。
  - **实现防线 / 核心改动**: 将 `theme.css` 中 `--app-primary-background` 与顶栏底色调优为护眼炭灰黑（`#1b1c1e`），与左侧会话栏（`#1e1f20`）形成平滑柔和的同阶质感；将用户消息气泡背景调优为 `#2c2e32`，确保气泡轮廓层次鲜明不融底；将任务面板底色适配为半透明二次表面，亮色模式保持清晰规范。
  - **验证与交付**: 经 TypeScript 编译与 Vite 生产构建全流程验证，色彩对比度舒适护眼。

## v7.1.53-beta.6 (2026-10-06)

- **[TypeScript & Type Safety] Fix WebUI typecheck regressions across Chat, GitPanel, Markdown, and NotificationDock**:
  - **Technical Root Cause / Detail**: `tsc --noEmit` detected TS2367 narrow type comparison on queued message kind in `Chat.tsx`; `SettingsCtx` had no `settings` field in `GitPanel.tsx` and `Markdown.tsx`; `commitFiles` was referenced before block declaration in `GitPanel.tsx`; `TransformWrapper` render props lacked parameter type annotation in `MermaidDiagram.tsx`; and `NotificationDock.tsx` lacked the `ask.title` translation key.
  - **Implementation Mechanism**: Removed redundant narrowed `disabled` check in `Chat.tsx`; aligned `useSettings()` callers to use `theme` and `lang` directly; hoisted `commitFiles` state declaration above helper closures in `GitPanel.tsx`; typed `TransformWrapper` render props parameters; and added bilingual `ask.title` entries in `i18n.ts`.
  - **Verification & Testing**: WebUI typecheck passed with zero errors (`npm run typecheck`), 19/19 test suite passed, and clean production build verified.

- **[WebUI & Git Graph] Align commit hover details with VSCode, support full %B message, diff stats, and fix hover card obstruction**:
  - **Technical Root Cause / Detail**: Previously, the git log graph API truncated commit messages to single-line subjects (`%s`), omitting multi-line bodies, descriptions, and co-authorship trailers; hover cards lacked file insertion/deletion stats; and hover cards could be occluded by lower-left floating docks due to insufficient z-index and viewport overflow.
  - **Implementation Mechanism**: Upgraded daemon git log formatter to `%B` with control-character field separators and `--shortstat` parsing; enhanced `GitCommitItem` and `GitCommitDetailResp` with `total_files`, `total_additions`, and `total_deletions`; overhauled the Git hover details card with author metadata, formatted timestamps, multi-line pre-wrap bodies, diff stats pills, and remote GitHub/GitLab links; elevated hover card z-index to 9999 with dynamic viewport height clamping.
  - **Verification & Testing**: Passed 6/6 unit tests in `gitGraph.test.ts` and verified responsive positioning.

- **[WebUI & Navigation Layout] Header tab overflow auto-collapse, deduplicate Chat tab, mobile viewport-safe drawer, and composer layout refinement**:
  - **Technical Root Cause / Detail**: Opening diffs created a redundant "Chat" tab when clicking the session title already returns to chat; desktop tabs collapsed prematurely leaving wide gaps before the right toolbar; mobile tabs overflowed screen bounds; and the lower-left `current:` elapsed timer compressed mobile composers, pushing the send button offscreen.
  - **Implementation Mechanism**: Removed redundant "Chat" tab and title dropdown menus—clicking the session title now switches straight to chat; eliminated `header-spacer` so tabs span fully until approaching the right toolbar buttons, revealing a chevron overflow menu for remaining tabs; redesigned mobile session/diff switcher into a viewport-constrained floating drawer (`left: 8px; right: 8px`) immune to screen truncation; removed redundant composer floating elapsed timer and polished context token pill typography.
  - **Verification & Testing**: Verified desktop resizing boundaries and mobile viewport constraints with zero overflow.

- **[WebUI & Chart Media] Modern interactive Mermaid diagram integration with pan/zoom gestures, subtle grid, and full-screen modal**:
  - **Technical Root Cause / Detail**: Model-generated ````mermaid` blocks previously rendered as plain text code boxes without visual rendering or diagram navigation capabilities.
  - **Implementation Mechanism**: Integrated official `mermaid`, `react-zoom-pan-pinch`, and `lucide-react` libraries; intercepted `mermaid` code fences in `markdownRender.ts` into dedicated mount points; developed `MermaidDiagram.tsx` featuring subtle grid canvas, floating frosted action pill, mouse wheel/pinch-to-zoom navigation, dark/light theme alignment, code/diagram toggle, SVG download, and fullscreen modal mode with graceful streaming syntax fallback.
  - **Verification & Testing**: Passed 13/13 markdown render tests in `markdownRender.test.ts` and completed clean Vite production bundle code splitting.

---

- **[TypeScript 与类型安全] 修复 WebUI 全流程类型校验错误（Chat、GitPanel、Markdown 与 NotificationDock）**：
  - **技术机理 / 现象溯源**: 流水线执行 `tsc --noEmit` 报出 5 项类型错误：`Chat.tsx` 在类型窄化块内冗余比较 `q.kind` 触发 TS2367；`GitPanel.tsx` 与 `Markdown.tsx` 解构不存在的 `settings` 属性；`GitPanel.tsx` 在 `commitFiles` 声明前闭包访问触发 TS2448；`MermaidDiagram.tsx` 的 `TransformWrapper` 解构形参缺乏类型注解；`NotificationDock.tsx` 缺少 `ask.title` 国际化键。
  - **实现防线 / 核心改动**: 精简 `Chat.tsx` 按钮禁用属性；对齐 `useSettings()` 标准协议，统一使用 `theme` 与 `lang`；提前提升 `commitFiles` 状态定义；补充解构形参类型约束；在 `i18n.ts` 中补齐 `ask.title` 中英文案。
  - **验证与交付**: `npm run typecheck` 零错误通过，全量生产打包与单测全绿。

- **[WebUI 与 Git 图谱] 对齐 VSCode 风格详细提交信息、支持完整 %B 消息与增删统计、修复悬浮卡片遮挡**：
  - **技术机理 / 现象溯源**: 历史 Git 图谱接口仅截取单行标题（`%s`），导致多行正文与共同署名信息完全丢失；悬浮卡片缺失文件增删行数统计；且在较低高度下容易被左下角待办托盘等高层级浮窗遮挡。
  - **实现防线 / 核心改动**: 后端 `api_git.rs` 升级为安全控制字符定界与 `%B` 完整提交消息解析，并引入 `--shortstat` 解析器自动提取文件数与增删行；重构前端 VSCode 风格 Commit 悬浮卡片（展示作者与时间、突出标题、支持滚动的多行正文、红绿增删统计行、分支胶囊与外链）；将卡片层级提升至 `9999` 并添加自适应高度与视口边界保护。
  - **验证与交付**: `gitGraph.test.ts` 6 项单测全绿，生产界面悬浮与点击展开验证通过。

- **[WebUI 导航与布局优化] 顶栏 Diff 标签触界自适应收纳、去除冗余 Chat 标签、手机端视口防截断与输入框空间释放**：
  - **技术机理 / 现象溯源**: 打开 Diff 后顶栏额外生成冗余的 Chat 标签；电脑端标签栏过早压缩导致右侧大片空白未被利用；手机端标签栏容易超出屏幕边缘；输入框左下角 `current:` 实时计时器挤占横向空间导致发送按钮被顶出界。
  - **实现防线 / 核心改动**: 去除冗余 Chat 标签与会话标题多余菜单，会话标题直接作为返回聊天的主入口；移除抢占空间的 `header-spacer`，标签栏完全撑满到最右侧按钮组边界，触界才收缩并在最右侧提供向下箭头展开菜单；移动端重构为绝对视口安全边距布局（`left: 8px; right: 8px`），绝不偏左偏右被截断；移除输入框底部冗余计时器，微调优化上下文窗口字数排版。
  - **验证与交付**: 经过桌面端横拉缩放边界与移动端视口防溢出测试。

- **[WebUI 图媒体系统] 引入主流 Mermaid 交互式矢量图展示、支持手势平移缩放、微质感网格与全屏模态**：
  - **技术机理 / 现象溯源**: 大模型输出的 ````mermaid` 流程图与架构图此前降级为普通纯文本代码框，缺乏交互式矢量图表展现能力。
  - **实现防线 / 核心改动**: 引入官方 `mermaid` 核心、`react-zoom-pan-pinch` 与 `lucide-react` 现代图标；在 Markdown 管道中精准拦截并水合挂载；打造兼具桌面滚轮/拖拽漫游与移动端双指捏合（Pinch-to-zoom）的图表系统，配备微质感点阵背景、毛玻璃悬浮胶囊栏、一键全屏模态框、代码/图表切换、SVG 下载及大模型流式未闭合语法防白屏优雅容灾。
  - **验证与交付**: `markdownRender.test.ts` 13 项单元测试全部通过，全量生产打包按需代码分割顺畅。

## v7.1.53-beta.4 (2026-10-05)

- **[Release & CI Security] Harden reproducible builds, locked dependencies, and installer integrity**:
  - **Technical Root Cause / Detail**: Builds and public installations previously lacked fail-closed integrity gates: `build.rs` performed non-hermetic asset mutations from developer homes; cargo/npm builds were unpinned; release publishing checked out moving branches; and public installers lacked SHA256 and byte-size verification before replacing binaries.
  - **Implementation Mechanism**: Pinned Node 22.22.0 and Rust 1.93.0 with `--locked` across all build paths; removed build-time host mutations from `build.rs`; enforced scoped GHA permissions and exact-SHA checkout in release workflows; added strict SHA256 and size verification in `install.sh` and `install.ps1`; unified legacy alias wrappers; and instituted automated version consistency checks across all 11 shipping manifests.
  - **Verification & Testing**: Passed 12 cross-platform installer integrity fixture tests in `scripts/test_installers.py`, version consistency checks, and WebUI/Rust quality gates.

- **[WebUI & Responsive Layout] Adaptive top navigation, mobile composer refinement, and multi-version update resolution**:
  - **Technical Root Cause / Detail**: On mobile and narrow desktop viewports, header action buttons overflowed and misaligned; mobile keyboards sent messages on Enter prematurely; and update checks could be trapped by stale caches or stop at intermediate releases.
  - **Implementation Mechanism**: Implemented 3-tier adaptive header collapse (collapsing low-frequency actions into overflow menus on narrow screens); optimized mobile composer with soft-keyboard Enter newlines; implemented backend `find_highest_release` SemVer resolution for direct single-step updates to the latest release; and enhanced the update dialog with on-open cache bypass and background polling.
  - **Verification & Testing**: WebUI typecheck passed with zero errors (`tsc --noEmit`), 293/293 test suite passed, and production builds verified.

- **[TypeScript & Type Safety] Repair notification dock, provider groupings, and i18n typing**:
  - **Technical Root Cause / Detail**: `NotificationDock.tsx` mismatched string vs number request IDs in local dismissal; `SettingsDialogs.tsx` inferred `unknown[]` on provider/account mapping; and `Sidebar.tsx` lacked the `sidebar.dragToResize` translation key.
  - **Implementation Mechanism**: Normalized `callOrReqId` handling in `NotificationDock`; strongly typed `AccountInfo[]` and `ProviderInfo[]` in `SettingsDialogs`; added bilingual `sidebar.dragToResize` keys to `i18n.ts`; and integrated automatic `package-lock.json` version bumping in `bump-version.js`.
  - **Verification & Testing**: Verified via `npm run typecheck` and `node scripts/check-version-consistency.js`.

---

- **[发布与构建安全] 全面加固可复现构建、锁定依赖门禁与安装器防篡改完整性**：
  - **技术机理 / 现象溯源**: 历史构建与分发缺乏强完整性校验：`build.rs` 曾在编译期隐式抓取宿主机文件覆盖源码造成构建脏污；依赖未锁定导致不同环境产物漂移；发布流程依赖浮动分支；公共安装脚本下载未校验哈希与大小。
  - **实现防线 / 核心改动**: 锁定 Node 22.22.0 与 Rust 1.93.0 工具链，全流程启用 `npm ci` 与 `cargo --locked`；移除 `build.rs` 宿主机隐式副作用；发布流水线最小化权限并锚定触发 Tag 的精确 SHA；`install.sh` 与 `install.ps1` 增加强校验 SHA256 与字节大小，不匹配立即熔断，杜绝篡改与损坏；新增全仓 11 处清单版本一致性自动化门禁。
  - **验证与交付**: `scripts/test_installers.py` 12 项跨平台防篡改测试全绿通过，版本一致性门禁验证通过。

- **[WebUI 体验与响应式架构] 顶栏三级自适应收纳排布、移动端输入体验优化与跨版本一步直升**：
  - **技术机理 / 现象溯源**: 窄屏与手机端顶栏操作按钮容易挤占换行；移动端软键盘回车易误触发送；版本更新检查易受旧缓存干扰且无法一步直升最新版。
  - **实现防线 / 核心改动**: 构建顶栏三级自适应收纳机制（窄屏自动折叠次要操作至三点菜单，手机端保持极简单行）；优化移动端与触控设备输入条，软键盘回车保持物理换行；后端升级 `find_highest_release` 寻优算法，支持跨多版本一次直升最高发布版；前端更新弹窗支持无缓存即时探测与前台静默轮询。
  - **验证与交付**: WebUI 生产构建与 293 项前端单测全部通过。

- **[前端类型安全与细节修复] 修复通知托盘 ID 判定、账号分组类型推导与国际化缺失**：
  - **技术机理 / 现象溯源**: `NotificationDock.tsx` 中请求 ID 存在字符串与数字类型不匹配警告；`SettingsDialogs.tsx` 在处理账号映射时被推导为 `unknown[]`；侧栏拉伸把手缺少 `sidebar.dragToResize` 国际化文案。
  - **实现防线 / 核心改动**: 在 `NotificationDock` 中统一字符串化比对；在 `SettingsDialogs` 中显式约束 `AccountInfo[]` 与 `ProviderInfo[]`；在 `i18n.ts` 中补充中英双语文案；在 `bump-version.js` 中联动更新 `package-lock.json` 版本号。
  - **验证与交付**: `npm run typecheck`（`tsc --noEmit`）零错误通过。

## v7.1.53-beta.3 (2026-10-05)

- **[Security & Trust Boundaries] Harden daemon network exposure, git discard operations, and session boundaries**:
  - **Technical Root Cause / Detail**: A security audit identified four critical trust boundary weaknesses: daemon bound to non-loopback addresses without enforced authentication; `/git/discard` vulnerable to directory traversal and pathspec expansion; sensitive path gates bypassing checks through benign symlinks; and process-global bash state leaking across concurrent sessions.
  - **Implementation Mechanism**: Enforced mandatory access token for non-loopback daemon binds via `--token` or `JEIKCODE_SERVER_TOKEN` (failing closed on unauthenticated attempts); restricted `/git/discard` to validated repo-relative paths with `GIT_LITERAL_PATHSPECS=1` and untracked status verification; resolved filesystem symlink targets in `SensitivePathGate` and `WriteApprovalGate`; moved bash background registry, alerts, and keywords to per-`CodingRuntime` ownership.
  - **Verification & Testing**: Targeted security regression tests across daemon, git discard, symlink read/write gates, and session lifecycle passed.

- **[WebUI Markdown Rendering] Resolve nested code block fragmentation and double-fence glitch**:
  - **Technical Root Cause / Detail**: In `webui/src/lib/markdownPrep.ts`, `fenceClose` mistakenly treated opening sub-fences with language suffixes as closing tags. Furthermore, nested 3-backtick markdown blocks inside 3-backtick outer blocks caused premature termination and inverted code block selection.
  - **Implementation Mechanism**: Fixed `fenceClose` to require strictly pure backtick lines. Introduced `promoteNestedCodeFences` to dynamically elevate outer container fences to 4+ backticks, and tracked nesting depth in `findMatchingFenceClose` for markdown containers.
  - **Verification & Testing**: Added targeted regression test `nested markdown code blocks do not break outer block or trigger double fences`, 294 webui tests passed.

- **[CodeGraph & Index Guidance] Autonomous single-repo index creation and multi-repo noise prevention**:
  - **Technical Root Cause / Detail**: When navigating unindexed workspaces, models either hallucinated symbols or hesitated to initialize code intelligence. Additionally, indexing across root multi-repo directories caused severe noise and performance degradation.
  - **Implementation Mechanism**: Upgraded unindexed guidance in `codeintel/mod.rs` with clear scenario routing: directly instruct agents to execute `jeikcode init --force` on dedicated single repos and re-query tools; warn against global root indexing for multi-repo workspaces while recommending per-subproject indexing.
  - **Verification & Testing**: Verified `no_codegraph_guidance_routing_instructions` unit test; updated quickstart documentation.

- **[Git Panel Experience] Add VSCode-style interactive commit hover details card**:
  - **Technical Root Cause / Detail**: Commit rows only displayed basic truncated messages via browser native tooltips, lacking author emails, commit dates, parents, and full commit bodies.
  - **Implementation Mechanism**: Implemented floating `.git-commit-hover-card` displaying commit hash, quick copy button, ref pills, author info, exact formatted timestamp, parent hashes, and pre-wrapped multiline commit bodies, complete with 240ms hover debounce and viewport edge clamping.
  - **Verification & Testing**: Verified in WebUI build and component rendering.

- **[Skill System Universal Compatibility] Standardize on cross-agent `.agents/skills` and `.skills` conventions**:
  - **Technical Root Cause / Detail**: Diverse external agent frameworks (OpenCode, Grok, etc.) store reusable skills under shared directories, while legacy discovery only checked a subset.
  - **Implementation Mechanism**: Standardized `standard_skill_dirs` across user and workspace levels to support `.agents/skills`, `.agents/commands`, `.skills`, and `skills`, while ensuring `.jeikcode` native skills retain highest priority on collisions.
  - **Verification & Testing**: Passed `standard_dirs_include_agents_skills_between_claude_and_jeikcode` unit test and updated teaches documentation.

---

- **[安全与运行时信任防线] 全面加固守护进程网络暴露、Git 放弃修改与跨会话状态隔离**：
  - **技术机理 / 现象溯源**: 安全审计识别出 4 个核心信任边界隐患：非回环地址绑定时无鉴权暴露；`/git/discard` 易受目录穿越与 Git 通配符扩展误删文件；软链接绕过敏感路径审批；全局静态 Bash 任务在多会话并发下串扰。
  - **实现防线 / 核心改动**: 非回环地址启动 daemon 强制要求 `--token` 或 `JEIKCODE_SERVER_TOKEN`，未配置直接拒绝启动；`/git/discard` 限制为仓库相对白名单路径，开启 `GIT_LITERAL_PATHSPECS=1` 与双重 Git 校验；审批网关对齐文件系统物理实体解析符号链接；Bash 任务注册表下放到各自 `CodingRuntime`。
  - **验证与交付**: 覆盖 Daemon、Git discard、软链接审批及会话隔离的系列单测通过。

- **[WebUI Markdown 渲染防线] 彻底根除嵌套代码块断裂与二次反相框选缺陷**：
  - **技术机理 / 现象溯源**: 预处理器 `fenceClose` 误将带有语言标识的子围栏开启当成闭合，且内外层同为 3 个反引号时违反 CommonMark 规则导致外层代码块腰斩，使后续正文暴露并被尾部闭合标记反向框选。
  - **实现防线 / 核心改动**: 严格限定闭合标记仅允许纯反引号；新增 `promoteNestedCodeFences` 自适应将包含子代码块的外层围栏提升为 4+ 反引号；`findMatchingFenceClose` 引入栈深度跟踪。
  - **验证与交付**: 新增嵌套代码块回归单测，WebUI 全套 294 项单元测试 100% 通过。

- **[代码图谱与路由引导] 单仓库支持 Agent 自主构建索引，多仓库精准防噪音分流**：
  - **技术机理 / 现象溯源**: 项目未建索引时模型缺乏明确行动指引；多仓库全局建索引会产生严重符号混淆与检索噪音。
  - **实现防线 / 核心改动**: 升级 `no_codegraph_tool_guidance` 智能路由：单一项目直接引导 Agent 执行 `jeikcode init --force` 并在完成后重新检索；多项目综合目录强烈警告禁止在根目录建全局索引，指导进入各子目录分别执行。
  - **验证与交付**: 通过 `no_codegraph_guidance_routing_instructions` 单测，文档起步指南同步更新。

- **[Git 面板交互升级] 新增 VSCode 风格提交悬停卡片与多行提交详情展示**：
  - **技术机理 / 现象溯源**: 原生 `title` 提示简陋且无法展示长信息，用户无法便捷查阅提交哈希、作者邮箱、父提交与多行提交正文。
  - **实现防线 / 核心改动**: 实现 `.git-commit-hover-card` 浮层卡片，展示短哈希、一键复制、分支/标签徽标、作者邮箱、格式化绝对与相对时间、父哈希以及多行提交详情，附带 240ms 防抖与视口边缘安全避让。
  - **验证与交付**: 完成前端生产打包与交互验证。

- **[技能系统生态兼容] 规范对齐 `.agents/skills` 与 `.skills` 跨 Agent 共享目录**：
  - **技术机理 / 现象溯源**: 开源生态存在多种通用技能存储约定，需要无缝复用其他 coding agent 的已有技能资产。
  - **实现防线 / 核心改动**: 在 `standard_skill_dirs` 中规范扩展用户层与项目层 `.agents/skills`、`.agents/commands` 及 `.skills`，严格保持 JeikCode 本地技能最高优先级覆盖。
  - **验证与交付**: 运行技能发现目录单元测试通过，同步更新宿主机与源码 teaches 知识库。

## v7.1.53-beta.2 (2026-10-05)

- **[OS Notification Defense] Prevent terminal notifications from mistakenly adding Approve/Deny action buttons**:
  - **Technical Root Cause / Detail**: In `crates/jeikcode-capabilities/src/notify.rs`, any notification whose body contained review keywords (e.g. session titled "JeikCode PR 5 审核") was misclassified as an approval prompt, inappropriately attaching Approve/Deny buttons to finished turn toasts. Clicking them had no effect because the turn was already done.
  - **Implementation Mechanism**: Updated `windows_toast_xml` to inspect the title rather than body for review keywords, and strictly exclude terminal notifications (`done`, `finished`, `completed`, `stopped`, `failed`) from attaching action buttons.
  - **Verification & Testing**: Automated unit test `test windows_toast_approval_includes_action_buttons` passed.

- **[Git Panel & Turn Nav Experience] Default to Git view, prominent inspector rail buttons, and mobile bottom sheet**:
  - **Technical Root Cause / Detail**: The Git inspector was hidden by default and represented by a tiny icon that users overlooked, with no convenient mobile access.
  - **Implementation Mechanism**: Switched default inspector tab to `'git'` to highlight Git branch & commit graph. Replaced tiny icon rail buttons with prominent buttons displaying icons and labels (`Git`, `提问大纲`) with badges. On mobile devices, the inspector smoothly slides up as a bottom sheet.
  - **Verification & Testing**: WebUI unit tests passing (293 tests).

- **[Sidebar Project Management] Add "Reveal in File Explorer" and "Remove from Sidebar" actions**:
  - **Technical Root Cause / Detail**: Unwanted project folders accumulated in the left sidebar with no way to hide them without deleting files, and opening the folder on disk required manual navigation.
  - **Implementation Mechanism**: Added an explorer icon (calling `/fs/reveal` to open Windows Explorer / macOS Finder) and a trash icon (hiding the project from the sidebar with `localStorage` persistence while safely preserving all sessions and physical files).
  - **Verification & Testing**: Tested backend `/fs/reveal` handler and UI state persistence.

---

- **[系统通知防线] 彻底根除已完成通知误带 Approve/Deny 按钮与点击无响应缺陷**：
  - **技术机理 / 现象溯源**: 守护进程通知模块原先依据消息正文（`body`）模糊匹配审核关键字。当会话标题包含“审核”字样时，回合结束（`JeikCode done`）的完成通知会被错误判定为待审批通知，从而附加了无效的 Approve / Deny 动作按钮。
  - **实现防线 / 核心改动**: 重构 `crates/jeikcode-capabilities/src/notify.rs` 中的判断逻辑，严禁使用 `body` 判定审批，严格依据通知标题且无条件排除已完成/停止终态通知。
  - **验证与交付**: 运行 `windows_toast_approval_includes_action_buttons` 单元测试通过。

- **[Git 提交图谱与大纲优化] 默认首选 Git 面板，收起导轨按钮加大加显，移动端底抽屉自适应**：
  - **技术机理 / 现象溯源**: 用户不易发现 Git 提交历史图谱功能，且收起导轨上的微小图标不易察觉与点击。
  - **实现防线 / 核心改动**: 将检查面板默认标签页设为 `'git'`；收起导轨按钮加大加显，附带文字标签与数字徽标；移动端展开时自动升维为原生级平滑底部抽屉。
  - **验证与交付**: 前端 293 项测试全部通过。

- **[侧边栏项目管理] 新增资源管理器打开与隐藏项目显示功能**：
  - **技术机理 / 现象溯源**: 左侧边栏项目容易堆积且无法便捷打开本地实际物理文件夹。
  - **实现防线 / 核心改动**: 项目文件夹行增加 📂 按钮（一键调起 Windows 资源管理器/macOS 访达）与 🗑️ 垃圾桶按钮（纯前端隐藏项目展示，安全保留全部历史记录与物理文件）。
  - **验证与交付**: 验证后端 `/fs/reveal` 接口与前端项目过滤状态持久化。

## v7.1.53 (2026-10-05)

- **[Approval & Notification Hardening] Instant card dismissal on first click, session alias delivery, and OS duplicate toast suppression**:
  - **Technical Root Cause / Detail**: Approval cards in the notification dock lingered after clicks because polled prompts were not discarded immediately upon decision, causing users to click repeatedly. In desktop environments, alias mismatches between webview and daemon sometimes prevented decisions from reaching the active session. Furthermore, dual notifications were fired because both the chat stream and the background dock dispatched system toasts independently.
  - **Implementation Mechanism**: Added immediate local dismissal (`dismissedKeys`) and polled prompt removal in `NotificationDock.tsx` so cards vanish on the very first click. Enhanced daemon permission routing to resolve session aliases and fallback to any pending decider. Deduplicated system toasts by session and tag in `allow_system_notify`.
  - **Verification & Testing**: WebUI `npm test` passing (293 tests) and daemon unit tests passing.

- **[Minimalist Codex Streaming Status] Replace bubbly pill with borderless shimmer text and auto-hide during generation**:
  - **Technical Root Cause / Detail**: The status pill badge was visually intrusive, occupied extra vertical lines, and remained visible even while real tool calls or text were already streaming.
  - **Implementation Mechanism**: Removed pill background and borders. Implemented `.codex-shimmer-status` with subtle gradient shimmer text that displays strictly during initial IO wait and seamlessly vanishes once tokens, reasoning, or tools start streaming.
  - **Verification & Testing**: Verified responsive rendering and test coverage.

- **[Beta Release Channel] Prioritize latest pre-releases in Beta channel to properly display preview version numbers**:
  - **Technical Root Cause / Detail**: When fetching releases for the Beta channel, `compare_versions` favored formal releases over pre-releases with matching core versions per SemVer rules, causing the updater to display stable versions instead of active beta releases.
  - **Implementation Mechanism**: Updated `check_update` in `api_update.rs` so the Beta channel explicitly selects the latest release with `prerelease: true` before falling back to formal releases.
  - **Verification & Testing**: Daemon unit tests `test_compare_versions` passing.

- **[Image Lightbox Modal] Add prominent touch-friendly close button (✕) for image previews**:
  - **Technical Root Cause / Detail**: Clicking an image expanded it into full-screen without an explicit exit affordance, trapping mobile users on screen when touching the scaled image.
  - **Implementation Mechanism**: Added a floating `.img-lightbox-close` button positioned at top-safe-area right with high z-index and backdrop blur, allowing one-tap dismiss on mobile devices.
  - **Verification & Testing**: Tested component dismiss flow and responsive positioning.

- **[Collapsible Sticky Todo Panel] Mobile-first collapsible Todo list capsule**:
  - **Technical Root Cause / Detail**: Multi-item sticky Todo lists occupied excessive vertical space above the composer on compact mobile displays, pushing the input box and chat stream out of view.
  - **Implementation Mechanism**: Re-engineered `SessionTodoPanel` with an accordion toggle. On mobile views (≤768px), it collapses into a sleek single-line capsule showing status metrics and the active in-progress task snippet, expanding smoothly on tap.
  - **Verification & Testing**: WebUI `npm test` passing (293 tests).

- **[Mobile UI Layout & Defenses] Safe-area insets and compact Token badge prevent control clipping**:
  - **Technical Root Cause / Detail**: Phone status bars (dynamic island/cutouts) overlapped the top navigation bar, while lengthy Token meter chips pushed the Mode selector and Send button off-screen.
  - **Implementation Mechanism**: Anchored top/bottom chrome to `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. Streamlined `.footer-tokens` on mobile to show vital cache hit rates and total metrics without overflowing action controls.
  - **Verification & Testing**: Tested mobile viewports (360px - 768px).

---

- **[审批与通知防线] 审批卡片一键即刻消失、桌面端会话别名精准响应与系统双重弹窗消除**：
  - **技术机理 / 现象溯源**: 审批卡片此前未在前端本地状态中即时过滤轮询数据，导致用户点击同意/拒绝后卡片仍残留数秒并被迫重复点击；桌面端 WebView 与后端守护进程间因会话别名映射差异可能导致决策未能送达；且前端与后台双重触发系统通知导致 Windows 弹窗成对出现。
  - **实现防线 / 核心改动**: 在 `NotificationDock.tsx` 中建立即时消除机制与 `dismissedKeys` 过滤，首击即刻隐藏卡片；在后端增强会话别名解析与唯一决策兜底路由；在守护进程端基于会话与 Tag 实施严格通知去重。
  - **验证与交付**: 前端 293 项单测与后端单元测试全部通过。

- **[Codex 极简流光状态] 去除突兀气泡，生成期间自动隐去让出整行空间**：
  - **技术机理 / 现象溯源**: 原状态胶囊带有边框与背景底色较为突兀，且在工具执行与正文流式输出期间一直占位。
  - **实现防线 / 核心改动**: 彻底去除背景气泡与边框，采用 Codex 风格纯文字流光（`.codex-shimmer-status`）；在工具调用、思考或文字输出期间自动隐藏，仅在初始等待首包 IO 阶段低调提示。
  - **验证与交付**: 验证流式状态流转与样式渲染。

- **[预览版更新检测] Beta 预览通道优先匹配最新预发布版，正确展示预览版版本号**：
  - **技术机理 / 现象溯源**: 原更新检测逻辑因 SemVer 规范将同版本的正式版权重置于预发布版之上，导致用户切换到 Beta 预览通道时版本号被正式版覆盖。
  - **实现防线 / 核心改动**: 优化 `crates/jeikcode-daemon/src/api_update.rs`，在 Beta 通道下优先抓取标记为 `prerelease: true` 的最新版本，确保预览版版本号精准呈现。
  - **验证与交付**: 编译并运行后端 `test_compare_versions` 单元测试通过。

- **[多媒体图片灯箱] 全屏大图预览新增触控友好关闭按钮 (✕ 按钮)**：
  - **技术机理 / 现象溯源**: 点击图片放大预览时缺乏显式关闭按钮，手机端全屏展开后点击图片阻断事件冒泡，导致移动端用户无法退出。
  - **实现防线 / 核心改动**: 在 `ImageLightbox` 顶部安全区增加磨砂半透明圆形关闭按钮（`.img-lightbox-close`），支持手机端一键触控关闭。
  - **验证与交付**: 验证灯箱交互与移动端样式适配。

- **[移动端待办收纳] 待办面板可折叠胶囊化，释放手机宝贵垂直视口**：
  - **技术机理 / 现象溯源**: 手机屏幕空间有限，多项 Todo List 展开时占据半屏高度，将聊天内容和输入框严重遮挡。
  - **实现防线 / 核心改动**: `SessionTodoPanel` 升级支持手风琴式折叠收纳。移动端默认收纳为高度约 30px 的紧凑胶囊，直观展示已完成数与当前进行中任务内容，点击任意处平滑展开或收起。
  - **验证与交付**: 全量 293 项前端测试通过。

- **[移动端防遮挡防线] 顶部避让挖孔/灵动岛，Token 统计紧凑化，保障发送与模式按钮完全可用**：
  - **技术机理 / 现象溯源**: 顶部固定导航在带挖孔屏手机上与状态栏重叠；输入框底部长串 Token 指示器挤爆宽度，导致模式选择器与发送按钮被挤出屏幕。
  - **实现防线 / 核心改动**: 顶部及底部工具栏全面接入 `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)`；移动端精简收纳 Token 缓存条，确保模式切换与发送按钮稳定显式。
  - **验证与交付**: 多断点响应式测试验证无误。

## v7.1.52 (2026-10-05)

- **[Universal Responsive & Mobile UX] Gemini-aligned responsive mobile architecture, bottom-sheet modals, bottom-docked composer, and native media/file upload button**:
  - **Technical Root Cause / Detail**: Mobile views previously suffered from rigid desktop-squished layouts: modals were cut off on phones, model configuration stats and paths overflowed horizontally, the top app bar clashed with the hamburger menu, and the landing page composer was awkwardly floating in the center. Furthermore, mobile users could not conveniently upload files/images without relying on desktop copy-paste.
  - **Implementation Mechanism**: Built a universal responsive design system across mobile (≤768px), tablet/iPad (769-1024px), and desktop (>1024px). Modals automatically elevate to native-style bottom sheets with top pull handles and safe-area insets. Overhauled model configuration into a fluid flex/grid layout preventing text truncation and clipping. Re-anchored mobile composer cleanly to the bottom (Gemini style) and added a dedicated native media/file upload button (`input[type="file"]`) to seamlessly attach images or files.
  - **Verification & Testing**: WebUI `npm test` passing (291 tests) and production build verified.

- **[Update Channels & Modal] Add Stable and Beta release channels with interactive modal and pre-release support**:
  - **Technical Root Cause / Detail**: Previously, the top update button checked only stable releases and prompted raw browser alerts on manual checks. There was no user-selectable release channel or visual feedback for preview/beta builds.
  - **Implementation Mechanism**: Added `UpdateDialog` modal with dual-channel toggle (Stable / Beta) aligned with Antigravity-Manager, persistent channel preference (`localStorage`), real-time channel switching, and progress indicators. Enhanced daemon backend `/api/update/check` and `/api/update/execute` with SemVer pre-release version comparison and GitHub API pre-release discovery.
  - **Verification & Testing**: Daemon unit tests `test_compare_versions` covering SemVer pre-release ordering; WebUI unit tests in `api.test.ts`.

- **[WebUI Session Switch & Queued Steers] Fix disappearing queued cards, preserve steer cards, and prevent message loss on session switch**:
  - **Technical Root Cause / Detail**: During an active turn, switching away and returning caused `(cacheInFlight && diskSettled)` to misidentify a prior turn's completed disk state as settled for the current turn, overwriting `currentCached` and dropping the current user message while appending new streaming deltas directly onto the previous turn. Furthermore, queued and steered cards disappeared on page refresh due to lack of persistence, and live snapshots prematurely wiped steered follow-up cards.
  - **Implementation Mechanism**: Refactored `diskSettled` check in `Chat.tsx` so an active turn requires the disk transcript to actually include the current user turn and not lag behind before replacing `currentCached`. Added `sessionStorage` persistence (`STORAGE_KEY_QUEUED_MESSAGES`) for queued and steered messages across refreshes. Bound `targetSid` in `handleSteerQueuedMessage` so asynchronous submission survives immediate session switching, and prevented `liveSnapshotQueueDisposition` from discarding steered items.
  - **Verification & Testing**: WebUI `npm test` covering `queuedDraft.test.ts` storage round-trip and `api.test.ts` (291 tests passing).

---

- **[全端响应式基建与移动端设计] 对标主流 Agent (Gemini) 重构全端响应式系统、底抽屉弹窗、底吸附输入框与原生媒体文件上传**:
  - **技术机理 / 现象溯源**: 移动端先前采用桌面端硬性压缩，导致模型配置卡片横向溢出截断、长路径被砍掉，手机端顶部导航与汉堡菜单错位重叠，落地页输入框浮在半空；同时手机端无法便捷复制粘贴上传文件，亟需原生文件选择器。
  - **实现防线 / 核心改动**: 建立手机 (≤768px)、iPad平板 (769-1024px)、电脑 (>1024px) 全端响应式体系。全域弹窗在移动端自动升维为原生级底部抽屉 (Bottom Sheet)，配备下拉把手与底部安全区避让；重构模型配置为自适应流体网格与路径自适应省略；输入框与落地页在移动端对标 Gemini 优雅吸底；在输入栏中新增原生媒体与文件上传按钮，一键调起系统相机、相册或文档管理器。
  - **验证与交付**: 前端自动化测试通过 (291项)，生产打包验证成功。

- **[更新通道与弹窗] 新增正式版与预览版双更新通道、交互式弹窗及预发布检测**：
  - **技术机理 / 现象溯源**: 原有更新逻辑仅支持正式版检测，手动点击时直接弹出浏览器原生 alert 提示，缺乏更新通道选择与平滑的交互式弹窗。
  - **实现防线 / 核心改动**: 对标 Antigravity-Manager 设计并重构 `UpdateDialog` 更新弹窗，提供正式版 (Stable) 与预览版 (Beta) 胶囊切换、琥珀色发光呼吸脉冲点、本地偏好持久化及即时通道检测。后端 `/api/update/check` 与 `/api/update/execute` 升级支持 `channel` 参数、GitHub 预发布版本检索与语义化版本号比较器（`compare_versions`）。
  - **验证与交付**: 后端 `test_compare_versions` 预发布版本大小比较单测通过；前端 `api.test.ts` 接口参数测试通过。

- **[WebUI 会话切换与排队转向] 修复切会话用户消息丢失、两轮 Agent 消息串联，以及排队转向卡片刷新/切换消失问题**：
  - **技术机理 / 现象溯源**: 会话执行期间切换离开再切回时，前端判定 `(cacheInFlight && diskSettled)` 误将上一轮已完结的磁盘历史当作本轮已完成，粗暴用旧磁盘数据覆盖了内存缓存，导致本轮 User 提问丢失、后续增量直接拼接到上一轮 Assistant 气泡中。此外，排队与转向卡片未做持久化，刷新页面或触发 Live 快照重连时会被误清空，且异步转向竞态可能丢失会话绑定。
  - **实现防线 / 核心改动**: 修正 `Chat.tsx` 中的磁盘结算判定，当回合处于活跃状态且磁盘尚未包含当前 User 提问时坚决保留内存缓存；在 `queuedDraft.ts` 与 `Chat.tsx` 中引入 `sessionStorage` 持久化，保证页面刷新后卡片依然存在；在 `handleSteerQueuedMessage` 中严格绑定 `targetSid` 消除异步竞态，并阻止快照重连误删转向卡片。
  - **验证与交付**: 前端 `queuedDraft.test.ts` 存储持久化单测通过，全量 291 项前端测试通过。

## v7.1.51 (2026-10-05)

- **[Prompt Discipline] One verification rule, no DeepSeek extra execution block, and no test ritual on review or tiny copy edits**:
  - **Technical Root Cause / Detail**: DeepSeek's `EXECUTION DISCIPLINE` restated verify/finish-the-job as hard rules, and fallback `RULES` still said batch compile/test was mandatory unless the user forbade it. Models ran formatters and checks on PR checkout, code review, and every small edit.
  - **Implementation Mechanism**: Drop `FIRM_EXECUTION_DISCIPLINE` for all models. Keep a single Modification Closure in live `rules.yaml` and fallback `RULES`: one complete check covering the code you changed this request after those edits are in, rather than testing after every small edit. Code review, read-only, checkout, and a few copy/comment/literal edits finish without a test run. WORKFLOW / CARRY IT THROUGH say deliver instead of verify.
  - **Verification & Testing**: `cargo test -p jeikcode-coding --lib persona::` (42 tests). `cargo test -p jeikcode-config --test unified_prompt`.

---

- **[提示词纪律] 验证只留一句，去掉 DeepSeek 额外执行块，审查和改两三处文案不跑测试**：
  - **技术机理 / 现象溯源**: DeepSeek 的 `EXECUTION DISCIPLINE` 把验证/收尾写成硬规则，fallback `RULES` 仍写用户没禁止就批量编译测试。模型拉 PR、做审查、每改一小处都会跑格式化和检查。
  - **实现防线 / 核心改动**: 全模型去掉 `FIRM_EXECUTION_DISCIPLINE`。live `rules.yaml` 与 fallback `RULES` 只留 Modification Closure：相关改动收齐后做一次覆盖这些改动的检查，而不是一点小修改就频繁测试。代码审查、只读、拉代码、改两三处文案/注释/字面量不跑测试。WORKFLOW / CARRY IT THROUGH 改成交付。
  - **验证与交付**: persona 42 个单测；`unified_prompt` 测试。

## v7.1.50 (2026-10-05)

- **[WebUI Session Switch] Sticky todos and queued follow-ups stay visible after leaving a running session and coming back**:
  - **Technical Root Cause / Detail**: Unfinished todo plans live only in the sticky composer panel. History after a sidebar switch often has `todowrite` rows without a trailing `todo_list` part, so looking only at frozen parts hid the panel. Queued steers were restored then immediately cleared when `/chat/active` still reported the session running.
  - **Implementation Mechanism**: `restoreStickyTodos` folds `todowrite` rows (TUI parity) and keeps a stash when the visible tail is incremental-only. `/chat/watch` replay applies each todo call once by id. Queued drafts and pending steers persist per session while the turn is live.
  - **Verification & Testing**: `webui` `npm test` for `todos.test.ts` and `queuedDraft.test.ts`.

- **[Coding Agent Reminders] Open with a `code_explore` tail, nudge wander searches on tool results, and put Plan Mode on the same user message**:
  - **Technical Root Cause / Detail**: `code_explore` was under-triggered. Independent synthetic User blocks stole recency or looked user-authored. A DeepSeek-only skill-first block and an edit-then-verify continuation (`You made code edits but have not verified them…`) added extra loop turns.
  - **Implementation Mechanism**: First real user query gets a stored `<system-reminder>` tail (with the date). A per-session meter counts `grep`+`glob`+`read_file`; the 8th combined call in a window of 10 appends a wander reminder to that tool result; a full window or one `code_explore` resets the count. Plan Mode appends to the current user block after the date. `SkillFirstHook` and `VerifyCadenceHook` are removed. Claude Code `SessionStart` additional context is `synthetic_user`.
  - **Verification & Testing**: `cargo test -p jeikcode-coding --lib` for `code_tools_first`, `plan_mode`, and `todo`. `cargo test -p jeikcode-capabilities --lib --features cc-hooks session_start_injects_synthetic`.

- **[Prompt Discipline] Safe CLIs run as the install/login check; irreversible steps get one cheap exists/login probe**:
  - **Technical Root Cause / Detail**: Models often ran `which` / `gh auth status` / `npm whoami` before a harmless command.
  - **Implementation Mechanism**: Live `rules.yaml` and fallback `RULES`: when the next step is safe (`gh pr list`, `npm test`, `cargo check`, `docker ps`), run it and treat its output as the check. When the next step is destructive, publishing, billing, credential-writing, or irreversible remote, and install/login/account is unclear, run one cheap check and reuse it.
  - **Verification & Testing**: `persona_carries_model_and_anchors` asserts `Prefer the real command`.

- **[Release Notes] Desktop installer links use the Tauri filename with a dot, and the docs site follows the GitHub latest tag**:
  - **Technical Root Cause / Detail**: Publish script used a filename that 404'd on GitHub Releases. Docs version lagged the tag.
  - **Implementation Mechanism**: `publish-release.js` uses the Tauri bundle name. Docs workflow injects the live GitHub release version.
  - **Verification & Testing**: Covered by the v7.1.49-era publish path already on `main` (`987b74fd7`); this tag is the first release that ships it.

---

- **[WebUI 会话切换] 离开仍在跑的会话再回来，粘性待办和排队追问还在**：
  - **技术机理 / 现象溯源**: 未完成的 todo 只活在输入框上方的粘性面板。侧栏切走再回来时，历史里常有 `todowrite` 行却没有末尾 `todo_list`，只看冻结块就会把面板弄丢。排队追问在 `/chat/active` 仍显示进行中时被清掉。
  - **实现防线 / 核心改动**: `restoreStickyTodos` 按 TUI 折叠 `todowrite`；可见窗口只有增量更新时保留 stash。`/chat/watch` 回放按 call id 各折叠一次。排队草稿与 pending steer 按会话保存。
  - **验证与交付**: `webui` `npm test`（`todos.test.ts`、`queuedDraft.test.ts`）。

- **[编码 Agent 提醒] 首条提问尾巴提示 `code_explore`，漫游检索挂在工具返回上，Plan 模式挂在同一条 user 上**：
  - **技术机理 / 现象溯源**: `code_explore` 触发弱。独立 synthetic User 块抢 recency 或看起来像用户说的。DeepSeek 专用 skill-first 与「改完必须 cargo check」续写会多绕几轮。
  - **实现防线 / 核心改动**: 第一条真实提问追加 `<system-reminder>` 尾巴（与日期同条）。按会话合计 `grep`+`glob`+`read_file`，窗口 10 内第 8 次把提醒接到该次工具结果；满 10 或一次 `code_explore` 清零。Plan 模式接在日期后面。删除 `SkillFirstHook` 与 `VerifyCadenceHook`。CC `SessionStart` 附加上下文改为 `synthetic_user`。
  - **验证与交付**: `code_tools_first` / `plan_mode` / `todo` 单测；`cc-hooks` 的 SessionStart synthetic 测试。

- **[提示词纪律] 安全命令直接当安装/登录检查；不可逆步骤只做一次廉价存在/登录核对**：
  - **技术机理 / 现象溯源**: 模型常在无害命令前先跑 `which` / `gh auth status` / `npm whoami`。
  - **实现防线 / 核心改动**: live `rules.yaml` 与 fallback `RULES`：下一步是 `gh pr list`、`npm test`、`cargo check`、`docker ps` 这类安全命令时直接执行。下一步是破坏性、发布、计费、写凭证或不可逆远端，且安装/登录/多账号不清楚时，做一次廉价检查并复用。
  - **验证与交付**: persona 单测包含 `Prefer the real command`。

- **[发版说明] 桌面安装包链接改用 Tauri 带点的文件名，文档站跟随 GitHub latest**：
  - **技术机理 / 现象溯源**: 发布脚本里的安装包文件名在 GitHub Releases 上 404。文档版本落后于 Tag。
  - **实现防线 / 核心改动**: `publish-release.js` 使用 Tauri 产物名。文档工作流注入当前 GitHub latest 版本。
  - **验证与交付**: 该修复已在 `main` 的 `987b74fd7`；本 Tag 是第一次随正式版发出。

## v7.1.49 (2026-10-04)

- **[Desktop Model Configuration Loading] Treat empty 401 as missing token rather than JSON syntax error, reporting genuine status even with existing configuration**:
  - **Manifestation of Empty 401**: When launching the desktop app and opening model settings, the modal displayed `加载失败: Failed to execute 'json' on 'Response': Unexpected end of JSON input`. Users already had `~/.jeikcode/config.toml` configured. The root cause was `GET /config` routed through webui token middleware; missing or invalid tokens made `require_webui_token` return `Err(StatusCode::UNAUTHORIZED)` with an empty HTTP body. The frontend `getConfig()` called `resp.json()` directly, throwing SyntaxError on empty responses.
  - **Authentication Failure JSON Response**: Added `unauthorized_payload()` in `crates/jeikcode-daemon/src/auth_token.rs`, responding with `{"success":false,"error":"Unauthorized: missing or invalid access token"}` instead of an empty status code across `require_webui_token` and `require_app_user_id`.
  - **Resilient Frontend Parsing**: Added `readApiJson()` in `webui/src/api.ts` to inspect body text before parsing. Empty 401 raises explicit Unauthorized, preventing `Unexpected end of JSON input`. Model settings modal maps 401/unauthorized errors to an informative message instructing users to reopen the desktop app.
  - **Robust Token Persistence in Desktop WebView**: URL query param `?token=` is written to both `sessionStorage` and `localStorage`, then scrubbed from address bar once persisted (CWE-598). Retains `?token=` if storage is unavailable. `authHeaders()` dynamically reads token per request rather than static module load constants.
  - **Onboarding Safeguard**: On `desktop=1`, failure in `getModels()` no longer forces first-time onboarding. Empty model list triggers onboarding only when request succeeded with zero models.
  - **Verification**: `cargo test -p jeikcode-daemon unauthorized_payload` passed. WebUI `npm test` passed 281 test suites including empty 401, JSON 401, and successful `GET /config`.

---

- **[桌面模型配置加载] 打开模型配置时不再把空 401 当成 JSON 解析失败，配置文件还在也能显示真实原因**：
  - **空 401 的表象**：桌面启动后打开模型配置，弹窗显示 `加载失败: Failed to execute 'json' on 'Response': Unexpected end of JSON input`。用户本机已有 `~/.jeikcode/config.toml`（新 schema 的 `[models.*]` / `[provider_accounts.*]`）。根因是 `GET /config` 走 webui token 中间件；缺 token 或 token 无效时，`require_webui_token` 返回 `Err(StatusCode::UNAUTHORIZED)`，Axum 给出**空 body**。前端 `getConfig()` 直接 `resp.json()`，浏览器对空响应抛出该 SyntaxError。
  - **鉴权失败返回 JSON**：`crates/jeikcode-daemon/src/auth_token.rs` 增加 `unauthorized_payload()`，401 正文为 `{"success":false,"error":"Unauthorized: missing or invalid access token"}`。`require_webui_token` 与 `require_app_user_id` 都走这条响应，不再返回空状态码。
  - **前端安全解析**：`webui/src/api.ts` 新增 `readApiJson()`。`getConfig()` 先读文本再解析；空 401 抛出明确的 Unauthorized，不再触发 `Unexpected end of JSON input`。模型配置弹窗把 401 / unauthorized / access token 映射为「访问令牌无效或缺失。配置文件还在，请关闭后重新打开桌面端。」
  - **token 在桌面 WebView 里更稳**：URL 里的 `?token=` 同时写入 `sessionStorage` 和 `localStorage`。存成功后再从地址栏去掉 token（CWE-598）。存储不可用时保留 `?token=`，避免刷新后所有 API 401。`authHeaders()` 每次请求现读 token，不再用模块加载时的一次性常量。
  - **首次向导不再把鉴权失败当成没配模型**：`desktop=1` 时 `getModels()` 失败不再弹出 onboarding。空模型列表（请求成功且长度为 0）才进入向导。
  - **验证**：`cargo test -p jeikcode-daemon unauthorized_payload` 通过。`webui` `npm test` 281 项通过，含空 401、带 JSON 的 401、以及成功 `GET /config`。已执行 `webui` `npm run build`。未在已安装的桌面窗口里再点一次。

## v7.1.48 (2026-10-04)

- **[桌面窗口打开本机地址] 桌面启动不再把窗口带到局域网 IP，没有控制台时 WebUI 进程也不会马上退出**：
  - **窗口用 127.0.0.1**：`start_webui` 仍执行 `jeikcode webui --host 0.0.0.0`。启动日志里的地址可能是网卡 IP（例如 `192.168.123.20`）。`window_url` 在导航前把主机改成 `127.0.0.1`，端口和 token 不变。其他设备继续用右上角面板列出的局域网地址。
  - **没有控制台就一直听着**：`wait_until_webui_stopped` 在 Windows 上先看 `GetConsoleWindow`。桌面壳用 `CREATE_NO_WINDOW` 拉起时没有控制台，进程停在这里，直到桌面壳退出时把它杀掉。终端里手动执行 `jeikcode webui` 仍按 Ctrl+C 结束。`ctrl_c()` 返回错误时同样不退出。
  - **不再读完地址就关掉 stderr**：`read_url` 找到地址后继续把标准错误读完。先前读完第一行就关掉管道，子进程后续写标准错误会触发二次 panic，以 `0xc0000409` 退出，窗口就显示拒绝连接。
  - **验证**：桌面 `window_url` 单测把 `192.168.123.20` 改写为 `127.0.0.1` 并保留 token。没有在装好的桌面窗口里再点一次。

## v7.1.47 (2026-10-04)

- **[桌面端直接监听 0.0.0.0] 桌面启动的 WebUI 与命令行 `--host 0.0.0.0` 走同一套监听，右上角面板改的是这个端口和 token，不再另开一个端口**：
  - **启动命令**：`desktop/src-tauri/src/main.rs` 的 `start_webui` 改为 `jeikcode webui --host 0.0.0.0 --port <端口> --no-open`。没有 `~/.jeikcode/webui-listen.json` 时端口是 `13457`（`WEBUI_DEFAULT_PORT`），并随机生成 token。文件里有端口和 token 时，下次启动带上该端口和 `--token`。`JEIKCODE_HOME` 优先于用户目录下的 `.jeikcode`。命令行自己执行 `jeikcode webui` 且不写 `--host` 时仍绑定 `127.0.0.1`，避免 TUI `/webui` 被一起暴露。
  - **固定 token 贯穿窗口和面板**：`Commands::Webui` 增加 `--token`。`ensure_webui` 经 `startup_webui_token` 登记非空 token，并调用 `WebuiTokenStore::set_display` 作为地址和面板上的那一个。未提供时沿用已有展示 token，否则 `mint`。`register` 只把 token 放进有效集合，不再覆盖展示值，所以已经打开的页面仍接受原来的 token。
  - **同端口的 token 马上生效**：右上角 `RemoteAccessControl` 显示这次实际绑定的地址和端口，并预填启动 token，用户可以改。端口与 `bind_port` 一致时，`apply_launch_settings` 登记新 token、设为展示值、打开校验，并写入 `webui-listen.json`。
  - **改端口下次启动生效**：端口不同时不重新绑定当前套接字，只把端口和 token 写入该文件。状态里的 `next_port` 与正在听的端口不同，面板小字说明新端口下次启动才换上；要马上换 token，把端口改回正在听的端口再应用。
  - **无 token 不落盘**：勾选无 token 只对这一次进程调用 `apply_remote_auth(true)`。文件不写 `no_token`，也不清掉已保存的 token。同时改了端口时只更新端口，沿用文件里原来的 token。下次启动仍带 token。
  - **面板不再另开第二个监听**：请求带 `apply_launch: true` 时走上述保存逻辑，不碰 `extra_remote`。主监听已是非回环地址时地球图标为绿色。关闭按钮去掉，因为这一个端口就是桌面窗口自己的服务。未带 `apply_launch` 的调用仍走原来的额外监听。打开面板时，只有额外监听还开着才查 Windows 防火墙，避免主监听为 `0.0.0.0` 时弹出放行提示。
  - **修复 CI 编译错误**：`firewall_rule_matches` 在返回 `bool` 的函数里对 `netsh_text` 的 `Option` 使用了 `?`。改为匹配不到规则文本时直接返回 `false`。
  - **验证**：`cargo check -p jeikcode-daemon --lib` 通过。`cargo test -p jeikcode-daemon --lib api_config::tests` 9 项通过，覆盖同端口立即生效、改端口只落盘、无 token 不落盘。桌面 `parse_webui_listen` 单测通过。

## v7.1.46 (2026-10-04)

- **[临时远程访问局域网可达与面板可再次操作] 修掉 WebUI「临时远程访问」应用 `0.0.0.0` 后只有本机能打开、以及应用后按钮和绿灯卡死的问题**：
  - **分享地址不再落到回环**：`remote_status` / `access_urls` 对 `0.0.0.0` 与 `::` 列出本机可分享的 IPv4（优先 `primary_lan_ipv4`，再扫描 `ipconfig`），不再把 `127.0.0.1` 或 `[::1]` 当作局域网链接。找不到网卡地址时留空，面板提示用本机 IPv4 加端口。
  - **IPv4 与 IPv6 分开绑定**：`bind_listener` 用 `socket2` 显式监听 `0.0.0.0`，IPv6 设置 `IPV6_V6ONLY`。避免 Windows 默认双栈套接字把外部 IPv4 占住，造成本机能开、别的设备不能开。
  - **Windows 入站放行**：桌面端原先只听 `127.0.0.1`，系统不会在启动时询问防火墙。临时监听改为对外后，按当前 `jeikcode.exe` 检查名为 `JeikCode` 的入站允许规则；没有规则时尝试添加，仍失败则对本进程提一次 UAC。面板在规则尚未就绪时提示放行。监听回环地址不查防火墙。
  - **同一地址再应用不再死锁**：同一主机和端口只更新 token，并在调用 `remote_status` 之前放开 `extra_remote` 这把不可重入的锁。此前第二次应用会一直不返回，前端停在忙碌，应用和关闭都不可点，绿灯保持亮着。
  - **换端口失败时保留仍在听的端口**：端口不同时先绑定新套接字，失败则旧监听还在。同一端口必须先停再绑，地址仍被占用时等待约 100ms 再试一次；最终失败会恢复原来的 token 校验，避免半套监听还留着免鉴权。
  - **面板可关、可改、超时会收回状态**：`RemoteAccessControl` 在应用进行中仍可点关闭；请求超过 12 秒放弃并重新查询。若服务器上已经没有监听，绿灯、链接和防火墙提示一并清掉。成功时列出全部可访问地址，并显示实际正在监听的地址和端口。

- **[会话切换与通知点击] 切会话不再丢掉未落盘的回答，通知点击不再闪出命令行窗口**：
  - **切会话以磁盘上真实的助手消息为准**：`Chat.tsx` 不再把「还没有助手消息」当成已经结算，避免离开再回来时用空结果盖掉内存里的进行中内容。进行中的会话继续走 `/chat/watch`，不再改成只轮询磁盘。
  - **Windows 通知点击不再弹出控制台**：`jeikcode-focus:` 改为由 `notify-focus.vbs` 经 `wscript` 隐藏启动 PowerShell。聚焦时优先找桌面进程 `jeikcode-desktop`，并跳过浏览器窗口；最小化窗口会先还原再置前。
  - **多页面不会抢掉同一次点击**：`/notify-focus` 改为带单调 `version` 的状态，GET 不再把待跳转会话取走。WebUI 记下已见版本，只有更新的点击才派发 `jeikcode:focus-session`。

## v7.1.45 (2026-10-04)

- **[临时远程访问与安全鉴权深度治理] 彻底根除 WebUI 临时远程监听鉴权失效与局域网不可达缺陷，全面支持双栈绑定与动态原子 Token 保护**：
  - **动态原子鉴权开关与 Token 强制执行**：针对守护进程以免鉴权模式启动后 `enforce_token` 静态写死导致临时暴露局域网时鉴权完全形同虚设的安全漏洞，将 `AppState.enforce_token` 升级为 `Arc<AtomicBool>` 动态原子控制，并在开启临时远程访问时即时激活 Token 强校验，坚决拦截无凭证请求返回 401 Unauthorized；
  - **全链路双栈监听与 CORS 放行修复**：在 `crates/jeikcode-daemon/src/api_config.rs` 中补齐 IPv6 `[::]:port` 双栈监听与多任务生命周期管理，并在 `is_allowed_cors_origin` 中放宽对客户端直连 Host 与公网双栈 IPv6 的校验，彻底打通局域网跨设备直连；
  - **状态持久化与 URL 完整回显**：解除了 `already` 状态死锁判定，在 `ExtraRemoteBind` 中持久化记录当前绑定的活跃 Token，保证 GET/POST 状态接口生成的访问链接 100% 完整携带 `?token=...`，支持随时热更新参数。

- **[跨平台桌面通知体系全面重构与交互动作升级] 消除双重通知重叠与窗口闪烁缩放顽疾，打通 Windows/macOS/Linux 原生交互通知与一键审批**：
  - **单通道通知收敛与消除双重重叠**：完全移除 Web 前端重复触发的浏览器内置 Web Notification，统一收敛至操作系统原生桌面通知（Windows Toast / macOS UserNotifications / Linux notify-send），彻底解决右下角多弹窗叠层遮挡问题；
  - **Windows WinRT Toast 原生交互按钮支持**：在 `crates/jeikcode-capabilities/src/notify.rs` 中升级 Toast XML 模板，当触发工具审批（`permission_request`）时原生注入 `[ Approve ]` 与 `[ Deny ]` 操作按钮，用户无需切换前台窗口即可在 Windows 屏幕右下角点击按钮秒级完成权限审批；提问（`request_user_input`）通知自动注入 `[ Answer / 作答 ]` 快捷按钮直达问题；
  - **Win32 窗口前台穿透激活与尺寸保护 (ForceActivate)**：彻底重构 `notify-focus.ps1` 窗口聚焦脚本，引入 Alt 键微秒级按键事件挂起 Windows 内核的 `ForegroundLockTimeout` 超时限制，结合 `AttachThreadInput` 与 `SwitchToThisWindow` 实现 100% 稳定置顶前台激活；未最小化时绝不调用 ShowWindow，彻底消除多次重绘引起的闪烁，100% 保护最大化与 Windows 11 Aero Snap 贴靠尺寸不缩水；
  - **macOS 与 Linux 提问与审批通知全支持**：在 `notify-focus.sh` 脚本中增加动作解析，Linux 下通过 `notify-send -A` 原生支持 Approve/Deny 按钮点击提交，macOS 下原生调用 `UNUserNotificationCenter` 弹窗提醒，点击秒级无损激活置顶前台会话。

## v7.1.44 (2026-10-04)

- **[Windows 桌面 Toast 通知协议唤醒与焦点穿透 (Windows Toast Protocol Activation & Session Focus)] 攻克 WinRT 原生通知点击无法唤醒应用与会话定位问题，建立完整系统 Protocol Scheme 与守护进程鉴权通知总线**：
  - **WinRT Toast 注册 AUMID 方案重构与 Banner 显示修复**：在 `crates/jeikcode-capabilities/src/notify.rs` 中排除无响应的未注册裸 `JeikCode` AUMID，优先使用标准 Windows PowerShell AUMID (`{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe`) 触发 Toast 弹窗，根除 `Show()` 假成功但不弹出横幅通知缺陷；Toast 悬留时间延长至 `duration="long"`，并完善 XML 实体转义机制。
  - **注册 Windows 自定义 URI 协议 (`jeikcode-focus:`)**：在 `notify.rs` 中新增 `install_windows_focus_protocol`，自动注册 `HKCU\Software\Classes\jeikcode-focus` 协议，动态生成 `~/.jeikcode/notify-focus.ps1` 唤醒脚本；点击 Toast 通知时通过 Win32 API (`SetForegroundWindow`/`ShowWindow`/`BringWindowToTop`) 将最小化或后台的 JeikCode 窗口平滑置顶。
  - **守护进程安全通知通道与会话跳转**：在 `crates/jeikcode-daemon/src/lib.rs` 中新增 `/notify-focus` POST/GET 端点，基于 32 位 Hex 进程安全秘钥防护攻击；前端 `webui/src/api.ts` 与 `app.tsx` 引入轻量轮询探针，接收点击回调时自动触发 `jeikcode:focus-session` 全局事件并精准无缝跳转至对应会话。
  - **全量 OS 通知响应策略**：更新 `webui/src/lib/sessionNotify.ts` 与 `Chat.tsx`，将 `shouldOsNotifyTerminal` 优化为全量触发模式，保证无论前后台状态，回合完成时系统通知中心均能准确捕获，实现无遗漏的离线完成追溯。


## v7.1.43 (2026-10-04)

- **[桌面端通知系统深度治理与抗休眠加固] 根除 WebUI 套壳/桌面端窗口最小化与失焦时通知失效缺陷，打通系统原生通知与点击唤醒会话跳转闭环**：
  - **新建会话 Terminal 事件镜像修复**：修复 `crates/jeikcode-daemon/src/lib.rs` 的 `fanout_chat_events_for_session` 中因新建会话初始 `session_id` 为 `None` 导致 `ChatEvent::Done` 事件被静默跳过、未记录进全局会话运行时注册表（`SessionRuntimeRegistry`）的严重缺陷，动态提取权威会话 ID，保证第一轮消息完成时 `last_terminal` 与 `terminal_seq` 100% 递增生效。
  - **前端抗休眠零延迟直接通知通道**：针对 Chromium/WebView2 桌面套壳在窗口最小化或后台失焦时对 `setInterval` 定时器进行强制节流与冻结（Timer Throttling/Freeze）导致通知被阻断的问题，在 `webui/src/components/Chat.tsx` 的 SSE `case 'done'` 完成事件处理处建立零延迟直达通道，失焦时直接触发操作系统桌面通知，彻底绕过前端轮询休眠限制。
  - **点击通知唤醒置顶并自动定位会话 (Click-to-Focus & Auto-Navigate)**：在 `webui/src/lib/sessionNotify.ts` 中封装 `dispatchSystemNotification`，绑定 Web Notification 的 `onclick` 回调，在 `webui/src/app.tsx` 中建立 `jeikcode:focus-session` 全局事件响应总线；用户在桌面右下角点击系统通知或应用内卡片时，窗口自动还原置顶唤醒，并瞬时平滑跳转切换至对应会话的时间线。
  - **Windows Toast AUMID 通用兼容扩充**：在 `crates/jeikcode-capabilities/src/notify.rs` 的 PowerShell WinRT 脚本中扩充 Windows 常见系统级应用标识符（`JeikCode`、`Microsoft.Windows.Explorer`、`Microsoft.WindowsTerminal` 等），确保独立便携版与打包安装版均能 100% 成功唤起 Windows 系统的右下角横幅 Toast 通知。
  - **前台焦点智能免打扰**：在 `webui/src/lib/sessionNotify.ts` 与 `NotificationDock.tsx` 中新增智能免打扰判定，当用户正处于当前前台会话窗口亲眼看着 Agent 回复结束时，自动抑制多余的右下角应用内卡片与系统提示，实现“前台专注无打扰，后台离开准时报”。

- **[多项目会话树状归属与视觉层级重构] 彻底根治左侧栏会话字号倒挂与层级扁平错觉，建立工业级树形结构引导线与对话节点语义**：
  - **理顺父子字号与字重阶梯**：针对原项目标题 12.5px 偏小而子会话 14px 粗体导致的严重“会话比项目还大”层级倒挂问题，将项目父级标题提升至 `13.5px`（字重 `600`，主色骨架），子会话标题收敛规范至 `12.5px`，构建清晰自然的二级/三级父子权重阶梯。
  - **树状分支层级引导线 (Tree Indent Guide Line)**：在 `webui/src/styles/app.css` 中为 `.project-sessions-list` 增加 `1.5px solid var(--app-border)` 竖向半透明层级引导线与 `17px` 标准缩进，视觉视线顺着父级项目文件夹图标自然向下延展，一眼感知所有会话牢牢隶属于当前项目。
  - **专属对话图标语义 (ChatBubbleIcon)**：在 `webui/src/components/Sidebar.tsx` 中为每个子会话条目增加专属对话气泡小图标，与父级项目的 `FolderIcon` 文件夹图标形成标准的「文件夹 ➔ 旗下对话」认知模型；时间戳标签智能对齐缩进，整体排版更加精致、专业。

## v7.1.42 (2026-10-04)

- **[会话落盘与状态快速探测] 新增轻量级会话新鲜度端点与前端轮询减负，消除多余反序列化与频繁磁盘 I/O**：
  - **轻量会话新鲜度探针 (`/freshness`)**：在 `crates/jeikcode-daemon/src/lib.rs` 中新增 `GET /projects/:hash/sessions/:id/freshness` 路由，仅通过对 snapshot、jsonl 与 presentation 三个底层文件的 `fs::metadata` 快速 stat 聚合总字节数和最大 mtime（`bytes:mtime_ms`），不读取、不反序列化庞大消息体；结合服务端实时会话池返回当前会话 running 活跃状态。
  - **前端智能落盘感知与降频轮询**：`webui/src/components/Chat.tsx` 引入 `catchUpFromDisk` 机制，在途流式期间免触碰磁盘，仅在静默期通过签名比对探测真实落盘变化；将脱机轮询间隔平滑优化至 2000ms，在落盘终结后原子收敛至 `authoritative_terminal`，大幅降低前端重绘与系统 I/O 开销。

- **[会话完成通知与通知坞站系统] 引入全局通知坞站组件，跨平台支持事件捕获与系统通知**：
  - **通知坞站组件 (NotificationDock)**：新增 `webui/src/components/NotificationDock.tsx`，集中挂载并展示长耗时任务完成提醒、权限卡片审批及用户交互输入（UserInputCard）通知，支持状态机无缝闭环与桌面 Native 通知分发。
  - **底层能力与路由调度支持**：在 `crates/jeikcode-capabilities/src/notify.rs` 及 daemon 核心路由中打通通知事件流，并在前端 `webui/src/lib/sessionNotify.ts` 提供完备的状态管理与单元测试防线。

- **[自动化发版流水线与多分支演进] 引入自动 Bump 脚本、独立 Beta 预发布通道与英文优先规范**：
  - **跨生态版本号一键同步 (`npm run bump`)**：新增 `scripts/bump-version.js`，支持 `npm run bump:beta`、`bump:patch`、`bump:minor`、`bump:major`，一键联动同步 `Cargo.toml`、`webui/package.json`、`desktop/src-tauri` 及 `package.json` 版本声明。
  - **版本号门禁 SemVer 预发布支持**：升级 `scripts/check-version-gate.js` 的预发布比对器（`comparePrerelease`），原生支持类似 `v7.1.42-beta.1` 的预发布版本号比对，确保 Beta 发布自动标为 Prerelease 且绝不污染主 Releases 稳定版索引。
  - **Release 说明国际化标准重构**：调整 `scripts/publish-release.js`，发版说明模板实行「英文置前、中文在后（English First, Then Chinese）」，统一跨平台安装包与变更分类指引。

- **[官方教程站点与移动端体验全面革新] 搭建 VitePress 独立文档站 (docs.jeikcode.top)，移动端深度适配与全自动部署**：
  - **官方教程独立站点上线**：通过 Cloudflare Pages 全球 Edge CDN 节点与自定义域名绑定 `https://docs.jeikcode.top` 实现自动化构建上线。
  - **移动端全屏响应式深度优化**：彻底解决移动端 Hero 图片穿透覆盖顶部导航栏的缺陷，将 Logo 尺寸精调至 135px 黄金视觉尺寸，版本号与大标题间隙微调至 16px 舒适缓冲；代码块右上角移动端常驻显示 `[📋]` 复制按钮，语言标识左移避让防遮挡；右上角新增常驻 `Docs` 按钮直达产品简介。
  - **智能语言嗅探与个人偏好记忆**：站点 `<head>` 注入极速零闪烁语言嗅探逻辑，中文系统首次访问根路径自动无缝进入 `/zh/`，其他语言默认英文；同时联动 localStorage 记住用户的手动切换偏好。

- **[中英双语 README 全面精简重塑] 聚焦核心体验，收拢引流至官方教程站点**：
  - `README.zh-CN.md`、`README.md` 与 `README.en.md` 开头全面置顶官方使用教程与文档站点链接（`https://docs.jeikcode.top`）；
  - 精简冗长篇幅，聚焦保留产品核心优势介绍、跨平台安装包下载路由矩阵、终端一键命令与快速开始指南。

## v7.1.41 (2026-10-03)

- **[全局语言开关与英文默认] 未初始化时界面、安装文档与 `--host` 提示统一为英文，语言选择写回同一份配置**：
  - **配置种子与升级保护**：`crates/jeikcode-cli/assets/default-config.toml` 与 `crates/jeikcode-coding/assets/default-config.toml` 的 `language` 改为 `en`。`merge_user_config_preserving_models` 将 `language` 列入保留键，升级不会把用户已选的语言盖回模板。缺失该字段时，WebUI 与 daemon 按英文处理。
  - **WebUI / 桌面跟随同一开关**：`webui/src/settings.tsx` 启动时读取 `GET /config` 的 `language`，右上角切换调用 `POST /config/language` 写回 `config.toml`，并立刻 `set_locale`。桌面壳打开的是同一套 WebUI。
  - **`--host` 启动文案**：`host_service.rs`、`systemd.rs`、`server_cmd.rs` 的登录自启提问与结果说明按当前 locale 输出，不再写死中文。
  - **升级配置提示**：`config_sync.rs` 的差异说明与应用结果按当前语言生成；WebUI `ConfigSyncModal` 的已选计数走 i18n。
  - **文档站默认英文**：VitePress 根路径改为英文。原先截图中的「推荐方式：官方一键安装脚本」现为 `/guide/installation` 的 “Recommended: Official One-Line Install Script”。简体中文整站位于 `/zh/`。

- **[桌面首次向导、顶栏刷新与临时远程访问] 第一次打开桌面端补上语言和模型向导，右上角可以刷新页面并临时对局域网开放**：
  - **首次向导**：`desktop=1` 且还没有模型时弹出 `OnboardingWizard`，先选语言再进入模型配置，可跳过。
  - **刷新与更新图标**：右上角增加可点击刷新（整页重载）。检测更新按钮改为环形箭头。
  - **临时远程访问**：`RemoteAccessControl` 提供监听地址（默认 `0.0.0.0`）、端口（默认 `4096`）、token，以及「无 token」勾选。勾选后 token 框禁用并变为白底。`POST /api/remote-access` 在当前进程上再绑一个监听，不重启原来的页面；`token_optional` 打开后本进程不再校验 token。

- **[Windows 登录自启] 不再使用会静默失败的 `schtasks /SC ONLOGON`**：
  - 启动命令写入 `%USERPROFILE%\.jeikcode\services\JeikCode-<port>.cmd`，并登记 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`。`resolve_service_exe` 在 Windows 上使用当前正在运行的 `.exe`。`jeikcode server list/uninstall` 能看到并删除该登录项，同时清掉同名旧计划任务，避免两个进程抢端口。

- **[会话列表、模型入口与实时跟上] 新会话能看出项目路径，进行中的回合不再只靠 F5 才出现正文**：
  - **新会话**：落地页显示所属项目路径。模型选择和配置齿轮在发出第一条消息前就挂在右上角。
  - **项目排序**：左侧项目按该项目里最新一条会话消息的时间置顶，侧栏轮询同时刷新项目列表。
  - **实时跟上**：进行中的会话每秒用和刷新相同的 `tail` 读取已落盘记录。磁盘正文更长就立刻画上；磁盘已结束而页面仍在空转就停掉光标。实时流比磁盘更新时，旧 snapshot 不会盖掉更长的画布。本页刚发出的消息若切到新会话，会跟着那个会话，不再把后续输出丢掉。观察模式在 watch 仍连接时也会采用更长的磁盘正文。

## v7.1.40 (2026-10-01)

- **[多项目会话隔离与端到端目录穿透根治] 彻底消除 WebUI 在多项目间新建聊天与快速切换会话时的并发竞态与工作目录污染，草稿权威绑定与状态机原子化收敛**：
  - **前端导航序列号屏障与过期响应熔断 (NavSeq Cancellation & Race Guard)**：针对用户在项目 B 点击 `+`（新建聊天）异步请求 `createSession` 在途期间快速切换至项目 A 会话的并发竞态，在 `webui/src/app.tsx` 中引入单调递增导航序列号 `navSeqRef`。当用户在响应返回前切换会话、切换项目或重新新建时，递增序列号使在途请求立即失效；`createSession.then` 严格校验序列一致性，主动丢弃过期响应，坚决杜绝旧项目的延迟回调暴力覆盖当前视图的会话 ID 与元数据。
  - **前端会话权威工作目录原子收敛 (Authoritative Session Cwd Binding)**：在 `webui/src/components/Chat.tsx` 中建立以当前活跃会话自身为最高真理的 `effectiveWorkingDir` 计算模型（`activeSession.working_dir ?? cwd`），并将 `/chat` 流式会话、`/fs/upload` 附件上传、`/compact` 会话压缩、Git 状态面板以及 `@` 目录自动补全全面收敛绑定至会话专属目录；同时在 `openNewSession` 发起前立即预先同步 `cwd`，并在有效响应回调中原子补齐 `setCwd(data.working_dir)`，彻底根除前后端目录状态分裂与丢失。
  - **后端草稿目录绝对权威性校验与防篡改 (Session Draft Absolute Directory Authority)**：在 `crates/jeikcode-daemon/src/lib.rs` 的核心对话路由 `process_chat_request` 中，针对客户端请求携带的草稿 `session_id`，强制以 `crate::native_live::session_draft_working_dir` 在内存中登记的原初目录为绝对权威；无论客户端由于并发竞态或其他异常传入何种外层 `req.working_dir`，后端强行校正其 `working_dir` 与计算出的 `project_bucket`，彻底根除将草稿会话错误落盘至其他项目目录与 bucket 的安全漏洞，从根本上消除了会话“穿透跑到其他项目列表”的隐患。
  - **跨项目已落盘会话自动寻址校准 (Cross-Project Resolved Catalog Healing)**：在会话未命中当前请求目录所对应的 `project_bucket` 时，通过 `resolve_session_by_id` 自动跨项目扫描定位该会话真正的归属项目与权威目录，并在 `process_chat_request` 中自动对齐 `working_dir`；同时升级 `crates/jeikcode-daemon/src/live_api.rs` 的 `live_message` 路由，针对多项目并发调用优先解析草稿与已落盘会话目录，杜绝误用全局 `state.project`。
  - **自动化测试防线与多项目状态验证 (Full Test Coverage & Verification)**：在前端 `webui/src/lib/sessionList.test.ts` 中新增异步时序竞态单元测试，模拟高频点击切换与网络乱序返回，验证过期响应被精准丢弃；在后端 `crates/jeikcode-daemon/src/lib.rs` 中新增 `session_draft_working_dir_guards_against_cross_project_penetration` 跨项目隔离测试，验证在伪造恶意或竞态 working_dir 场景下后端权威目录与 bucket hash 的绝对物理隔离；全套 268 项前端测试及工作区 `cargo check` 100% 绿灯通过。

- **[Session 级 MCP 隔离与多会话环境注入] 为会话作用域 stdio MCP 子进程注入会话身份，并发 Schema 探测双重检查锁治理**：
  - **会话级环境变量安全注入 (`JEIKCODE_SESSION_ID`)**：在 `crates/jeikcode-capabilities/src/mcp/transport_stdio.rs` 中为 `StdioClient` 增加会话身份标识；在启动会话级 MCP 子进程时完成安全校验，并将 `JEIKCODE_SESSION_ID` 正式注入子进程运行环境变量，使下游 MCP 服务可原生感知并区分会话上下文。
  - **断线自愈重连状态保全**：升级 `clone_for_recovery` 机制，在 stdio 管道异常重连时完整继承会话 ID 与作用域身份，防止自愈后丢失会话上下文；沿 `McpRegistry` 与 `SessionMcpPool` 调用链路完整透传 `session_id`，严格仅对声明了 `scope: "session"` 的服务执行隔离。
  - **并发 Schema 探测双重检查锁 (Double-Checked Locking)**：在 `crates/jeikcode-capabilities/src/mcp/schema_cache.rs` 的 `ensure_session_mcp_schema` 中引入双重检查锁，根治多会话并发冷启动时重复拉起探测子进程的资源竞争，测试等待时序与后台异步探测稳定性大幅增强。

- **[WebUI 乐观会话集合与首发切走防丢] 乐观会话字典级去重保护，转圈动效即刻反馈与前后端状态无缝衔接**：
  - **会话集合级乐观持久化 (`optimisticSessions`)**：全面重构会话挂载机制，支持跨会话切换的多条乐观记录集合。用户在新建会话首发消息后立即切换至其他会话时，侧栏完整保留该正在进行中的新建会话，彻底解决因等待落盘而在侧栏瞬间消失的严重体验缺陷。
  - **点击发送即时视觉广播**：点击发送按钮时立即触发前端 running 广播并点亮转圈指示器，告别过去等待模型首字吐出或依赖切会话才能看到加载态的顿挫感；服务端分配真实 ID（`handleSessionAssigned`）时自动驱动侧栏列表无缝融合覆盖。

- **[发布流水线与发版说明工业级重构] CI 自动提取 CHANGELOG 结构化详述正文，规范发版动作并杜绝极简 Release 描述**：
  - **发布脚本 CHANGELOG 深度解析提取 (`scripts/publish-release.js`)**：新增 `extractChangelogSection` 解析引擎，发版流水线在构建各平台制品时，优先精准提取 `CHANGELOG.md` 中当前 Tag 对应的完整多层次更新说明注入 `release_notes.md`，使 GitHub Release Notes 完整承载工业级专业技术详述，告别仅有单行 Commit 的简陋发布。
  - **流水线 Release Notes 纯净交付 (`.github/workflows/build.yml`)**：移除 `action-gh-release` 冗余的 `generate_release_notes: true` 参数，防止 GitHub 自动生成的简短 commit 列表污染和冲淡经过严格编写的 Release 正文。
  - **发版规范长效可复用沉淀 (`AGENTS.md`)**：全面重构 6.3 节发版规范，以正面、直接的行动指南清晰列出发版涉及的核心文件与多层次结构化格式要求，便于 Agent 与维护者长期严格复用。

- **[前沿模型矩阵配置接入与官方文档体系重塑] 接入 Grok 4.7、Claude Opus 4.7 与 MiMo 2.6，重构中英 README 突出差异化优势**：
  - **前沿模型矩阵配置**：开箱即用支持包括 Grok 4.7、Claude Opus 4.7 与 MiMo 2.6 在内的全新一代前沿模型；
  - **文档结构优化**：精炼中英文 README，置顶快速上手指南与多平台一键安装命令，深度突出高并发进站流水线、词林双语检索及 Neutral Agent 纯净执行循环等核心架构优势；同步升级动态 GitHub Release 徽章。

## v7.1.39 (2026-09-30)

- WebUI 布局与模型控件重构：将模型选择控件从底部输入框完整移出并优雅集成到顶部标题栏右上角（刷新、主题、语言切换按钮右侧），彻底根除输入框底部空间拥挤导致的发送按钮被挤出边界、变形与截断的问题。
- 顶栏控件层级与防穿透优化：右上角操作栏严格垂直居中对齐在 40px 高度的顶栏内，下边缘保留 6px 安全呼吸间隙，彻底杜绝圆按钮或模型胶囊下沿穿透或压在下方 Git 面板及小三角形折叠指示器上的视觉缺陷。
- 现代化模型胶囊与级联下拉重塑：模型触发器升级为现代高质感微胶囊，新增微型模型图标与渠道微标，支持超长别名自适应优雅截断；下拉级联菜单改为顺应顶部直觉的向下平滑展开（向下弹出），采用完全不透明深色高质感背景配合细腻高斯模糊与深度柔和阴影，层级提升至最高，彻底防止文字半透明重叠穿透。

## v7.1.38 (2026-09-30)

- WebUI 布局与交互优化：右上角快捷工具栏（检测更新、主题、语言切换）新增右侧检视面板（提问记录 / Git面板）展开与折叠状态联动，支持平滑自适应避让，彻底解决穿透遮盖 Git 面板与“本轮提问”标题和折叠按钮的问题。
- 输入框响应式体验重构：移除桌面端在窗口缩略或分屏时不合理的强制两行堆叠，模型选择器自适应弹性收缩截断，输入工具（+号附件、同步、模式、模型）与发送操作自然舒展于单行流，彻底消除把+号和同步按钮强行堆叠到上一行的不美观视觉。
- 项目会话列表即时同步：多项目手风琴展开列表全面贯穿乐观会话并自动展开所属项目文件夹，新会话发送瞬间立即可见；首轮对话完成落盘后联动刷新项目会话缓存，无需手动按 F5 刷新网页即可无缝更新。
- 流式传输防丢与实时渲染：分离前台活跃流请求标识与脱机停止别名，免疫后台异步检测对请求 ID 的改写，移除发消息后 200ms 不必要的竞态列表刷新并增加 Sync 模式连通性自愈，彻底修复发消息后界面卡死在呼吸闪烁、手动刷新后才看到 Agent 输出了多条消息的问题。


- WebUI：彻底修复侧边栏残留的 `viewProjectHash` 引用异常，消除组件挂载抛出 `ReferenceError` 导致的黑屏崩溃；修复折叠导轨新建会话与转向消息图片类型定义。
- 桌面端：修复启动时将 `tauri.localhost` 虚拟协议误识别为外链并弹窗外部浏览器导致 ERR_CONNECTION_REFUSED 的问题，本地协议安全放行，禁止外部拉起内部虚拟域名。
- 图标与快捷方式：使用官方网页版高清透明 Logo 重新生成全套桌面与安装包图标，补充 128x128 等关键尺寸；新增 NSIS 安装后钩子，在安装与更新时显式绑定快捷方式图标并强制广播刷新 Windows 图标缓存，消除桌面绿色方块残留。

## v7.1.36 (2026-09-30)

- WebUI：右上角快捷工具栏新增检测更新按钮，支持自动静默检测与手动点击检测；检测到新版本后动态点亮醒目的绿色向上箭头图标，并弹出版本升级确认与下载对话框。
- 桌面端：在 WebUI 中确认升级后自动下载对应操作系统的 Setup 安装包并展示下载进度百分比，下载完成后优雅退出当前进程并自动拉起安装包重新安装。
- 安装与配置同步：修复保留已有配置或重新安装时无法触发更新配置覆盖的问题，`install.sh` / `install.ps1` 脚本在检测到已有配置时自动触发可选配置覆盖；升级后首次启动桌面端或 WebUI 时，自动弹出与 CLI 相同规则的多选覆盖弹窗（自动保护用户自定义模型/账号及 MCP/Skills），支持一键确认覆盖。

## v7.1.35 (2026-09-30)

- WebUI：左侧边栏重构为 Codex 风格多项目收纳列表，支持多项目收纳折叠、会话归类、展开更多及项目内快捷新建；添加项目支持调起系统原生文件资源管理器通用对话框，可直接配合 Everything 快速搜寻。
- 界面布局：左上角新建会话默认在用户家目录（`~`）创建全局会话，并彻底移除旧的左上角下拉框；输入框移除底部冗余目录行与快捷键提示并贴底，释放最大化垂直空间；右上角新增圆形主题（亮色/暗色/跟随系统）与语言（简/EN）快速切换，左下角直出独立模型配置。
- 桌面端：外部链接与弹窗统一拦截并调用系统原生默认浏览器正常多标签打开（绝非无痕模式），彻底防止当前 JeikCode WebUI 界面被网页覆盖。
- 转向功能（Steer）：重构转向机制，队列消息在单步安全边界完成后即刻转换为真实用户消息并流式开启新回复，避免一直挂在排队框；支持纯文本模型剥离丢弃图片载荷与多模态模型原样载荷传递，文本结构化包裹 `<user-query>` 与轻量原则指导。
- 工具协议：移除 `run_command` 的 `task_progress` 参数，`summary` 明确根据用户提问语言输出，防止模型固定输出英文。

- 桌面端：彻底消除 Windows 启动时附带常驻的 cmd 黑色控制台窗口（子系统配置为 Windows GUI）。
- 图标：使用官方正版 JeikCode 高清 Logo 重新生成全套桌面图标，桌面快捷方式、窗口与任务栏不再显示纯色块。
- WebUI：修复输入框底部控制栏在非全屏、分屏或窄窗口时的文字挤压与重叠问题（引入容器响应式双行自适应排版与溢出保护）。

## v7.1.33 (2026-09-29)

- WebUI：时间只出现在用户发出消息时和本轮最后一条助手回复上，并保留整轮「用时」。中间的思考、工具调用、分段正文不再打时刻。

## v7.1.32 (2026-09-29)

- Linux ARM64 安装包按 16K 页对齐，树莓派 5 这类 16K 页的盒子可以运行，4K 页的机器也不受影响。
- 桌面端：Windows 为 exe 安装包，macOS 为 dmg，Linux 为 deb / AppImage（x64 另有 rpm）。窗口打开本机 WebUI，并把同一个 `jeikcode` 放到 `~/.local/bin`。

## v7.1.31 (2026-09-29)

- WebUI：停止时把排队内容还回输入框；一次粘贴多张图会全部保留；排队消息可在下一步软转向。切走后，已完成的会话不再一直转圈，未完成清单不再挤进最新消息。
- 更新：SHA256 清单改为随 GitHub Release 上传，不再为发版往 `main` 追加提交。新版本从 `releases/latest/download/latest.json` 检查更新。
