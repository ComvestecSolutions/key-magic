# Deprecation Plan

## KeyMagic.Web TypeScript pre-6.0 deprecation escape hatch

- Escape hatch in use: `src/KeyMagic.Web/tsconfig.json` sets `compilerOptions.ignoreDeprecations` to `"6.0"` as a pre-6.0 deprecation escape hatch, which silences TypeScript 5.x deprecation diagnostics for options scheduled for removal in TypeScript 6.0.
- Current dependency under review: the frontend alias setup around `compilerOptions.baseUrl` and `compilerOptions.paths` for `@/*` imports still depends on that `compilerOptions.ignoreDeprecations` suppression. The same alias is mirrored in `src/KeyMagic.Web/vite.config.ts`.
- Affected frontend modules: `src/KeyMagic.Web/src/app/App.tsx`, `src/KeyMagic.Web/src/features/rules/BlockingRulesPanel.tsx`, and shared UI/component imports throughout `src/KeyMagic.Web/src/**` that currently resolve through `@/*`.
- Risk and impact: TypeScript 6 deprecation warnings are currently suppressed, which keeps the existing Bun/Vite workflow stable, but a future TypeScript release could remove the deprecated alias path and break editor resolution or `bun run build`.

## Removal timeline

1. During the next frontend toolchain cleanup, inventory all `@/*` imports under `src/KeyMagic.Web/src/**` and choose the replacement strategy in one pass.
2. Until that migration lands, do not add new deprecated compiler options or expand the alias usage beyond the current frontend surface area.
3. In the same PR that migrates alias resolution, remove `compilerOptions.ignoreDeprecations`, validate `bun run build`, and confirm the .NET service still serves the built dashboard assets.
