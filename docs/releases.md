# Releases

## Branch model

No commit or release history exists yet in this repository. The workflow files define the intended branch and release model once the initial tracked history is created and the first release is prepared.

- main is the protected integration and release branch.
- Feature branches should use names such as feature/* or hotfix/* and target main through pull requests.
- Every push to main creates a prerelease build and GitHub prerelease for validation.
- Stable semantic version tags should be created from validated commits on main.

## First planned release

- The current version metadata is set to 0.1.0 in Directory.Build.props.
- The first planned tagged release is therefore v0.1.0 unless scope changes enough to justify a different starting version before release work begins.
- That first stable release should be cut only after the baseline is committed, merged to main, validated through the mainline prerelease artifacts, and tagged from that validated main commit.
- Until v0.1.0 exists, the workflows and version values should be treated as release preparation, not release history.

## Versioning

- Versions are centralized in Directory.Build.props.
- Use Semantic Versioning.
- Release tags should use the format vMAJOR.MINOR.PATCH.
- The current baseline version in the repo is the planned starting version, not a previously published release record.

## CI

The CI workflow runs on pushes to main, feature/*, and hotfix/* branches, plus pull requests targeting main. It:

1. Installs frontend dependencies.
2. Builds the React SPA.
3. Restores and builds the .NET solution.
4. Publishes self-contained service and tester artifacts for Windows.
5. Uploads build artifacts, including the generated service web root, for inspection.

## Continuous prerelease workflow

The continuous release workflow runs on every push to main. It:

1. Reads the base semantic version from Directory.Build.props.
2. Creates a unique prerelease version in the form MAJOR.MINOR.PATCH-ci.RUN_NUMBER.
3. Builds and publishes the Windows artifacts from the exact main commit.
4. Publishes a GitHub prerelease with zipped portable bundles attached.

This gives every merge to main a traceable release candidate without forcing the repository to treat every merge as the latest stable release.

## Release workflow

The stable release workflow runs on version tags. It:

1. Validates that the pushed tag matches the version declared in Directory.Build.props.
2. Builds the SPA.
3. Restores, builds, and publishes self-contained Windows binaries.
4. Creates portable zip bundles for the main app and tester.
5. Attaches those artifacts to a GitHub release with generated notes.

For the first planned release, the intended path is:

1. Complete work on a feature branch and open a pull request to main.
2. Let CI validate the branch and pull request.
3. Merge to main and validate the generated prerelease artifacts.
4. Create tag v0.1.0 from that validated main commit.
5. Let the stable release workflow publish the first portable artifacts from that tag.

## Current artifact set

- KeyMagic-win-x64-portable.zip
- KeyMagic.Tester-win-x64.zip
- Raw published service directory
- Raw published tester directory

## MSIX note

MSIX packaging is not wired yet because the repository does not currently include a Windows packaging project or signing setup. The existing CI and release pipelines are structured so an MSIX packaging step can be added later without changing the branch or promotion model.
