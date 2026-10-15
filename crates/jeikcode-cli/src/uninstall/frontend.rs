//! `jeikcode uninstall` subcommand entry point.
//!
//! Spec: docs/superpowers/specs/2026-05-08-uninstall-design.md
//! Plan: docs/superpowers/plans/2026-05-08-uninstall-feature.md

use super::{
    actions::{PlatformSelfDelete, SelfDeleteStrategy},
    paths::jeikcode_dir,
    scan::scan,
    Decisions, ExecuteContext, Group, Outcome,
};
use jeikcode_config::i18n::{t, Msg};
use jeikcode_updater::current_exe_path;

/// How `jeikcode uninstall` was invoked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Preset {
    /// Guided prompts. Asks whether to keep user configuration.
    Interactive,
    /// Program and PATH only. Keeps user configuration. No prompts.
    Simple,
    /// Program, PATH, and all user configuration. No prompts.
    All,
}

pub struct Args {
    pub preset: Preset,
    pub yes: bool,
    pub purge: bool,
    pub keep_data: bool,
    pub dry_run: bool,
}

const EXIT_USER_DECLINED: u8 = 1;
const EXIT_BAD_ARGS: u8 = 2;
const EXIT_PARTIAL_FAIL: u8 = 3;
// EXIT_FATAL: u8 = 4 — bubbled up via anyhow::Error and the caller's process exit code.

pub fn run(args: Args) -> anyhow::Result<()> {
    use is_terminal::IsTerminal;
    let tty = std::io::stdin().is_terminal();

    let mode = match resolve_uninstall(&args, tty) {
        Ok(mode) => mode,
        Err(Reject::Conflict) => {
            eprintln!("{}", t(Msg::UninstallConflict));
            std::process::exit(EXIT_BAD_ARGS as i32);
        }
        Err(Reject::NoTty) => {
            eprintln!("{}", t(Msg::UninstallNoTty));
            std::process::exit(EXIT_BAD_ARGS as i32);
        }
    };
    let interactive = matches!(mode, DecisionMode::Interactive);
    let decisions = match mode {
        DecisionMode::Interactive => None,
        DecisionMode::Ready(d) => Some(d),
    };

    let exe = current_exe_path()?;
    let data_dir = jeikcode_dir();
    let plan = scan(&exe, &data_dir)?;

    if args.dry_run {
        print_plan(&plan, decisions.unwrap_or(Decisions::DEFAULTS));
        return Ok(());
    }

    let final_decisions = match decisions {
        Some(d) => d,
        None => match prompt_user(&plan)? {
            Some(d) => d,
            None => std::process::exit(EXIT_USER_DECLINED as i32),
        },
    };

    if !final_decisions.binary {
        eprintln!("{}", t(Msg::UninstallAborted));
        std::process::exit(EXIT_USER_DECLINED as i32);
    }

    let stop = match args.preset {
        Preset::Interactive if interactive => StopMode::Ask,
        Preset::Simple | Preset::All => StopMode::Auto,
        _ => StopMode::Skip,
    };
    if !stop_other_processes(stop)? {
        std::process::exit(EXIT_USER_DECLINED as i32);
    }

    let ctx = build_context(&plan)?;

    let strategy: Box<dyn SelfDeleteStrategy> = Box::new(PlatformSelfDelete);
    let outcome = super::execute(&plan, final_decisions, strategy.as_ref(), Some(ctx))?;
    print_summary(&outcome);

    if !outcome.failed.is_empty() {
        std::process::exit(EXIT_PARTIAL_FAIL as i32);
    }
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
enum DecisionMode {
    Interactive,
    Ready(Decisions),
}

#[derive(Debug, PartialEq, Eq)]
enum Reject {
    Conflict,
    NoTty,
}

enum StopMode {
    Ask,
    Auto,
    Skip,
}

fn resolve_uninstall(args: &Args, tty: bool) -> Result<DecisionMode, Reject> {
    let simple = matches!(args.preset, Preset::Simple);
    let all = matches!(args.preset, Preset::All);
    if (args.purge && args.keep_data)
        || (simple && (args.purge || args.yes))
        || (all && (args.keep_data || args.yes))
    {
        return Err(Reject::Conflict);
    }
    if simple || args.keep_data {
        return Ok(DecisionMode::Ready(Decisions::KEEP_DATA));
    }
    if all || args.purge {
        return Ok(DecisionMode::Ready(Decisions::PURGE));
    }
    if args.yes || args.dry_run {
        return Ok(DecisionMode::Ready(Decisions::DEFAULTS));
    }
    if !tty {
        return Err(Reject::NoTty);
    }
    Ok(DecisionMode::Interactive)
}

fn stop_other_processes(mode: StopMode) -> anyhow::Result<bool> {
    use super::actions::{kill_process, list_jeikcode_processes};
    use std::io::Write;

    if matches!(mode, StopMode::Skip) {
        return Ok(true);
    }
    let procs = list_jeikcode_processes();
    if procs.is_empty() {
        return Ok(true);
    }
    if matches!(mode, StopMode::Ask) {
        println!(
            "{}",
            t(Msg::UninstallKillFound {
                count: procs.len() as u64
            })
        );
        for p in &procs {
            println!("  pid {}  {}", p.pid, p.name);
        }
        print!("{}", t(Msg::UninstallKillAsk));
        std::io::stdout().flush()?;
        if !read_yes(false)? {
            eprintln!("{}", t(Msg::UninstallKillDeclined));
            return Ok(false);
        }
    } else {
        println!(
            "{}",
            t(Msg::UninstallAutoKilled {
                count: procs.len() as u64
            })
        );
    }
    for p in procs {
        if let Err(e) = kill_process(p.pid) {
            let err = e.to_string();
            eprintln!(
                "{}",
                t(Msg::UninstallKillFailed {
                    pid: u64::from(p.pid),
                    error: &err,
                })
            );
            // Windows cannot rename a running executable. Unix can unlink it.
            #[cfg(windows)]
            return Ok(false);
            #[cfg(not(windows))]
            {
                let _ = err;
            }
        }
    }
    Ok(true)
}

// ----- Task 9 implementations -----

fn print_plan(plan: &super::scan::Plan, decisions: Decisions) {
    println!("{}", t(Msg::UninstallDryRun));

    print_group(
        plan,
        Group::Binary,
        &t(Msg::UninstallGroupBinary),
        decisions.binary,
    );
    print_group(
        plan,
        Group::Credentials,
        &t(Msg::UninstallGroupCredentials),
        decisions.credentials,
    );
    print_group(
        plan,
        Group::State,
        &t(Msg::UninstallGroupState),
        decisions.state,
    );
}

fn print_group(plan: &super::scan::Plan, g: Group, label: &str, will_remove: bool) {
    let items: Vec<_> = plan.items.iter().filter(|i| i.group == g).collect();
    if items.is_empty() {
        return;
    }
    println!(
        "{label}  [{}]",
        if will_remove {
            t(Msg::UninstallWillRemove)
        } else {
            t(Msg::UninstallWillKeep)
        }
    );
    for it in &items {
        let mark = if it.needs_privilege { " (sudo)" } else { "" };
        println!(
            "  {}  ({}){}",
            it.path.display(),
            human_size(it.size_bytes),
            mark
        );
    }
    println!();
}

fn human_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut v = bytes as f64;
    let mut u = 0;
    while v >= 1024.0 && u < UNITS.len() - 1 {
        v /= 1024.0;
        u += 1;
    }
    if u == 0 {
        format!("{} B", bytes)
    } else {
        format!("{:.1} {}", v, UNITS[u])
    }
}

