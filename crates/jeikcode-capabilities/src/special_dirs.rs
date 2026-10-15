//! ONE home for the *special directories* JeikCode exports to shells and the
//! `$VAR` expansion used when resolving model-supplied paths.
//!
//! The `bash` tool exports `TMPDIR`/`TMP`/`TEMP`/`DESKTOP` into every shell child
//! (`tools::bash::apply_shell_env`), while built-in tools (`read`, `grep`, `glob`,
//! `edit`, `write`, `code_explore`, …) resolve their path parameters through
//! `pathutil::resolve_path`. If both sides picked their own value the two drift:
//! `$TMPDIR` works in the shell but `$TMPDIR/x` handed to `read` silently becomes
//! a *relative* path under the working dir. This module collapses the rule into
//! one place — the shell injection, the tool-side expansion, and the daemon's
//! shortcut list all resolve through [`lookup`] / [`desktop_dir`].
//!
//! Windows desktop keeps the REGISTRY as its single source of truth: the OS Known
//! Folder API (`SHGetKnownFolderPath(FOLDERID_Desktop)`, i.e. the very same
//! `User Shell Folders\Desktop` value, with redirection / OneDrive already applied)
//! first, falling back to reading that registry value directly.

use std::path::PathBuf;

/// Resolve a special-directory NAME to its real path. ASCII case-insensitive,
/// because Windows environment names are case-insensitive by construction.
///
/// - `TMPDIR` / `TMP` / `TEMP` → the process temp dir (see [`temp_dir`])
/// - `DESKTOP` → the real desktop (see [`desktop_dir`])
/// - `HOME` → the user's home (`HOME`, `USERPROFILE` on Windows)
///
/// Any other name returns `None`, so callers keep the "undefined variables stay
/// verbatim" rule (see [`expand`]).
pub fn lookup(name: &str) -> Option<PathBuf> {
    if name.eq_ignore_ascii_case("TMPDIR")
        || name.eq_ignore_ascii_case("TMP")
        || name.eq_ignore_ascii_case("TEMP")
    {
        return Some(temp_dir());
    }
    if name.eq_ignore_ascii_case("DESKTOP") {
        return desktop_dir();
    }
    if name.eq_ignore_ascii_case("HOME") {
        return home_dir();
    }
    None
}

/// The process temp dir, GUARANTEED to be in native form on Windows.
///
/// `std::env::temp_dir()` (GetTempPath) returns whatever `TMP`/`TEMP` hold — and when
/// JeikCode is launched from Git Bash those hold MSYS paths (`/tmp/`). Exporting that
/// to shells is how `$TMPDIR/x` ended up as a POSIX path: fine for MSYS tools, but a
/// native program (python/node/curl) reading it as an ARGUMENT resolves `<drive>:\tmp`
/// and fails (the reported 404s). MSYS does not rewrite env values (verified), so the
/// value we hand out is exactly what a shell sees. Normalize once, here: a POSIX value
/// is replaced by the OS-native temp dir built from native sources.
pub fn temp_dir() -> PathBuf {
    let raw = std::env::temp_dir();
    if !cfg!(windows) || !is_posix_absolute(&raw) {
        return raw;
    }
    native_temp_dir().unwrap_or(raw)
}

/// A native Windows temp dir that cannot itself be a POSIX leftover: `TEMP`/`TMP` when
/// they are already native, else `%LOCALAPPDATA%\Temp` (created if missing), else
/// `%USERPROFILE%\AppData\Local\Temp`. `None` only when every source is unusable.
#[cfg(windows)]
fn native_temp_dir() -> Option<PathBuf> {
    for var in ["TEMP", "TMP"] {
        if let Some(value) = std::env::var_os(var) {
            let path = PathBuf::from(&value);
            if !value.is_empty() && !is_posix_absolute(&path) {
                return Some(path);
            }
        }
    }
    // The user's REAL temp lives in `HKCU\Environment` (e.g. `F:\temp` on a machine with
    // a RAM-disk temp) — a POSIX leftover in the process env must not push us off it.
    if let Some(from_registry) = registry_temp_dir() {
        return Some(from_registry);
    }
    let local = std::env::var_os("LOCALAPPDATA")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .filter(|p| !is_posix_absolute(p))?;
    let candidate = local.join("Temp");
    if candidate.is_dir() {
        return Some(candidate);
    }
    if std::fs::create_dir_all(&candidate).is_ok() {
        return Some(candidate);
    }
    None
}

