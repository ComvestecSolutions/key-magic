# Key Magic

Key Magic is a Windows-first keyboard control toolkit for teams and power users who need more than a simple shortcut blocker. It solves two practical problems:

1. Stop destructive or distracting shortcuts from reaching the wrong application.
2. Trigger repeatable text actions from the keyboard without relying on heavyweight automation software.

The app runs locally, stores configuration in the user's profile, exposes a local dashboard, and keeps the keyboard engine in native .NET code where the Windows-specific behavior belongs.

## Problem and solution

Modern Windows workflows are crowded with global shortcuts, app-specific overlays, and repetitive text entry. A single accidental shortcut can close tabs, launch assistants, or interrupt focused work. At the same time, many teams want lightweight text automation for support replies, code snippets, or standardized responses.

Key Magic addresses both sides of that problem:

- Block shortcuts globally or only inside specific processes.
- Preserve keyboard observability with a low-level monitoring hook.
- Trigger fixed-text or clipboard-driven typing rules from hotkeys.
- Manage everything through a local tray app and modular single-page dashboard.

## Current architecture

- `KeyMagic.Core`: keyboard models, config persistence, process discovery, blocking, and typing services.
- `KeyMagic.Service`: WinForms tray host plus local ASP.NET Core API and dashboard hosting.
- `KeyMagic.Web`: React, TypeScript, and Vite SPA for status, rules, typing, events, and settings.
- `KeyMagic.Tester`: standalone Windows tester for keyboard diagnostics.

The service now uses a thinner startup layer:

- `Program.cs` keeps only single-instance bootstrapping.
- `KeyMagicRuntime` composes the desktop services.
- `WebDashboardHost` owns API and static asset startup.
- `FrontendAssetLocator` resolves the published SPA and local development build output.

## Key capabilities

- OS-level shortcut blocking with process-aware targeting.
- Typing automation from fixed text or clipboard content.
- Local dashboard with runtime metrics, rule editing, event log, and settings.
- JSON configuration stored at `%APPDATA%\KeyMagic\config.json`.
- Self-contained Windows publish output for portable release artifacts.

## Repository layout

```text
.
|-- KeyMagic.sln
|-- Directory.Build.props
|-- CHANGELOG.md
|-- docs/
|   |-- architecture.md
|   `-- releases.md
`-- src/
    |-- KeyMagic.Core/
    |-- KeyMagic.Service/
    |-- KeyMagic.Tester/
    `-- KeyMagic.Web/
```

## Local development

### Prerequisites

- .NET 10 SDK
- Bun 1.3.11+
- Windows 10 or Windows 11

The repository pins the .NET SDK with `global.json` and the frontend package manager with `src/KeyMagic.Web/package.json`.

### Build the SPA

```powershell
cd src/KeyMagic.Web
bun install
bun run build
```

### Build the desktop host

```powershell
dotnet build KeyMagic.sln
```

The SPA build writes directly into `src/KeyMagic.Service/wwwroot`, which the desktop host serves locally and includes in publish output.

### Run the main app

```powershell
dotnet run --project src/KeyMagic.Service/KeyMagic.Service.csproj
```

### Run the tester

```powershell
dotnet run --project src/KeyMagic.Tester/KeyMagic.Tester.csproj
```

## Release flow

The repository is set up for a GitHub-flow release model.

- Feature work happens on short-lived branches such as `feature/...` and `hotfix/...`.
- The validation pipeline runs only on pull requests targeting `main`.
- A merge commit landing on `main` triggers the release pipeline.
- The release pipeline rebuilds the merged commit, publishes the Windows artifacts, and creates a GitHub prerelease in the form `vMAJOR.MINOR.PATCH-ci.RUN_NUMBER`.
- The current version metadata points at `0.1.0` as the base semantic version for merge-driven prereleases.

Current release outputs:

- Portable self-contained Windows build for the main app.
- Portable self-contained Windows build for the tester.
- Zipped release bundles attached to GitHub releases.

See `docs/releases.md` for the full branch, validation, and prerelease artifact model.

## Notes

- Some Windows-reserved shortcuts cannot be intercepted from user mode.
- Blocking remains a local machine capability; there is no remote service dependency.
- The release workflow assumes `main` is protected so only reviewed pull requests can merge and trigger prereleases.
- The current release workflows do not produce MSIX yet because the repository does not include a packaging project or signing configuration.
- This repository currently has no recorded commit, tag, or release history. The changelog starts from the present project baseline.

---

## License

MIT. See [LICENSE](LICENSE) for details.
