// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! 薄桌面壳：拉起同一个 `jeikcode webui`，窗口只打开它。
//! 已安装的 `~/.local/bin` 直接启动。安装包里的 `cli-bin` 只在缺失或更新时后台复制，
//! 不挡这次打开。`jeikcode upgrade` 写过的较新副本不会被安装包盖掉。

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::Manager;

/// 这次桌面壳拉起的 WebUI。端口可能因占用从 13457 顺延。
#[derive(Clone, Debug, PartialEq, Eq)]
struct WebuiOrigin {
    host: String,
    port: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LinkAction {
    StayInWebview,
    OpenExternal,
}

/// Tauri 自己的页面。交给系统浏览器会去连一个不存在的 `tauri.localhost`。
fn is_shell_internal_url(url: &tauri::Url) -> bool {
    let scheme = url.scheme();
    if matches!(scheme, "tauri" | "about" | "data" | "ipc" | "asset") {
        return true;
    }
    if scheme == "http" || scheme == "https" {
        if let Some(host) = url.host_str() {
            return host.eq_ignore_ascii_case("tauri.localhost");
        }
    }
    false
}

fn is_loopback_host(host: &str) -> bool {
    let host = host.trim_matches(|c| c == '[' || c == ']');
    host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "::1"
}

fn is_launched_webui(url: &tauri::Url, origin: &WebuiOrigin) -> bool {
    if url.scheme() != "http" && url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let Some(port) = url.port() else {
        return false;
    };
    if port != origin.port {
        return false;
    }
    host.eq_ignore_ascii_case(&origin.host)
        || (is_loopback_host(host) && is_loopback_host(&origin.host))
}

/// 顶层导航：只有壳页面和这次的 WebUI 留在窗口里。
/// `http://localhost:3000` 这类本机开发服务改由系统浏览器打开，避免盖掉当前界面。
fn navigation_action(url: &tauri::Url, origin: Option<&WebuiOrigin>) -> LinkAction {
    if is_shell_internal_url(url) {
        return LinkAction::StayInWebview;
    }
    if origin.is_some_and(|origin| is_launched_webui(url, origin)) {
        return LinkAction::StayInWebview;
    }
    LinkAction::OpenExternal
}

/// Markdown 链接带 `target="_blank"`，走新窗口而不是顶层导航。
/// 除 Tauri 虚拟地址外一律交给系统浏览器，包括本机其它端口。
fn new_window_action(url: &tauri::Url) -> LinkAction {
    if is_shell_internal_url(url) {
        LinkAction::StayInWebview
    } else {
        LinkAction::OpenExternal
    }
}

fn remember_webui_origin(slot: &Mutex<Option<WebuiOrigin>>, url: &str) {
    let Ok(parsed) = url.parse::<tauri::Url>() else {
        return;
    };
    let (Some(host), Some(port)) = (parsed.host_str(), parsed.port()) else {
        return;
    };
    *slot.lock().unwrap_or_else(|e| e.into_inner()) = Some(WebuiOrigin {
        host: host.to_string(),
        port,
    });
}

/// Quiet only while the native window is in front. Minimized stays away even
/// if the webview still reports itself focused.
fn host_window_away(minimized: bool, focused: bool) -> bool {
    minimized || !focused
}

fn read_host_away(window: &tauri::WebviewWindow) -> Option<bool> {
    let minimized = window.is_minimized().ok()?;
    let focused = window.is_focused().ok()?;
    Some(host_window_away(minimized, focused))
}

fn publish_host_away(window: &tauri::WebviewWindow, away: bool) {
    let _ = window.eval(format!("window.__jeikcodeHostAway={away};"));
}

/// The page's document.hidden / hasFocus miss a minimized WebView. Push the
/// native state so a selected session still notifies after minimize.
fn watch_host_presence(window: tauri::WebviewWindow) {
    let listener = window.clone();
    window.on_window_event(move |event| {
        if !matches!(event, tauri::WindowEvent::Focused(_)) {
            return;
        }
        if let Some(away) = read_host_away(&listener) {
            publish_host_away(&listener, away);
        }
    });

    std::thread::spawn(move || {
        let mut last = None;
        loop {
            let Some(away) = read_host_away(&window) else {
                break;
            };
            if last != Some(away) {
                publish_host_away(&window, away);
                last = Some(away);
            }
            std::thread::sleep(Duration::from_millis(400));
        }
    });
}

/// `0.0.0.0` / `::` 是监听地址，浏览器打不开。打开前改成回环。
fn external_browser_url(url: &tauri::Url) -> String {
    let bare = url
        .host_str()
        .unwrap_or("")
        .trim_matches(|c| c == '[' || c == ']');
    if bare == "0.0.0.0" || bare == "::" {
        let mut rewritten = url.clone();
        if rewritten.set_host(Some("127.0.0.1")).is_ok() {
            return rewritten.to_string();
        }
    }
    url.to_string()
}

fn open_in_external_browser(url: &str) {
    if url.contains("tauri.localhost")
        || url.starts_with("tauri://")
        || url.starts_with("about:")
        || url.starts_with("data:")
    {
        return;
    }
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut std::ffi::c_void,
                lpOperation: *const u16,
                lpFile: *const u16,
                lpParameters: *const u16,
                lpDirectory: *const u16,
                nShowCmd: i32,
            ) -> isize;
        }

        fn wide(s: &str) -> Vec<u16> {
            OsStr::new(s)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        }

        let verb = wide("open");
        let file = wide(url);
        // SW_SHOWNORMAL = 1
        let rc = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        };
        if rc > 32 {
            return;
        }
        // Fallback
        let _ = Command::new("explorer").arg(url).spawn();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(url).spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(url).spawn();
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = url;
    }
}

