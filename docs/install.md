# Install Key Magic

Key Magic ships as a portable Windows desktop application. The current stable release line is `v0.1.0`.

## What ships in the stable release

- `KeyMagic.exe`: the self-contained `win-x64` desktop application.
- `KeyMagic.exe.sha256`: the SHA-256 checksum file for download verification.
- No installer, MSIX package, or separate `wwwroot` folder.
- Dashboard assets and the application icon are bundled inside the executable.

## Requirements

- Windows 10 or Windows 11.
- An x64 Windows environment aligned with the current `win-x64` release target.
- A local browser on the same machine to open the dashboard.

## Download and verify

1. Download `KeyMagic.exe` and `KeyMagic.exe.sha256` from the GitHub Releases page.
2. Place both files in a folder you control, such as a tools directory or managed deployment folder.
3. Open PowerShell in that folder and verify the checksum:

```powershell
$expected = (Get-Content .\KeyMagic.exe.sha256).Split(' ')[0]
$actual = (Get-FileHash .\KeyMagic.exe -Algorithm SHA256).Hash.ToLowerInvariant()

$actual
$expected
$actual -eq $expected
```

If the last line returns `True`, the downloaded executable matches the published checksum.

4. Run `KeyMagic.exe`.
5. Open the dashboard by double-clicking the tray icon, choosing `Open dashboard` from the tray menu, or browsing to `http://localhost:5199`.

## First-run behavior

- First launch creates `%APPDATA%\KeyMagic\config.json`.
- Protection starts paused by default.
- No blocking rules or typing macros exist until you create them.
- The tray icon is visible by default.
- The dashboard listens on `http://localhost:5199` unless `webDashboardPort` is changed later in settings or config.
- All keyboard handling and API requests stay on the local machine.

## Updating or removing Key Magic

- Exit the tray app before replacing `KeyMagic.exe` with a newer stable build.
- Replacing the executable keeps the existing configuration unless you also delete `%APPDATA%\KeyMagic\config.json`.
- To remove Key Magic completely, delete `KeyMagic.exe` and optionally delete `%APPDATA%\KeyMagic\config.json` if you want to clear local settings.
