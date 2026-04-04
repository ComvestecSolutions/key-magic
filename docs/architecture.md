# Architecture

## Goal

Key Magic exists to solve two related workflow problems on Windows:

1. Prevent destructive or distracting shortcuts from reaching the wrong app.
2. Trigger repeatable text actions without relying on heavyweight desktop automation suites.

The application stays local-first. All keyboard interception, rule storage, and typing automation happen on the user's machine.

## Runtime shape

- KeyMagic.Core contains Windows-specific keyboard models, config persistence, blocking, process discovery, and typing services.
- KeyMagic.Service is the desktop host. It owns the WinForms tray lifetime and starts the local ASP.NET Core API and web dashboard.
- KeyMagic.Web is the React and TypeScript SPA served by the desktop host.
- KeyMagic.Tester is a separate Windows utility for validating keyboard behavior outside the full service.

## Maintainability decisions

- Program.cs now stays thin and delegates composition to KeyMagicRuntime.
- Web dashboard startup is isolated in WebDashboardHost.
- Frontend asset resolution is centralized in FrontendAssetLocator.
- The SPA is organized by feature area instead of a single HTML file.

## Frontend modules

- status: runtime health and high-level metrics.
- rules: blocking rule creation and management.
- typing: text automation rule creation and triggering.
- events: event stream inspection.
- settings: operational preferences and retention controls.

## Build flow

1. npm build writes the SPA output into src/KeyMagic.Service/wwwroot.
2. The desktop host serves generated source wwwroot assets during local development and published wwwroot assets after build or publish.
3. dotnet build and dotnet publish include the current wwwroot contents without a separate asset-copy step.
4. dotnet publish produces a self-contained Windows executable bundle.
