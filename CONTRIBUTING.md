# Contributing

Thanks for contributing to Key Magic.

## Workflow

- Create changes on a short-lived branch such as `feature/...` or `hotfix/...`.
- Open pull requests against `main`.
- Keep pull requests focused so release notes and review history stay readable.
- Ensure frontend and .NET changes build locally before requesting review.

## Local validation

Use the same baseline checks that the repository relies on in CI:

```powershell
cd src/KeyMagic.Web
bun install
bun run build

cd ../..
dotnet restore KeyMagic.sln --runtime win-x64 /p:SelfContained=true
dotnet build KeyMagic.sln --configuration Release
```

If you touch release packaging, validate the publish output as well:

```powershell
dotnet publish src/KeyMagic.Service/KeyMagic.Service.csproj --configuration Release --runtime win-x64 --self-contained --output artifacts/release/service/win-x64 /p:Version=0.1.0 /p:PublishSingleFile=true
```

The expected local release output is a single `KeyMagic.exe` file at `artifacts/release/service/win-x64/KeyMagic.exe`.

## Pull requests

- Describe the user-visible change and the reason for it.
- Call out release, packaging, or keyboard-hook behavior changes explicitly.
- Add a release-note label when the change should appear in GitHub release notes. Use `enhancement` for new user-visible features, `bug` for fixes, `documentation` for docs-only changes, `security` for security-relevant hardening, and `dependencies` for dependency or toolchain updates.
- Use `internal` or `skip-release-notes` when maintainers want a pull request excluded from the public release notes.
- Update `README.md` and the relevant files under `docs/` when release behavior, workflows, or user-facing features change.
- Do not include unrelated refactors in the same pull request.

## Release expectations

- The current stable baseline is `v0.1.0`.
- Merges to `main` create internal validation builds in the form `MAJOR.MINOR.PATCH-ci.RUN_NUMBER`.
- Stable releases are promoted manually from a validated commit on `main`.
- When running the Stable Release workflow, enter `stable_version` without the `v` prefix. Example: `0.1.0` publishes the tag `v0.1.0`.
- Stable GitHub release notes are auto-generated from merged pull requests and grouped by the labels configured in `.github/release.yml`.
- Shipped release assets currently contain `KeyMagic.exe` and `KeyMagic.exe.sha256`.
- Public-repository release runs also emit GitHub provenance attestations for the shipped artifacts.
- Authenticode signing is supported when the repository signing secrets are configured.
- If a pull request changes packaging, stable assets, or release inputs, update `docs/releases.md` and any impacted user guide before merge.

## Security

For suspected vulnerabilities, follow the reporting guidance in `SECURITY.md` instead of opening a public issue first.