/// The temp dir the USER configured, read from `HKCU\Environment` (`TEMP`, then `TMP`).
/// Registry values are editor-set and therefore native by construction; a POSIX value
/// (hand-edited) is rejected rather than trusted.
#[cfg(windows)]
fn registry_temp_dir() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Environment")
        .ok()?;
    for name in ["TEMP", "TMP"] {
        if let Ok(value) = key.get_value::<String, _>(name) {
            let path = PathBuf::from(value.trim());
            if !path.as_os_str().is_empty() && !is_posix_absolute(&path) {
                return Some(path);
            }
        }
    }
    None
}

#[cfg(not(windows))]
fn registry_temp_dir() -> Option<PathBuf> {
    None
}

/// Point the PROCESS environment's temp variables at the native temp dir when they hold
/// MSYS/POSIX values (`/tmp/`).
///
/// `apply_shell_env` normalizes what JeikCode EXPORTS to shells, but every native child
/// spawned directly (MCP servers, git, formatters, the desktop shell) inherits the
/// process env instead — and a native program resolves a POSIX `TEMP` as `<drive>:\tmp`.
/// A Git-Bash launch leaves exactly that behind, so each process entry point calls this
/// once at startup. No-op when the env is already native (and on non-Windows).
pub fn sanitize_process_temp_env() {
    if !cfg!(windows) {
        return;
    }
    let native = temp_dir();
    if is_posix_absolute(&native) {
        return;
    }
    let native = native.to_string_lossy().into_owned();
    if native.is_empty() {
        return;
    }
    for name in ["TMPDIR", "TMP", "TEMP"] {
        let polluted = std::env::var_os(name)
            .map(|value| value.to_string_lossy().starts_with('/'))
            .unwrap_or(false);
        if polluted {
            // SAFETY: every caller runs this as the first statement of `main` (before the
            // runtime spawns workers or any other thread exists), so no thread can be
            // reading the environment concurrently.
            unsafe { std::env::set_var(name, &native) };
        }
    }
}

#[cfg(not(windows))]
fn native_temp_dir() -> Option<PathBuf> {
    None
}

/// POSIX-absolute test for a value that came out of the environment (a Windows path
/// never starts with a bare `/`, so this cannot misfire on native forms).
fn is_posix_absolute(path: &std::path::Path) -> bool {
    path.as_os_str().to_string_lossy().starts_with('/')
}

/// The user's home directory — the same rule leading-`~` expansion uses.
pub fn home_dir() -> Option<PathBuf> {
    crate::pathutil::home_dir()
}

/// The real desktop directory; `None` when it cannot be resolved. Shared by the
/// shell `$DESKTOP` export, the tool-side `$DESKTOP` expansion, and the daemon's
/// shortcut list, so all three name the same place.
pub fn desktop_dir() -> Option<PathBuf> {
    if let Some(dir) = dirs::desktop_dir() {
        return Some(dir);
    }
    #[cfg(windows)]
    return desktop_dir_from_registry();
    #[cfg(not(windows))]
    None
}

