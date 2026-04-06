# Releases

## Current stable baseline

- `v0.1.0` is the first public stable Key Magic release.
- Public GitHub downloads currently ship `KeyMagic.exe` and `KeyMagic.exe.sha256`.
- The stable asset target is a portable, self-contained single-file `win-x64` executable.
- `KeyMagic.Tester` remains in the repository for diagnostics and is not part of the shipped stable asset set.

## Branch model

- `main` is the protected integration and release branch.
- Feature branches should use names such as `feature/*` or `hotfix/*` and target `main` through pull requests.
- Only pull requests targeting `main` run the validation pipeline.
- Only merged commits that land on `main` run the mainline release-validation pipeline.
- Stable public downloads are created only by the manual `Stable Release` workflow.

## Versioning

- Versions are centralized in `Directory.Build.props`.
- Use Semantic Versioning.
- `VersionPrefix` defines the active release line for merged-main validation builds and future stable tags.
- Merge-driven mainline validation builds use the internal version form `MAJOR.MINOR.PATCH-ci.RUN_NUMBER`.
- Stable releases use a clean SemVer tag such as `v0.1.0` without the `-ci.RUN_NUMBER` suffix.
- Coordinate any `VersionPrefix` changes with changelog, release notes, and workflow expectations before starting a new stable release line.

## Stable artifact contract

- The shipped stable asset set is `KeyMagic.exe` plus `KeyMagic.exe.sha256`.
- The repository does not currently ship an installer, MSIX package, or setup bootstrapper.
- The released executable embeds the KeyMagic icon and dashboard assets directly into the single-file app. No separate `wwwroot`, `KeyMagic.ico`, or runtime sidecars are shipped in the stable release output.
- CI and release validation treat the single-file publish layout as contract by failing if the service publish directory contains anything other than `KeyMagic.exe` before the checksum file is generated.
- The frontend output path is part of that contract. `bun run build` must continue to write to `src/KeyMagic.Service/wwwroot` unless you also update asset resolution and release automation.
- `FrontendAssetLocator` resolves assets from published `wwwroot`, then local `src/KeyMagic.Service/wwwroot`, then `src/KeyMagic.Web/dist`. Changing those assumptions requires coordinated code and documentation updates.

## Release readiness checklist

1. Confirm `main` remains protected and that pull requests carry the release-note labels expected by `.github/release.yml`.
2. Confirm `Directory.Build.props` carries the intended base version for the release line you are promoting.
3. Update `CHANGELOG.md`, `README.md`, and any user-facing docs when shipped behavior or packaging changes.
4. If you want curated release notes, update the markdown file you plan to pass as `release_notes_path`, such as `.github/release-notes/v0.1.0.md`.
5. If frontend or asset-hosting behavior changed, run `bun run build` and verify the SPA still lands in `src/KeyMagic.Service/wwwroot`.
6. If release packaging changed, run the local restore, build, and publish validation steps with `--runtime win-x64 /p:SelfContained=true`.
7. Decide whether the public release should ship unsigned or whether Authenticode signing secrets must be configured before promotion.
8. Identify the validated `main` commit you want to promote and keep its workflow run, artifacts, and smoke-test notes available for final verification.

## GitHub tags and release entries

- Merged `main` builds do not create public GitHub releases or public prerelease tags.
- The repository creates public GitHub release tags only during the manual stable release workflow.
- The `stable_version` workflow input is entered without the `v` prefix, for example `0.1.1`, and the workflow publishes the tag as `v0.1.1`.
- Stable GitHub release bodies are generated automatically from merged pull requests and categorized by the labels configured in `.github/release.yml` unless an override file is supplied.
- The `Stable Release` workflow also accepts an optional `release_notes_path` input when you want to publish a fully curated release body from a markdown file in the selected commit.

## CI

The CI workflow runs only on pull requests targeting `main`. It:

1. Installs frontend dependencies with Bun.
2. Builds the React SPA with Bun and Vite.
3. Restores the .NET 10 solution with `--runtime win-x64 /p:SelfContained=true` so runtime packs are available for publish.
4. Builds the release configuration of the solution.
5. Publishes the main app as a self-contained `win-x64` single-file executable.
6. Runs a single-file assertion that fails CI if the publish directory contains anything other than `KeyMagic.exe`.
7. Keeps the dashboard bundled into the executable by serving embedded `wwwroot` assets in release builds.
8. Uploads the published `KeyMagic.exe` as the workflow artifact.

## Mainline release validation workflow

The mainline release-validation workflow runs when a merged commit lands on `main`. It:

