# Changelog

This file documents public stable Key Magic releases. Internal merged-main validation builds use `MAJOR.MINOR.PATCH-ci.RUN_NUMBER` and remain workflow artifacts rather than changelog entries.

## [0.1.1] - 2026-04-06

### Fixed

- Portable release builds now include the embedded file manifest required for the bundled dashboard to start correctly when `KeyMagic.exe` is run outside the source tree or from a downloaded GitHub artifact.
- Frontend asset resolution now fails soft and records embedded asset provider failures instead of aborting startup in release scenarios.
- Startup diagnostics now capture bootstrap progress and fatal startup exceptions in `%APPDATA%\KeyMagic\logs\startup.log`.

### Changed

- Key Magic can continue launching the tray host when the local dashboard is unavailable for the current session, with the failure recorded in the startup log.
- Release workflows now use Node 24-compatible `actions/github-script@v8`.

## [0.1.0] - 2026-04-06

### Added

- Process-aware shortcut blocking with global or targeted rules for Windows applications.
- Low-level keyboard monitoring, recent event history, and tray-hosted runtime visibility.
- Hotkey-driven typing automation with fixed-text and clipboard-backed macros using Unicode `SendInput`.
- Local dashboard for status, rules, typing actions, event inspection, and settings.
- Atomic JSON configuration stored at `%APPDATA%\KeyMagic\config.json`.

### Release

- First public stable Key Magic release published as a portable, self-contained single-file `win-x64` executable.
- Stable release assets include `KeyMagic.exe` and `KeyMagic.exe.sha256`.
- Release automation supports optional Authenticode signing and GitHub provenance attestations.
- `KeyMagic.Tester` remains in the repository for diagnostics and manual validation but is not part of the shipped stable asset set.

### Tooling

- .NET 10 and Bun-based build toolchain with pull-request validation, merged-main validation artifacts, and manual stable-release promotion from validated `main` commits.
