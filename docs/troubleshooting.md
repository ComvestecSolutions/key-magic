# Troubleshooting Key Magic

## Dashboard does not open

- Confirm `KeyMagic.exe` is still running and that the tray icon is visible.
- Browse to `http://localhost:5199` directly. If the port was changed, inspect `%APPDATA%\KeyMagic\config.json` for `webDashboardPort`.
- The dashboard is local-only. Open it from the same machine where Key Magic is running.
- If another process already uses the configured port, stop Key Magic, choose a free port in config or settings, and then start the app again.

## A shortcut rule does not block

- Protection must be resumed. Check the tray menu or status view for the current global state.
- Confirm the rule itself is enabled.
- If the rule targets specific processes, the intended application must be the foreground process and its process name must match the configured scope.
- Some Windows-reserved shortcuts cannot be intercepted from user mode.
- If the status view shows the hook reconnecting or inactive, restart Key Magic and test again.

## A typing macro does not fire

- Confirm the typing rule is enabled.
- Make sure the macro hotkey is not already consumed by a blocking rule or another application.
- If the macro uses clipboard content, verify that the clipboard currently contains the expected text.
- Test the macro in a simple text editor before assuming the target app is compatible.

## Checksum verification fails

- Ensure you downloaded the matching pair of files: `KeyMagic.exe` and `KeyMagic.exe.sha256`.
- Hash the exact `KeyMagic.exe` file you plan to run.
- Compare the local SHA-256 value against the first token in `KeyMagic.exe.sha256`.
- If the hash still differs, discard both files and download them again from the GitHub Releases page.

## Need to reset local configuration

- Exit Key Magic from the tray menu before editing files.
- Back up `%APPDATA%\KeyMagic\config.json` if you want to keep the current settings.
- Delete `%APPDATA%\KeyMagic\config.json` and optionally `%APPDATA%\KeyMagic\config.json.bak`.
- Start `KeyMagic.exe` again to regenerate the default configuration.

## Cannot replace or delete KeyMagic.exe

- Exit the running tray app before copying, replacing, or deleting the executable.
- If the file still appears locked, end any remaining Key Magic processes or restart Windows and try again.
- Updating the executable does not remove your config unless you delete the config file separately.

## Local build or publish fails because files are locked

- A running Key Magic instance can lock `src/KeyMagic.Service/bin/Debug/net10.0-windows/KeyMagic.dll` or `KeyMagic.exe`.
- Stop the app before running `dotnet build` or `dotnet publish`.
- If you need to keep an existing instance running, validate with a custom `OutDir` instead of the default output path.