1. Reads the base semantic version from `Directory.Build.props`.
2. Creates a unique internal validation version in the form `MAJOR.MINOR.PATCH-ci.RUN_NUMBER`.
3. Verifies that the pushed `main` commit is associated with a merged pull request into `main` and derives release metadata from that PR.
4. Runs with repository-wide read permissions and grants only the attestation permissions needed for validation artifacts.
5. Restores, builds, and publishes the Windows artifacts from the exact `main` commit with Bun and .NET 10.
6. Produces `KeyMagic.exe` as a self-contained single-file portable executable with the KeyMagic application icon and dashboard assets embedded.
7. Optionally Authenticode-signs `KeyMagic.exe` when the signing certificate secrets are configured.
8. Generates a SHA-256 checksum file for `KeyMagic.exe` after signing.
9. Uploads the published `KeyMagic.exe` and `KeyMagic.exe.sha256` as internal workflow artifacts.
10. Creates a GitHub provenance attestation for the release artifacts when the repository supports GitHub artifact attestations.
11. Does not create a public GitHub release.

This gives every merge to `main` a traceable release candidate without making that build a public download on the GitHub Releases page.

The intended sequence is:

1. Complete work on a feature branch and open a pull request to `main`.
2. Let CI validate the pull request.
3. Merge to `main`.
4. Let the mainline validation workflow rebuild the merge commit and publish the internal workflow artifacts.
5. Validate that build before treating the commit as a promotion candidate.

## Selecting `source_sha` for a stable release

1. Find the merged-main validation run for the commit you want to promote from `main`.
2. Confirm that the run completed successfully and published `KeyMagic.exe` and `KeyMagic.exe.sha256`.
3. Confirm the commit came from a merged pull request and that any required smoke tests passed.
4. Use that exact commit SHA as the `source_sha` input to the `Stable Release` workflow.
5. If you plan to pass `release_notes_path`, confirm the markdown file exists in that same commit.

## Stable release promotion

Stable releases are created manually from a validated commit on `main` by running the `Stable Release` workflow.

That workflow:

1. Accepts a validated commit SHA from `main` plus a stable version such as `0.1.1`.
2. Verifies that the commit exists and is reachable from `main`.
3. Verifies that the target stable tag does not already exist.
4. Optionally validates a `release_notes_path` markdown file in that exact commit when you want to override the generated release body.
5. Checks out that exact commit.
6. Rebuilds and republishes the single-file `KeyMagic.exe` artifact from that commit.
7. Optionally Authenticode-signs `KeyMagic.exe` when the signing certificate secrets are configured.
8. Generates `KeyMagic.exe.sha256` for download verification.
9. Creates a GitHub provenance attestation for the promoted artifacts when the repository supports GitHub artifact attestations.
10. Generates the release notes from merged pull requests since the previous stable tag, using `.github/release.yml` to group or exclude entries by default.
11. Publishes the markdown file at `release_notes_path` as the full release body instead when an override is supplied. That file must exist in the selected commit.
12. Creates a stable GitHub release with a clean SemVer tag such as `v0.1.1`.

`v0.1.0` was published as the first stable baseline using `stable_version: 0.1.0`, and the curated release body lives at `.github/release-notes/v0.1.0.md`.

## Post-release verification

1. Confirm the new tag and GitHub release exist and that the release is marked as the latest stable download.
2. Download `KeyMagic.exe` and `KeyMagic.exe.sha256` from the release page and compare the published checksum with a local `Get-FileHash` result.
3. Confirm the executable is Authenticode-signed when signing secrets were configured for the release.
4. Confirm the GitHub provenance attestation is present when the repository supports artifact attestations.
5. Confirm `README.md`, `CHANGELOG.md`, and any curated release-note file describe the shipped artifact set and support posture accurately.

## Release notes

- Stable release notes are generated by GitHub during the `Stable Release` workflow instead of being written by hand in the workflow file.
- The `Stable Release` workflow can fully override that generated body with an optional `release_notes_path` markdown file from the selected commit.
- Pull requests labeled `enhancement`, `bug`, `documentation`, or `security` are grouped into the matching sections defined in `.github/release.yml`, while `dependencies` is grouped under `Maintenance`.
- Pull requests labeled `internal` or `skip-release-notes` are excluded from the generated public release notes.
- Pull requests without a matching label still appear under the catch-all `Other Changes` section so merged work is not silently dropped from a release.
- `v0.1.0` used `.github/release-notes/v0.1.0.md` as the curated baseline note. Future stable releases can either rely on the generated body or use the same override pattern.

## Local release testing

To build the same single-file app locally before using the `Stable Release` workflow, run:

```powershell
cd src/KeyMagic.Web
bun install
bun run build

cd ../..
dotnet restore KeyMagic.sln --runtime win-x64 /p:SelfContained=true
dotnet publish src/KeyMagic.Service/KeyMagic.Service.csproj --configuration Release --runtime win-x64 --self-contained --output artifacts/release/service/win-x64 /p:Version=0.1.0 /p:PublishSingleFile=true
```

If you are validating a future stable line, replace `/p:Version=0.1.0` with the version you intend to promote.

The resulting local portable executable is:

- `artifacts/release/service/win-x64/KeyMagic.exe`

This is the local path to test when you want to confirm the portable single-file app works before producing a public stable GitHub release.