fn prompt_user(plan: &super::scan::Plan) -> anyhow::Result<Option<Decisions>> {
    use std::io::Write;

    println!("{}", t(Msg::UninstallIntro));
    print_items(plan, Group::Binary, &t(Msg::UninstallRemovingBinary));

    let has_config = plan
        .items
        .iter()
        .any(|i| matches!(i.group, Group::Credentials | Group::State));
    let keep_config = if has_config {
        let dir = plan.jeikcode_dir.display().to_string();
        println!("{}", t(Msg::UninstallConfigHeader { dir: &dir }));
        for group in [Group::Credentials, Group::State] {
            for it in plan.items.iter().filter(|i| i.group == group) {
                println!("  {}", it.path.display());
            }
        }
        print!("{}", t(Msg::UninstallKeepConfig));
        std::io::stdout().flush()?;
        read_yes(true)?
    } else {
        println!("{}", t(Msg::UninstallNoConfig));
        true
    };

    println!("{}", t(Msg::UninstallSummaryTitle));
    println!("{}", t(Msg::UninstallSummaryRemoveBinary));
    println!(
        "{}",
        if keep_config {
            t(Msg::UninstallSummaryKeepConfig)
        } else {
            t(Msg::UninstallSummaryRemoveConfig)
        }
    );
    print!("{}", t(Msg::UninstallContinue));
    std::io::stdout().flush()?;
    if !read_yes(false)? {
        eprintln!("{}", t(Msg::UninstallAborted));
        return Ok(None);
    }
    Ok(Some(Decisions {
        binary: true,
        credentials: !keep_config,
        state: !keep_config,
    }))
}

fn print_items(plan: &super::scan::Plan, group: Group, header: &str) {
    let items: Vec<_> = plan.items.iter().filter(|i| i.group == group).collect();
    if items.is_empty() {
        return;
    }
    println!("{header}");
    for it in items {
        let mark = if it.needs_privilege { " (sudo)" } else { "" };
        println!(
            "  {}  ({}){}",
            it.path.display(),
            human_size(it.size_bytes),
            mark
        );
    }
}