/// Expand `$VAR` / `${VAR}` (plus `%VAR%` on Windows) in a model-supplied path,
/// stripping one balanced wrapping quote pair first (`"$TMPDIR/x"` is exactly what
/// copying the prompt's own environment facts produces).
///
/// A name is replaced only when it RESOLVES — the process env first, then
/// [`lookup`] for the names that only exist inside shell children (Windows has no
/// process `TMPDIR`, and `DESKTOP` is never in the environment). An undefined name
/// is kept VERBATIM: silently deleting it would turn `$TMPDIR/x` into the absolute
/// `/x` and escape the workspace. Shell forms beyond this (`${VAR:-x}`, `$(…)`) are
/// intentionally unsupported — a name containing `:` / `(` simply fails to resolve
/// and stays literal.
///
/// `None` means "nothing to substitute": the caller keeps its original string and
/// pays no allocation.
pub fn expand(raw: &str) -> Option<String> {
    let (text, mut changed) = match strip_balanced_quotes(raw) {
        Some(inner) => (inner, true),
        None => (raw, false),
    };
    let percent_style = cfg!(windows);
    if !text.contains('$') && !(percent_style && text.contains('%')) {
        return changed.then(|| text.to_owned());
    }

    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0usize;
    while i < chars.len() {
        match chars[i] {
            '$' => {
                if let Some((name, end)) = read_dollar_token(&chars, i + 1) {
                    match resolve_var(&name) {
                        Some(value) => {
                            out.push_str(&value);
                            changed = true;
                        }
                        // Undefined → keep the whole token (`$NAME` / `${NAME}`) as-is.
                        None => out.extend(&chars[i..end]),
                    }
                    i = end;
                } else {
                    out.push('$');
                    i += 1;
                }
            }
            '%' if percent_style => {
                if let Some((name, end)) = read_percent_token(&chars, i + 1) {
                    match resolve_var(&name) {
                        Some(value) => {
                            out.push_str(&value);
                            changed = true;
                        }
                        None => out.extend(&chars[i..end]),
                    }
                    i = end;
                } else {
                    out.push('%');
                    i += 1;
                }
            }
            other => {
                out.push(other);
                i += 1;
            }
        }
    }
    changed.then_some(out)
}

/// Variable name → value. The process environment wins (macOS/Linux `TMPDIR`,
/// Windows `TEMP`/`USERPROFILE`), and [`lookup`] covers the names that only exist
/// inside shell children, so a tool expands exactly what the shell would see.
fn resolve_var(name: &str) -> Option<String> {
    if let Some(value) = std::env::var_os(name) {
        if !value.is_empty() {
            return Some(value.to_string_lossy().into_owned());
        }
    }
    lookup(name).map(|dir| dir.to_string_lossy().into_owned())
}

/// Strip ONE balanced wrapping quote pair (`"…"` or `'…'`). `None` when the string
/// is not quote-wrapped or contains an interior copy of that same quote (which
/// would make "the outer pair" ambiguous and could mangle a real filename).
fn strip_balanced_quotes(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    let quote = trimmed.chars().next_back()?;
    if (quote != '"' && quote != '\'') || trimmed.chars().next()? != quote {
        return None;
    }
    let inner = trimmed.strip_prefix(quote)?.strip_suffix(quote)?;
    (!inner.contains(quote)).then_some(inner)
}

/// Read the variable token starting just after a `$`. Returns `(name, end)` where
/// `end` indexes one past the token, so an unresolved name can be re-emitted
/// verbatim. `None` = not a variable form (literal `$`).
fn read_dollar_token(chars: &[char], start: usize) -> Option<(String, usize)> {
    match chars.get(start)? {
        '{' => {
            let mut name = String::new();
            for (offset, ch) in chars[start + 1..].iter().enumerate() {
                if *ch == '}' {
                    let end = start + 1 + offset + 1;
                    let ok = valid_var_name(&name);
                    return ok.then_some((name, end));
                }
                name.push(*ch);
            }
            // Unterminated `${` → literal `$`.
            None
        }
        ch if is_var_name_start(*ch) => {
            let mut name = String::new();
            let mut end = start;
            while let Some(ch) = chars.get(end) {
                if !is_var_name_char(*ch) {
                    break;
                }
                name.push(*ch);
                end += 1;
            }
            Some((name, end))
        }
        _ => None,
    }
}

/// Read a Windows-style `%NAME%` token starting just after the opening `%`.
fn read_percent_token(chars: &[char], start: usize) -> Option<(String, usize)> {
    let mut name = String::new();
    for (offset, ch) in chars[start..].iter().enumerate() {
        if *ch == '%' {
            let end = start + offset + 1;
            let ok = valid_var_name(&name);
            return ok.then_some((name, end));
        }
        name.push(*ch);
    }
    None
}

fn is_var_name_start(ch: char) -> bool {
    ch.is_ascii_alphabetic() || ch == '_'
}

fn is_var_name_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_'
}

fn valid_var_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars.next().is_some_and(is_var_name_start) && chars.all(is_var_name_char)
}

