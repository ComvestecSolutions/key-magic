# Key Magic

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ComvestecSolutions/key-magic?utm_source=oss&utm_medium=github&utm_campaign=ComvestecSolutions%2Fkey-magic&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

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

## Stable release

- `v0.1.1` is the current stable patch release of Key Magic.
- `v0.1.0` remains the first public stable release baseline.
- Stable downloads live on the [GitHub Releases](https://github.com/ComvestecSolutions/key-magic/releases) page for this repository.
- The shipped asset set is a portable self-contained single-file `win-x64` executable, `KeyMagic.exe`, plus `KeyMagic.exe.sha256` for verification.
- The app stores configuration at `%APPDATA%\KeyMagic\config.json` and exposes the local dashboard on `http://localhost:5199` by default.
- There is no installer, MSIX package, or remote service dependency in the current release line.

## Documentation

- [Install and verify the release](docs/install.md)
- [Get started with blocking and typing rules](docs/getting-started.md)
- [Troubleshoot runtime or setup issues](docs/troubleshooting.md)
- [Understand the release process](docs/releases.md)
- [Review the runtime architecture](docs/architecture.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Repository layout

```text
.
|-- KeyMagic.sln
|-- Directory.Build.props
|-- CHANGELOG.md
|-- docs/
|   |-- architecture.md
|   |-- getting-started.md
|   |-- install.md
|   |-- releases.md
|   `-- troubleshooting.md
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

### Create and test the local single-file release build

```powershell
dotnet restore KeyMagic.sln --runtime win-x64 /p:SelfContained=true
dotnet publish src/KeyMagic.Service/KeyMagic.Service.csproj --configuration Release --runtime win-x64 --self-contained --output artifacts/release/service/win-x64 /p:Version=0.1.1 /p:PublishSingleFile=true
```

After that publish finishes, test the portable executable at `artifacts/release/service/win-x64/KeyMagic.exe`.

## Release model

The repository uses a GitHub-flow release model.

- Feature work happens on short-lived branches such as `feature/...` and `hotfix/...`.
- The validation pipeline runs only on pull requests targeting `main`.
- A merge commit landing on `main` triggers the internal mainline release-validation pipeline.
- The merged-main workflow rebuilds the merged commit, publishes internal workflow artifacts, and does not create a public GitHub prerelease.
- The current version metadata points at `0.1.1` as the active release line for merged-main validation builds and the latest stable public tag.
- Stable public releases are promoted manually from a validated commit on `main`, so a clean tag such as `v0.1.1` points at a previously verified mainline build.
- When you run the manual `Stable Release` workflow, enter `stable_version` without the `v` prefix. The workflow publishes the GitHub tag with the prefix added.
- Stable release notes are auto-generated from pull request labels unless `release_notes_path` supplies a curated markdown body. The current patch release uses `.github/release-notes/v0.1.1.md`, while `v0.1.0` used the first stable baseline note.

Current stable release outputs:

- Portable self-contained single-file Windows build for the main app.
- Runnable `.exe`-only portable release asset. The release path is intentionally not an installer workflow.
- Embedded KeyMagic icon and dashboard assets bundled into `KeyMagic.exe`.
- `KeyMagic.exe` plus a published SHA-256 checksum file attached to stable GitHub releases.
- GitHub provenance attestations for release artifacts when the repository supports artifact attestations.
- The tester remains in the repository for development validation but is not part of the shipped stable asset set.

See `docs/releases.md` for the full branch, validation, artifact, signing, and stable-release procedure.

## Notes

- See `DEPRECATIONS.md` for the current KeyMagic.Web plan to remove the `src/KeyMagic.Web/tsconfig.json` `compilerOptions.ignoreDeprecations` escape hatch.
- Some Windows-reserved shortcuts cannot be intercepted from user mode.
- Blocking remains a local machine capability; there is no remote service dependency.
- The release workflow assumes `main` is protected so only reviewed pull requests can merge and trigger merged-main validation builds.
- The intended release format is a portable self-contained single-file Windows executable, not an installable package.
- Checksums are published with release assets, provenance attestations are emitted for supported repositories, and Authenticode signing is supported when the required signing secrets are configured.
- Use `scripts/set-github-signing-secrets.ps1` or the commands in `docs/releases.md` to populate the signing secrets in GitHub Actions.
- If you only need a local test certificate for workflow validation, generate one with `scripts/new-test-code-signing-cert.ps1` before setting the secrets.
- Public users should only see stable downloads on the GitHub Releases page; merged-main builds remain validation artifacts rather than public releases.
- The SPA build output path is part of the release contract. Keep `src/KeyMagic.Service/wwwroot` aligned with the Vite build output unless you also update asset resolution and release automation.
- `v0.1.1` adds startup diagnostics at `%APPDATA%\KeyMagic\logs\startup.log` and allows the tray app to continue launching even if the local dashboard cannot initialize for that session.

Additional project guidance lives in `CONTRIBUTING.md` and `SECURITY.md`.

---

## License

MIT. See [LICENSE](LICENSE) for details.