fn main() {
    let child = Mutex::new(None);
    tauri::Builder::default()
        .manage(ChildSlot(child))
        .setup(|app| {
            let webui_origin = Arc::new(Mutex::new(None));
            let nav_origin = Arc::clone(&webui_origin);
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("JeikCode Desktop")
            .inner_size(1280.0, 800.0)
            .resizable(true)
            .on_navigation(move |url| {
                let action = {
                    let guard = nav_origin.lock().unwrap_or_else(|e| e.into_inner());
                    navigation_action(url, guard.as_ref())
                };
                match action {
                    LinkAction::StayInWebview => true,
                    LinkAction::OpenExternal => {
                        open_in_external_browser(&external_browser_url(url));
                        false
                    }
                }
            })
            .on_new_window(|url, _features| {
                if new_window_action(&url) == LinkAction::OpenExternal {
                    open_in_external_browser(&external_browser_url(&url));
                }
                tauri::webview::NewWindowResponse::Deny
            })
            .build()?;

            watch_host_presence(window.clone());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match start_webui(&handle) {
                    Ok((url, child)) => {
                        if let Some(slot) = handle.try_state::<ChildSlot>() {
                            *slot.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(child);
                        }
                        // 必须先记下地址再导航，否则这次 WebUI 会被当成外链弹出浏览器。
                        remember_webui_origin(&webui_origin, &url);
                        let _ = window.navigate(
                            url.parse()
                                .unwrap_or_else(|_| "about:blank".parse().expect("about:blank")),
                        );
                    }
                    Err(err) => {
                        let text =
                            serde_json::to_string(&err).unwrap_or_else(|_| "\"启动失败\"".into());
                        let _ = window.eval(&format!(
                            "document.getElementById('status').textContent = {text}"
                        ));
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("启动 JeikCode Desktop 失败")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(slot) = app.try_state::<ChildSlot>() {
                    if let Some(child) = slot.0.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
                        let _ = child.kill();
                    }
                }
            }
        });
}

struct ChildSlot(Mutex<Option<std::process::Child>>);

