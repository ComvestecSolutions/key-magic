# Changelog

This file documents the current Key Magic repository baseline.

It currently summarizes the shipped project baseline rather than acting as a complete tagged-release ledger.

## [Current Baseline]

### Included

- Key Magic branding, centralized version metadata, and .NET 10 / Bun toolchain setup.
- Dual-path keyboard handling with low-level monitoring plus foreground-aware `RegisterHotKey` blocking.
- Typing automation with fixed-text or clipboard-driven rules and Unicode `SendInput` injection.
- Modular service hosting layer for the tray app, localhost API, and bundled web dashboard.
- Local dashboard mutation protection via per-run `X-Admin-Token` headers.
- React, TypeScript, and Vite single-page application for status, rules, typing, events, and settings.
- GitHub Actions workflows for pull-request validation and merged-main self-contained `win-x64` prereleases.
- Windows service and tester projects that build as KeyMagic and KeyMagic.Tester.
- Local configuration stored atomically at `%APPDATA%\KeyMagic\config.json`.
