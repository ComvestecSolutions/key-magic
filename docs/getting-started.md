# Get Started With Key Magic

Key Magic is ready to run as soon as `KeyMagic.exe` is launched, but a new install starts with protection paused and no rules configured. The fastest safe rollout is to add one blocking rule, test it, and then expand from there.

## 1. Open the dashboard

- Launch `KeyMagic.exe`.
- Use the tray icon to open the dashboard, or browse to `http://localhost:5199`.
- On the status view, confirm the app is responding and note whether protection is paused or live.

## 2. Create your first blocking rule

1. Go to the blocking-rules workspace.
2. Add the shortcut that causes the most confusion or risk in your workflow.
3. If the shortcut is only a problem in one app, scope the rule to that process instead of blocking it everywhere.
4. Save the rule and leave it enabled.

## 3. Resume protection and test safely

- Protection is paused on a new configuration, so resume protection from the dashboard or tray menu after adding a rule.
- Test the shortcut in a safe window before rolling it into a production workflow.
- If the rule is process-targeted, make sure the intended application is the foreground process when testing.
- Some Windows-reserved shortcuts cannot be intercepted from user mode.

## 4. Create your first typing macro

1. Open the typing workspace.
2. Choose whether the macro inserts fixed text or the current clipboard content.
3. Assign a hotkey and a descriptive name.
4. Test it in a plain text field such as Notepad before relying on it in other tools.

## 5. Review recent activity

- Open the events view to confirm blocked and pass-through activity for the current running session.
- Use the status overview to see active rule counts, hook health, and the dashboard port.
- If event volume grows too large, adjust retention settings instead of depending on long-lived in-memory history.

## 6. Tune startup and runtime settings

- Use settings to control notifications, startup behavior, retention, tray visibility, and the dashboard port.
- `Start with Windows` and `Start enabled` are separate controls. Keep them manual until you are confident the rules behave as expected on the device.
- Export or import configuration when you need to carry an approved setup between machines.

## Rollout tips

- Prefer process-targeted rules over broad global rules when possible.
- Add one change at a time and retest before enabling more shortcuts.
- Keep typing macros on distinct hotkeys so they do not compete with blocking rules or application shortcuts.
- Revisit `troubleshooting.md` if protection stays paused, the dashboard does not load, or expected events do not appear.