fn start_webui(app: &tauri::AppHandle) -> Result<(String, std::process::Child), String> {
    let bundled = bundled_cli(app);
    let bin = publish_cli(bundled.as_deref()).map_err(|e| format!("安装命令行失败：{e}"))?;
    let home = home_dir();
    let (port, saved_token) = saved_webui_listen();
    let token = saved_token.unwrap_or_else(|| mint_desktop_token(port));
    let mut cmd = Command::new(&bin);
    cmd.arg("webui")
        .arg("--host")
        .arg("0.0.0.0")
        .arg("--port")
        .arg(port.to_string())
        .arg("--no-open")
        .arg("--token")
        .arg(&token);
    cmd.env("JEIKCODE_DESKTOP", "1");
    if let Some(ref bundled) = bundled {
        cmd.env("JEIKCODE_DESKTOP_CLI_BIN", bundled);
    }
    cmd.current_dir(&home)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    suppress_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("无法启动 {}：{e}", bin.display()))?;
    let stderr = child.stderr.take();
    let mut url = stderr
        .map(|pipe| read_url(pipe))
        .transpose()?
        .flatten()
        .ok_or_else(|| "jeikcode webui 没有打印出地址".to_string())?;
    if !url.contains("desktop=") {
        let separator = if url.contains('?') { "&" } else { "?" };
        url.push_str(&format!("{separator}desktop=1"));
    }
    // The process listens on 0.0.0.0. This window is on this computer, so it
    // opens 127.0.0.1. Other devices use the LAN addresses in the panel.
    url = window_url(&url);
    let probe_port = url
        .parse::<tauri::Url>()
        .ok()
        .and_then(|parsed| parsed.port())
        .unwrap_or(port);
    let ready_deadline = Instant::now() + Duration::from_secs(20);
    while Instant::now() < ready_deadline && !health_ready(probe_port) {
        std::thread::sleep(Duration::from_millis(40));
    }
    Ok((url, child))
}

/// Keep the printed launch address, but open this computer through loopback.
fn window_url(url: &str) -> String {
    let Ok(mut parsed) = url.parse::<tauri::Url>() else {
        return url.to_string();
    };
    let Some(host) = parsed.host_str() else {
        return url.to_string();
    };
    if is_loopback_host(host) {
        return parsed.to_string();
    }
    if parsed.set_host(Some("127.0.0.1")).is_ok() {
        parsed.to_string()
    } else {
        url.to_string()
    }
}

fn bundled_cli(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().resource_dir().ok()?;
    let path = dir.join("cli-bin");
    path.is_file().then_some(path)
}

fn read_url(pipe: impl std::io::Read + Send + 'static) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(pipe);
        let mut pending = String::new();
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    pending.push_str(&line);
                    if let Some(url) = extract_webui_url(&pending) {
                        let _ = tx.send(url);
                        // Dropping stderr here closes the pipe. A later write
                        // then panics twice and aborts the child, so the
                        // window sees connection refused. Drain until exit.
                        let mut extra = String::new();
                        loop {
                            extra.clear();
                            match reader.read_line(&mut extra) {
                                Ok(0) | Err(_) => break,
                                Ok(_) => {}
                            }
                        }
                        break;
                    }
                }
            }
        }
    });
    match rx.recv_timeout(Duration::from_secs(90)) {
        Ok(url) => Ok(Some(url)),
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => Err("等待 WebUI 启动超时".into()),
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => Ok(None),
    }
}

pub fn extract_webui_url(text: &str) -> Option<String> {
    let start = text.find("http://").or_else(|| text.find("https://"))?;
    let rest = &text[start..];
    let end = rest.find(|c: char| c.is_whitespace()).unwrap_or(rest.len());
    let url = rest[..end].trim_end_matches(|c: char| matches!(c, ')' | '。' | '，' | '"' | '\''));
    url.contains("token=").then(|| url.to_string())
}

fn health_ready(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(200)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(400)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(200)));
    if stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut buf = [0u8; 80];
    let Ok(n) = stream.read(&mut buf) else {
        return false;
    };
    let head = String::from_utf8_lossy(&buf[..n]);
    head.starts_with("HTTP/1.1 200") || head.starts_with("HTTP/1.0 200")
}

