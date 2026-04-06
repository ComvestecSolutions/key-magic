# Pull Request

## Summary

- What changed?
- Why does it matter?

## Validation

- [ ] `bun run build` if frontend code changed
- [ ] `dotnet build KeyMagic.sln --configuration Release` if .NET code changed
- [ ] Release or packaging changes were validated when relevant

## Release Notes

- Add one public-facing label when this PR should appear in release notes: `enhancement`, `bug`, `documentation`, `security`, or `dependencies`.
- Use `skip-release-notes` when the PR should be excluded from the public stable release notes.
- Call out breaking behavior, release pipeline changes, or keyboard-hook behavior changes in the PR body.

## Checklist

- [ ] Docs updated in `README.md` and `docs/*` if user-facing or release behavior changed
- [ ] No unrelated refactors mixed into this PR