## Signing and provenance configuration

- Authenticode signing is supported by both release workflows when `WINDOWS_SIGNING_CERT_BASE64` and `WINDOWS_SIGNING_CERT_PASSWORD` are configured as repository secrets.
- `WINDOWS_SIGNING_TIMESTAMP_URL` is optional. If omitted, the workflows default to `http://timestamp.digicert.com`.
- The workflows still succeed when signing secrets are absent, but the published executable remains unsigned.
- Self-signed or privately rooted certificates can sign the executable successfully while GitHub-hosted runners still report the chain as untrusted. The signing script now treats that as a warning when the executable contains a signer certificate, but production releases should still use a publicly trusted code-signing certificate.
- GitHub provenance attestations are created with `actions/attest@v4` for public repositories. Private repositories need a plan that supports artifact attestations before those steps will run successfully.

### Setting signing secrets

Add the secrets in GitHub under `Repository Settings > Secrets and variables > Actions`.

Expected values:

- `WINDOWS_SIGNING_CERT_BASE64`: a single-line Base64 encoding of the complete `.pfx` file. This is not a PEM block and should not include headers such as `-----BEGIN CERTIFICATE-----`.
- `WINDOWS_SIGNING_CERT_PASSWORD`: the password used to open or export the `.pfx` file.
- `WINDOWS_SIGNING_TIMESTAMP_URL`: optional timestamp server URL. The workflows default to `http://timestamp.digicert.com` if this secret is omitted.

The sample path shown below is a placeholder. Replace it with the real location of your exported `.pfx` file.

If you do not have a certificate yet and only want to validate the workflow mechanics, generate a local test certificate first:

```powershell
./scripts/new-test-code-signing-cert.ps1 -OutputPath 'C:\temp\keymagic-test-signing-cert.pfx' -Password 'replace-with-a-strong-test-password'
```

That produces a self-signed test certificate for local or private validation. It is not a production-trusted public signing certificate.

Copy-paste PowerShell using GitHub CLI:

```powershell
$Repo = 'ComvestecSolutions/key-magic'
$PfxPath = 'C:\path\to\your\keymagic-signing-cert.pfx'
$PfxPassword = 'replace-with-your-pfx-password'
$TimestampUrl = 'http://timestamp.digicert.com'

$CertificateBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PfxPath))
$CertificateBase64 | gh secret set WINDOWS_SIGNING_CERT_BASE64 --repo $Repo
$PfxPassword | gh secret set WINDOWS_SIGNING_CERT_PASSWORD --repo $Repo
$TimestampUrl | gh secret set WINDOWS_SIGNING_TIMESTAMP_URL --repo $Repo
```

Repository helper script:

```powershell
./scripts/set-github-signing-secrets.ps1 -PrintOnly

./scripts/set-github-signing-secrets.ps1 -Repo 'ComvestecSolutions/key-magic' -PfxPath 'C:\path\to\your\keymagic-signing-cert.pfx' -PfxPassword 'replace-with-your-pfx-password'
```

## Current artifact set

CI workflow artifacts:

- `keymagic-win-x64-exe`

Within those artifacts:

- `keymagic-win-x64-exe` contains the single-file `KeyMagic.exe` release candidate.

Mainline validation workflow artifacts:

- `artifacts/release/service/win-x64/KeyMagic.exe`
- `artifacts/release/service/win-x64/KeyMagic.exe.sha256`

GitHub release attachments:

- `KeyMagic.exe`
- `KeyMagic.exe.sha256`

GitHub provenance records:

- Release workflows create provenance attestations for `KeyMagic.exe` and `KeyMagic.exe.sha256` when GitHub artifact attestations are available for the repository.

## Packaging strategy

- The intended stable release format is a portable, self-contained single-file Windows executable.
- The repository does not currently ship an installer, MSIX package, or setup bootstrapper.
- `KeyMagic.Tester.exe` is not part of the shipped stable asset set.
- Public users download stable releases from the GitHub Releases page. Merged-main validation builds stay as workflow artifacts.
- Installable packaging should be treated as a separate product decision, not as the default next step for the current release pipeline.

## Open-source release hardening

The current pipeline already covers the baseline for a production-stable release flow:

- semantic version metadata is centralized,
- pull requests are validated before merge,
- releases are rebuilt from `main`,
- public downloads are restricted to stable releases,
- release workflows support Authenticode signing when certificate secrets are configured,
- SHA-256 checksums are published with release assets,
- GitHub provenance attestations can be emitted for release artifacts,
- repository contribution and security policies are documented,
- stable tags can be promoted manually from a validated `main` commit,
- and the shipped artifact contract is explicit and test-enforced.

The main hardening gaps still worth closing after `v0.1.0` are:

- provision and rotate a production Authenticode certificate so release signing is consistently active in GitHub,
- and consider adding an SBOM alongside provenance if you want package inventory in addition to build provenance.