fn mint_desktop_token(port: u16) -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or(0);
    let token = format!("sk-{:x}-{:x}", std::process::id(), nanos);
    let dir = jeikcode_dir();
    let _ = std::fs::create_dir_all(&dir);
    let body = format!("{{\n  \"port\": {port},\n  \"token\": \"{token}\"\n}}\n");
    let _ = std::fs::write(dir.join("webui-listen.json"), body);
    token
}

fn publish_cli(bundled: Option<&Path>) -> std::io::Result<PathBuf> {
    let dest_dir = cli_dest_dir();
    let dest = dest_dir.join(cli_file_name());
    let bundled = bundled.filter(|path| looks_like_binary(path));
    let dest_ready = dest.is_file() && looks_like_binary(&dest);
    // 安装包更新，或本机还没有副本：先直接跑安装包里的文件，复制放到后台。
    let launch_bundled = bundled.is_some_and(|src| !dest_ready || bundled_is_newer(src, &dest));
    if launch_bundled {
        if let Some(src) = bundled {
            let src_owned = src.to_path_buf();
            let dest_owned = dest.clone();
            let dest_dir_owned = dest_dir.clone();
            std::thread::spawn(move || {
                let _ = std::fs::create_dir_all(&dest_dir_owned);
                let _ = std::fs::copy(&src_owned, &dest_owned);
                set_executable(&dest_owned);
                ensure_on_path(&dest_dir_owned);
            });
            set_executable(src);
            return Ok(src.to_path_buf());
        }
    }
    if dest_ready {
        let dest_dir_owned = dest_dir.clone();
        std::thread::spawn(move || ensure_on_path(&dest_dir_owned));
        return Ok(dest);
    }
    if dest.is_file() {
        return Ok(dest);
    }
    Ok(PathBuf::from(cli_file_name()))
}

fn bundled_is_newer(bundled: &Path, dest: &Path) -> bool {
    let bundled_mtime = std::fs::metadata(bundled)
        .ok()
        .and_then(|m| m.modified().ok());
    let dest_mtime = std::fs::metadata(dest).ok().and_then(|m| m.modified().ok());
    match (bundled_mtime, dest_mtime) {
        (Some(bundled), Some(dest)) => bundled > dest,
        (Some(_), None) => true,
        _ => false,
    }
}

fn cli_dest_dir() -> PathBuf {
    home_dir().join(".local").join("bin")
}

fn cli_file_name() -> &'static str {
    if cfg!(windows) {
        "jeikcode.exe"
    } else {
        "jeikcode"
    }
}

const WEBUI_DEFAULT_PORT: u16 = 13457;

/// `~/.jeikcode/webui-listen.json` written by the remote-access panel.
/// Missing file, a bad file, or no token means: port 13457 and a random token.
fn saved_webui_listen() -> (u16, Option<String>) {
    let path = jeikcode_dir().join("webui-listen.json");
    let Ok(text) = std::fs::read_to_string(path) else {
        return (WEBUI_DEFAULT_PORT, None);
    };
    parse_webui_listen(&text)
}

fn parse_webui_listen(text: &str) -> (u16, Option<String>) {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
        return (WEBUI_DEFAULT_PORT, None);
    };
    let port = value
        .get("port")
        .and_then(|item| item.as_u64())
        .and_then(|item| u16::try_from(item).ok())
        .filter(|item| *item != 0)
        .unwrap_or(WEBUI_DEFAULT_PORT);
    let token = value
        .get("token")
        .and_then(|item| item.as_str())
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string);
    (port, token)
}

fn jeikcode_dir() -> PathBuf {
    if let Some(home) = std::env::var_os("JEIKCODE_HOME") {
        if !home.is_empty() {
            return PathBuf::from(home);
        }
    }
    home_dir().join(".jeikcode")
}

