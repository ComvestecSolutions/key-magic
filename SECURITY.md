# Security Policy

## Supported versions

Key Magic currently supports the latest stable `0.1.x` release line.

| Version                                            | Supported                                |
| -------------------------------------------------- | ---------------------------------------- |
| `0.1.x` stable releases                            | Yes                                      |
| Merged-main validation builds such as `0.1.0-ci.*` | Best effort, short-lived validation only |
| Older stable release lines                         | No                                       |
| Unreleased feature or hotfix branches              | No                                       |

If you report a security issue against a validation build, reproduce it on the latest stable release when possible. Validation artifacts are useful for release preparation, but they are not long-term supported public downloads.

## Reporting a vulnerability

Please avoid opening a public issue for a suspected security problem.

Use one of these private channels instead:

- GitHub private vulnerability reporting for this repository, if it is enabled.
- Direct contact with the repository owners through GitHub if private reporting is not available.

When reporting, include:

- affected stable version, or validated main commit SHA if you were testing an internal validation artifact,
- operating system details,
- reproduction steps,
- impact assessment,
- and any proof-of-concept material needed to verify the issue.

We will try to acknowledge valid reports promptly and coordinate disclosure after a fix or mitigation is available.
