# Releases

## Branch model

No commit or release history exists yet in this repository. The workflow files define the intended branch and release model once the initial tracked history is created and the first release is prepared.

- main is the protected integration and release branch.
- Feature branches should use names such as `feature/*` or `hotfix/*` and target main through pull requests.
- Only pull requests targeting main run the validation pipeline.
- Only merged commits that land on main run the release pipeline.
- Release automation creates a prerelease build and GitHub prerelease for each merged main commit.

## First planned release

- The current version metadata is set to 0.1.0 in Directory.Build.props.
- The first automated merge-driven prerelease will therefore use the form v0.1.0-ci.RUN_NUMBER unless scope changes enough to justify a different base version before release work begins.
- Each release is built from the merged main commit after the pull request workflow has already validated the incoming branch.
- Until a separately approved stable release process is introduced, the automated workflows should be treated as prerelease preparation and validation rather than long-term version history.

## Versioning

- Versions are centralized in Directory.Build.props.
- Use Semantic Versioning.
- Merge-driven prereleases use the format vMAJOR.MINOR.PATCH-ci.RUN_NUMBER.
- The current baseline version in the repo is the planned starting version, not a previously published stable release record.

## CI

The CI workflow runs only on pull requests targeting main. It:

1. Installs frontend dependencies with Bun.
2. Builds the React SPA with Bun and Vite.
3. Restores and builds the .NET 10 solution.
4. Publishes self-contained service and tester artifacts for Windows.
5. Uploads build artifacts, including the generated service web root, for inspection.

## Release workflow

The release workflow runs when a merged commit lands on main. It:

1. Reads the base semantic version from Directory.Build.props.
2. Creates a unique prerelease version in the form MAJOR.MINOR.PATCH-ci.RUN_NUMBER.
3. Verifies that the main commit is associated with a merged pull request into main.
4. Builds and publishes the Windows artifacts from the exact main commit with Bun and .NET 10.
5. Publishes a GitHub prerelease with zipped portable bundles attached.

This gives every merge to main a traceable release candidate without forcing the repository to treat each merge as the latest stable release.

For the current automated release path, the intended sequence is:

1. Complete work on a feature branch and open a pull request to main.
2. Let CI validate the pull request.
3. Merge to main.
4. Let the release workflow rebuild the merge commit and publish the prerelease artifacts.
5. Validate the prerelease before treating it as a promotion candidate.

## Current artifact set

- KeyMagic-win-x64-portable.zip
- KeyMagic.Tester-win-x64.zip
- Raw published service directory
- Raw published tester directory

## MSIX note

MSIX packaging is not wired yet because the repository does not currently include a Windows packaging project or signing setup. The existing PR-validation and merge-release pipelines are structured so an MSIX packaging step can be added later without changing the branch or promotion model.
