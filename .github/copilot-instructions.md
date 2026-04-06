# Project Guidelines — Key Magic

Windows-first keyboard control toolkit: shortcut blocking, typing automation, local dashboard. Single-instance WinForms host + ASP.NET Core API + React SPA.

## Architecture

Four projects in `src/`:

| Project | Role |
|---------|------|
| `KeyMagic.Core` | Keyboard models, config persistence, Win32 interop, blocking & typing services |
| `KeyMagic.Service` | WinForms tray host + local ASP.NET Core API + static SPA hosting |
| `KeyMagic.Web` | React/TypeScript/Vite SPA — status, rules, typing, events, settings |
| `KeyMagic.Tester` | Standalone keyboard diagnostics tool (manual testing, not automated) |

Key runtime classes: `Program.cs` → `KeyMagicRuntime` → `WebDashboardHost` + `TrayIconManager`. Asset resolution via `FrontendAssetLocator` (published wwwroot → source wwwroot → dist → embedded resources).

See [docs/architecture.md](../docs/architecture.md) for keyboard pipeline, config semantics, and frontend modules.

## Code Style

### C# (.NET 10)

- Target: `net10.0-windows` — nullable enabled, implicit usings enabled, deterministic builds.
- `[STAThread]` required on entry point (WinForms STA threading).
- Controllers use `[ApiController]` + `[Route("api/[controller]")]`, return anonymous objects.
- Mutations require `X-Admin-Token` header validated by `DashboardMutationProtector`.
- `ConfigStore` returns cloned snapshots — never hold stale references across updates.
- Use `DateTime.UtcNow` for timestamps. Models include `.Clone()` for safe snapshotting.
- API listens on localhost only; CORS restricted to `localhost` and `127.0.0.1`.

### TypeScript / React

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
- Bun 1.3.11+ as package manager (not npm/yarn). Use `bun install`, `bun run build`.
- Path alias: `@/*` → `./src/*`.
- UI stack: shadcn/ui primitives, Tailwind CSS 4, Lucide React icons, Sonner toasts, next-themes.
- Functional components with hooks. Local `useState` per component — no global state library.
- API client in `src/app/api.ts` auto-refreshes admin token from `/api/status`.
- Feature code organized under `src/features/{status,rules,typing,events,settings}/`.

## Build and Test

```powershell
# Frontend
cd src/KeyMagic.Web
bun install
bun run build          # outputs to src/KeyMagic.Service/wwwroot

# Backend
dotnet build KeyMagic.sln

# Run the app
dotnet run --project src/KeyMagic.Service/KeyMagic.Service.csproj

# Dev frontend (proxies /api to localhost:5199)
cd src/KeyMagic.Web
bun run dev

# Release publish (single-file)
dotnet publish src/KeyMagic.Service/KeyMagic.Service.csproj --configuration Release --runtime win-x64 --self-contained /p:PublishSingleFile=true --output artifacts/release/service/win-x64
```

No automated test suite — validation relies on TypeScript strict compilation, `dotnet build`, and CI publish verification.

## Conventions

- Branch naming: `feature/...` or `hotfix/...`, PRs against `main`.
- PR labels control release notes: `enhancement`, `bug`, `documentation`, `security`, `dependencies`. Use `internal` or `skip-release-notes` to exclude.
- Merges to `main` produce validation builds (`MAJOR.MINOR.PATCH-ci.RUN_NUMBER`). Stable releases are manually promoted.
- Config stored at `%APPDATA%\KeyMagic\config.json`. Writes use temp-file-plus-replace for atomicity.
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for full PR and release workflow.
- See [DEPRECATIONS.md](../DEPRECATIONS.md) for the TypeScript `@/*` alias migration plan.

## Pitfalls

- **Frontend output path**: Vite must build to `src/KeyMagic.Service/wwwroot`. Changing this breaks asset resolution in the desktop host.
- **Dev proxy port**: `vite.config.ts` proxies `/api` to `http://localhost:5199`. If Kestrel port changes in `appsettings.json`, update the proxy manually.
- **Config clone semantics**: `ConfigStore` returns clones on every access. Holding a reference then calling `Update()` won't reflect changes — re-fetch after mutations.
- **Single-file publish**: Assets embed via `ManifestEmbeddedFileProvider`. CI validates with `scripts/assert-portable-publish-assets.ps1`.
- **Admin token lifecycle**: Token is session-scoped, not persisted. Fetched from `/api/status` on dashboard mount. Blocking that endpoint breaks the entire dashboard.
- **Icon generation**: `bun run build` includes `generate:icons` step. Missing icon assets won't fail the build but icons won't render.
- **Restore for publish**: Always `dotnet restore --runtime win-x64 /p:SelfContained=true` before publish to ensure runtime packs are available.