fn read_yes(default_yes: bool) -> anyhow::Result<bool> {
    use std::io::BufRead;
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line)?;
    let answer = line.trim();
    Ok(match answer {
        "" => default_yes,
        s if s.eq_ignore_ascii_case("y") || s.eq_ignore_ascii_case("yes") => true,
        s if s.eq_ignore_ascii_case("n") || s.eq_ignore_ascii_case("no") => false,
        _ => default_yes,
    })
}

fn print_summary(outcome: &Outcome) {
    println!("\n──────────────────");
    if !outcome.removed.is_empty() {
        println!("{}", t(Msg::UninstallRemoved));
        for p in &outcome.removed {
            println!("  {}", p.display());
        }
    }
    if !outcome.kept.is_empty() {
        println!("{}", t(Msg::UninstallKeptHint));
        for p in &outcome.kept {
            println!("  {}", p.display());
        }
    }
    if !outcome.failed.is_empty() {
        println!("{}", t(Msg::UninstallFailed));
        for (p, e) in &outcome.failed {
            println!("  {}  ({})", p.display(), e);
        }
    }
    if !outcome.backups.is_empty() {
        println!("{}", t(Msg::UninstallBackups));
        for p in &outcome.backups {
            println!("  {}", p.display());
        }
    }
}

fn build_context(plan: &super::scan::Plan) -> anyhow::Result<ExecuteContext> {
    // `mut` is only used by the `#[cfg(unix)]` branch below — Windows
    // builds compile this as a never-mutated `Vec`. Suppress the lint
    // there rather than duplicate the let with cfg gates.
    #[cfg_attr(not(unix), allow(unused_mut))]
    let mut rc_files = Vec::new();
    #[cfg(unix)]
    {
        let prefix = plan
            .binary_path
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        let rc = super::paths::unix_rc_paths();
        for path in [rc.zshrc, rc.bashrc] {
            if path.exists() {
                rc_files.push((path, prefix.clone()));
            }
        }
    }
    let _ = plan; // suppress unused-var warning on non-unix builds
    let ctx = ExecuteContext {
        rc_files,
        #[cfg(windows)]
        windows_install_dir_literal: plan
            .binary_path
            .parent()
            .map(|p| p.to_string_lossy().into_owned()),
        #[cfg(windows)]
        windows_install_dir_expanded: plan
            .binary_path
            .parent()
            .map(|p| p.to_string_lossy().into_owned()),
    };
    Ok(ctx)
}

#[cfg(test)]
mod resolve_tests {
    use super::*;

    fn args(preset: Preset) -> Args {
        Args {
            preset,
            yes: false,
            purge: false,
            keep_data: false,
            dry_run: false,
        }
    }

    #[test]
    fn simple_keeps_config_without_a_tty() {
        let mode = resolve_uninstall(&args(Preset::Simple), false).unwrap();
        assert_eq!(mode, DecisionMode::Ready(Decisions::KEEP_DATA));
    }

    #[test]
    fn all_removes_config_without_a_tty() {
        let mode = resolve_uninstall(&args(Preset::All), false).unwrap();
        assert_eq!(mode, DecisionMode::Ready(Decisions::PURGE));
    }

    #[test]
    fn interactive_needs_a_tty() {
        assert_eq!(
            resolve_uninstall(&args(Preset::Interactive), false),
            Err(Reject::NoTty)
        );
        assert_eq!(
            resolve_uninstall(&args(Preset::Interactive), true).unwrap(),
            DecisionMode::Interactive
        );
    }

    #[test]
    fn flags_still_choose_a_plan_without_a_tty() {
        let mut keep = args(Preset::Interactive);
        keep.keep_data = true;
        assert_eq!(
            resolve_uninstall(&keep, false).unwrap(),
            DecisionMode::Ready(Decisions::KEEP_DATA)
        );

        let mut purge = args(Preset::Interactive);
        purge.purge = true;
        assert_eq!(
            resolve_uninstall(&purge, false).unwrap(),
            DecisionMode::Ready(Decisions::PURGE)
        );

        let mut yes = args(Preset::Interactive);
        yes.yes = true;
        assert_eq!(
            resolve_uninstall(&yes, false).unwrap(),
            DecisionMode::Ready(Decisions::DEFAULTS)
        );

        let mut dry = args(Preset::Interactive);
        dry.dry_run = true;
        assert_eq!(
            resolve_uninstall(&dry, false).unwrap(),
            DecisionMode::Ready(Decisions::DEFAULTS)
        );
    }

    #[test]
    fn conflicting_options_are_rejected() {
        let mut both = args(Preset::Interactive);
        both.purge = true;
        both.keep_data = true;
        assert_eq!(resolve_uninstall(&both, true), Err(Reject::Conflict));

        let mut simple_purge = args(Preset::Simple);
        simple_purge.purge = true;
        assert_eq!(
            resolve_uninstall(&simple_purge, false),
            Err(Reject::Conflict)
        );

        let mut all_keep = args(Preset::All);
        all_keep.keep_data = true;
        assert_eq!(resolve_uninstall(&all_keep, false), Err(Reject::Conflict));
    }
}