fn home_dir() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn looks_like_binary(path: &Path) -> bool {
    let mut magic = [0u8; 4];
    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };
    let Ok(n) = file.read(&mut magic) else {
        return false;
    };
    n >= 2
        && (magic.starts_with(b"MZ")
            || magic.starts_with(b"\x7fELF")
            || magic.starts_with(&[0xfe, 0xed, 0xfa])
            || magic.starts_with(b"#!")
            || magic.starts_with(&[0xcf, 0xfa, 0xed, 0xfe])
            || magic.starts_with(&[0xca, 0xfe, 0xba, 0xbe]))
}

fn set_executable(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
    }
    let _ = path;
}

fn ensure_on_path(dir: &Path) {
    #[cfg(windows)]
    ensure_windows_path(dir);
    #[cfg(not(windows))]
    ensure_shell_path(dir);
}

#[cfg(windows)]
fn ensure_windows_path(dir: &Path) {
    use winreg::enums::*;
    use winreg::RegKey;
    let Ok(env) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
    else {
        return;
    };
    let current: String = env.get_value("Path").unwrap_or_default();
    let dir_text = dir.display().to_string();
    let already = current
        .split(';')
        .any(|p| p.trim().eq_ignore_ascii_case(&dir_text));
    if already {
        return;
    }
    let next = if current.trim().is_empty() {
        dir_text
    } else {
        format!("{dir_text};{current}")
    };
    let _ = env.set_value("Path", &next);
}

#[cfg(not(windows))]
fn ensure_shell_path(dir: &Path) {
    let line = format!("export PATH=\"{}:$PATH\"", dir.display());
    for name in [".zshrc", ".bashrc"] {
        let path = home_dir().join(name);
        let existing = std::fs::read_to_string(&path).unwrap_or_default();
        if existing.lines().any(|l| l.trim() == line) {
            continue;
        }
        let mut next = existing;
        if !next.is_empty() && !next.ends_with('\n') {
            next.push('\n');
        }
        next.push_str("\n# Added by JeikCode Desktop\n");
        next.push_str(&line);
        next.push('\n');
        let _ = std::fs::write(path, next);
    }
}