/// Windows desktop REGISTRY fallback: `User Shell Folders\Desktop` — the value the
/// Known Folder API itself reads (redirection / OneDrive therefore still wins when
/// present). `REG_EXPAND_SZ` values embed `%USERPROFILE%`-style names and `winreg`
/// hands them back unexpanded, hence the [`expand`] pass.
#[cfg(windows)]
fn desktop_dir_from_registry() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")
        .ok()?;
    let raw: String = key.get_value("Desktop").ok()?;
    let text = raw.trim();
    let expanded = expand(text).unwrap_or_else(|| text.to_owned());
    let path = PathBuf::from(expanded);
    path.is_dir().then_some(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_resolves_the_names_shells_receive_case_insensitively() {
        for name in ["TMPDIR", "tmp", "Temp"] {
            assert_eq!(lookup(name), Some(temp_dir()), "{name}");
        }
        assert_eq!(lookup("HOME"), crate::pathutil::home_dir());
        assert_eq!(lookup("JEIKCODE_UNSET_DIR"), None);
    }

    #[test]
    fn temp_dir_is_native_form_even_when_the_process_env_was_polluted() {
        // This test process inherits the launcher's env, which on a Git-Bash launch is
        // POSIX (`/tmp/`). The value handed to shells and to `$VAR` expansion must
        // still be native, or native programs mis-resolve an ARGUMENT built from it.
        let dir = temp_dir();
        assert!(dir.is_dir(), "{dir:?}");
        // "Native" is platform-relative: a leading `/` is POSIX pollution ONLY on
        // Windows (the bug this guards); on Unix `/tmp` / `/var/folders/...` IS the
        // native form, so the slash/drive checks run under `cfg!(windows)` only.
        if cfg!(windows) {
            assert!(!dir.to_string_lossy().starts_with('/'), "{dir:?}");
            assert!(
                dir.to_string_lossy().as_bytes().get(1) == Some(&b':'),
                "must carry a drive letter: {dir:?}"
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn registry_temp_dir_is_native_when_present() {
        // The user's configured temp lives in HKCU\Environment (`F:\temp` on the machine
        // that reported this bug); a POSIX value can never come back from there.
        if let Some(dir) = registry_temp_dir() {
            assert!(!dir.to_string_lossy().starts_with('/'), "{dir:?}");
        }
    }

    #[test]
    fn expand_replaces_resolvable_names_only() {
        // The expectation mirrors the documented rule exactly (process env first,
        // temp dir as the fallback), so a shell-exported `TMPDIR` (native OR POSIX
        // form) can never make this flaky. `$tmpdir` is case-insensitive on Windows.
        let tmp = std::env::var_os("TMPDIR")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let expanded = expand("$tmpdir/jeik-code.md").expect("temp dir must resolve");
        assert_eq!(PathBuf::from(expanded), tmp.join("jeik-code.md"));
        // Undefined names stay verbatim — deleting them would escape the workspace.
        assert_eq!(expand("$JEIKCODE_UNSET_DIR/keep.md"), None);
        assert_eq!(expand("src/$JEIKCODE_UNSET_DIR/x.rs"), None);
        // A `$` that does not introduce a valid name is literal text.
        assert_eq!(expand("price$/note.md"), None);
        assert_eq!(expand("cost$5/x.md"), None);
    }

    #[test]
    fn expand_strips_one_balanced_quote_pair() {
        let tmp = std::env::var_os("TMPDIR")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let expanded = expand("\"$TMPDIR/jeik-code.md\"").expect("quoted form must expand");
        assert_eq!(PathBuf::from(expanded), tmp.join("jeik-code.md"));
        // Quotes without a variable are still normalized (paths get copied from docs).
        assert_eq!(expand("'src/main.rs'").as_deref(), Some("src/main.rs"));
        // Unbalanced / interior quotes are left alone.
        assert_eq!(expand("\"src/main.rs"), None);
        assert_eq!(expand("\"a\"b\""), None);
    }

    #[cfg(windows)]
    #[test]
    fn expand_handles_percent_style_on_windows() {
        let expected = std::env::var_os("TEMP")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let expanded = expand(r"%TEMP%\jeik-code.md").expect("%TEMP% must resolve");
        assert_eq!(PathBuf::from(expanded), expected.join("jeik-code.md"));
        assert_eq!(expand(r"%JEIKCODE_UNSET_DIR%\keep.md"), None);
    }
}