#[cfg(windows)]
fn suppress_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_console(_cmd: &mut Command) {}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{
        bundled_is_newer, external_browser_url, extract_webui_url, host_window_away,
        navigation_action, new_window_action, parse_webui_listen, remember_webui_origin,
        window_url, LinkAction, WebuiOrigin,
    };

    fn parse_url(raw: &str) -> tauri::Url {
        raw.parse().unwrap()
    }

    #[test]
    fn bundled_cli_does_not_replace_a_newer_dest() {
        let dir = std::env::temp_dir().join(format!("jeik-cli-mtime-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let dest = dir.join("dest");
        let bundled = dir.join("bundled");
        std::fs::write(&bundled, b"old-installer").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(30));
        std::fs::write(&dest, b"cli-upgraded").unwrap();
        assert!(
            !bundled_is_newer(&bundled, &dest),
            "CLI-upgraded dest must win over an older desktop installer copy"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn origin(host: &str, port: u16) -> WebuiOrigin {
        WebuiOrigin {
            host: host.to_string(),
            port,
        }
    }

    #[test]
    fn minimized_window_is_away_even_if_the_page_keeps_focus() {
        assert!(!host_window_away(false, true));
        assert!(host_window_away(true, true));
        assert!(host_window_away(true, false));
        assert!(host_window_away(false, false));
    }

    #[test]
    fn window_opens_loopback_when_the_launch_url_uses_a_lan_address() {
        assert_eq!(
            window_url("http://192.168.123.20:13457/?token=abc&desktop=1"),
            "http://127.0.0.1:13457/?token=abc&desktop=1"
        );
        assert_eq!(
            window_url("http://127.0.0.1:13457/?token=abc"),
            "http://127.0.0.1:13457/?token=abc"
        );
    }

    #[test]
    fn saved_listen_uses_the_port_and_token_and_ignores_a_blank_token() {
        assert_eq!(
            parse_webui_listen(r#"{"port":4096,"token":"desk-token"}"#),
            (4096, Some("desk-token".to_string()))
        );
        assert_eq!(
            parse_webui_listen(r#"{"port":0,"token":"  "}"#),
            (13457, None)
        );
        assert_eq!(parse_webui_listen("not json"), (13457, None));
    }

    #[test]
    fn reads_token_url_from_webui_line() {
        let line = "webui 已启动：http://127.0.0.1:13457/?token=abc&sync=0\n";
        assert_eq!(
            extract_webui_url(line).as_deref(),
            Some("http://127.0.0.1:13457/?token=abc&sync=0")
        );
    }

    #[test]
    fn ignores_text_without_token() {
        assert!(extract_webui_url("listen http://127.0.0.1:13457/").is_none());
    }

    #[test]
    fn shell_pages_stay_in_the_window() {
        for raw in [
            "http://tauri.localhost/",
            "http://tauri.localhost/index.html",
            "https://tauri.localhost/index.html",
            "tauri://localhost",
            "about:blank",
        ] {
            let parsed = parse_url(raw);
            assert_eq!(
                navigation_action(&parsed, None),
                LinkAction::StayInWebview,
                "{raw}"
            );
            assert_eq!(
                new_window_action(&parsed),
                LinkAction::StayInWebview,
                "{raw}"
            );
        }
    }

    #[test]
    fn launched_webui_stays_in_the_window() {
        let launched = origin("127.0.0.1", 13457);
        assert_eq!(
            navigation_action(
                &parse_url("http://127.0.0.1:13457/?token=abc"),
                Some(&launched)
            ),
            LinkAction::StayInWebview
        );
        assert_eq!(
            navigation_action(
                &parse_url("http://localhost:13457/?token=abc&desktop=1"),
                Some(&launched)
            ),
            LinkAction::StayInWebview
        );
        let shifted = origin("127.0.0.1", 13458);
        assert_eq!(
            navigation_action(
                &parse_url("http://127.0.0.1:13458/?token=abc"),
                Some(&shifted)
            ),
            LinkAction::StayInWebview
        );
        // 地址还没记下来时不能把 WebUI 留在窗口里，调用方必须先 remember 再导航。
        assert_eq!(
            navigation_action(&parse_url("http://127.0.0.1:13457/?token=abc"), None),
            LinkAction::OpenExternal
        );
    }

    #[test]
    fn localhost_dev_servers_open_in_the_browser() {
        let launched = origin("127.0.0.1", 13457);
        for raw in [
            "http://localhost:3000/",
            "http://127.0.0.1:5173/",
            "http://[::1]:8080/",
            "http://0.0.0.0:3000/",
            "http://app.localhost:3000/",
            "https://github.com/jeikl/JeikCode",
            "https://google.com",
        ] {
            let parsed = parse_url(raw);
            assert_eq!(
                navigation_action(&parsed, Some(&launched)),
                LinkAction::OpenExternal,
                "{raw}"
            );
            assert_eq!(
                new_window_action(&parsed),
                LinkAction::OpenExternal,
                "{raw}"
            );
        }
        let webui = parse_url("http://127.0.0.1:13457/?token=abc");
        assert_eq!(new_window_action(&webui), LinkAction::OpenExternal);
    }

    #[test]
    fn wildcard_bind_urls_open_on_loopback() {
        assert_eq!(
            external_browser_url(&parse_url("http://0.0.0.0:3000/")),
            "http://127.0.0.1:3000/"
        );
        assert_eq!(
            external_browser_url(&parse_url("http://[::]:8080/docs")),
            "http://127.0.0.1:8080/docs"
        );
        assert_eq!(
            external_browser_url(&parse_url("http://localhost:5173/")),
            "http://localhost:5173/"
        );
    }

    #[test]
    fn remembers_launched_origin() {
        let slot = Mutex::new(None);
        remember_webui_origin(&slot, "http://127.0.0.1:13480/?token=abc&desktop=1");
        let stored = slot.lock().unwrap().clone().unwrap();
        assert_eq!(stored, origin("127.0.0.1", 13480));
    }
}
