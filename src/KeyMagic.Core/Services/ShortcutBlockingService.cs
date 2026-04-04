using System.Collections.Concurrent;
using KeyMagic.Core.Blocking;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Hooks;
using KeyMagic.Core.Models;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Services;

/// <summary>
/// Core service that manages shortcut blocking.
///
/// <para><b>Architecture:</b></para>
/// <list type="bullet">
///   <item>
///     <b>LowLevelKeyboardHook</b> — monitoring only.  Fires
///     <c>KeyIntercepted</c> for every keystroke so the dashboard can show
///     real-time events.  The hook <b>never</b> suppresses keystrokes.
///   </item>
///   <item>
///     <b>HotkeyBlocker</b> — actual blocking.  Uses <c>RegisterHotKey</c>
///     to consume matched shortcuts before they reach the target application.
///     LL hooks (including third-party hooks like Cluely's) fire <b>before</b>
///     <c>RegisterHotKey</c> processing, so they always see every key.
///   </item>
/// </list>
/// </summary>
public class ShortcutBlockingService : IDisposable
{
    private readonly ConfigStore _configStore;
    private readonly LowLevelKeyboardHook _hook;
    private readonly HotkeyBlocker _hotkeyBlocker;
    private readonly ConcurrentQueue<ShortcutEvent> _eventLog = new();
    private readonly object _eventLogLock = new();
    private readonly Action<KeyMagicConfig> _onConfigChanged;
    private IReadOnlyList<ShortcutEvent> _eventLogSnapshot = Array.Empty<ShortcutEvent>();
    private int _eventLogVersion;
    private int _eventLogSnapshotVersion = -1;
    private bool _disposed;

    /// <summary>Fired whenever a shortcut event (blocked or passed) occurs.</summary>
    public event Action<ShortcutEvent>? ShortcutEventOccurred;

    /// <summary>Current event log (most recent first).</summary>
    public IReadOnlyList<ShortcutEvent> EventLog
    {
        get
        {
            lock (_eventLogLock)
            {
                if (_eventLogSnapshotVersion == _eventLogVersion)
                {
                    return _eventLogSnapshot;
                }

                var snapshot = _eventLog.ToArray();
                Array.Reverse(snapshot);
                _eventLogSnapshot = Array.AsReadOnly(snapshot);
                _eventLogSnapshotVersion = _eventLogVersion;
                return _eventLogSnapshot;
            }
        }
    }

    /// <summary>Is the hook currently installed?</summary>
    public bool IsRunning => _hook.IsHooked;

    public ShortcutBlockingService(ConfigStore configStore, ILoggerFactory? loggerFactory = null)
    {
        _configStore = configStore;

        // ── Monitoring hook (never blocks) ─────────────────────────
        _hook = new LowLevelKeyboardHook(loggerFactory?.CreateLogger<LowLevelKeyboardHook>());
        _hook.InterceptSingleKeys = configStore.Config.AllowSingleKeyBlocking;
        _hook.KeyIntercepted += OnKeyIntercepted;

        // ── Blocking via RegisterHotKey ─────────────────────────
        _hotkeyBlocker = new HotkeyBlocker(configStore, loggerFactory?.CreateLogger<HotkeyBlocker>());

        // React to config changes (store delegate so we can unsubscribe)
        _onConfigChanged = cfg =>
        {
            _hook.InterceptSingleKeys = cfg.AllowSingleKeyBlocking;
        };
        _configStore.ConfigChanged += _onConfigChanged;
    }

    /// <summary>Starts the monitoring hook and the hotkey blocker.</summary>
    public void Start()
    {
        if (!_hook.IsHooked)
            _hook.Install();
        _hotkeyBlocker.Start();
    }

    /// <summary>Stops the monitoring hook and the hotkey blocker.</summary>
    public void Stop()
    {
        _hotkeyBlocker.Stop();
        _hook.Uninstall();
    }

    /// <summary>Clears the event log.</summary>
    public void ClearLog()
    {
        lock (_eventLogLock)
        {
            var cleared = false;
            while (_eventLog.TryDequeue(out _))
            {
                cleared = true;
            }

            if (cleared)
            {
                _eventLogVersion++;
                _eventLogSnapshotVersion = -1;
            }
        }
    }

    /// <summary>
    /// Hook callback : decides whether to block the shortcut based on configured rules.
    /// Returns true to block, false to pass through.
    /// </summary>
    private bool OnKeyIntercepted(int vkCode, bool ctrl, bool alt, bool shift, bool win,
        string processName, string windowTitle)
    {
        // Take a thread-safe snapshot so the web-API thread can't mutate
        // the rules list while we iterate.
        var (globalEnabled, rules, logPassThrough) = _configStore.GetBlockingSnapshot();

        // Master toggle check
        if (!globalEnabled)
            return false;

        // Check each enabled rule
        foreach (var rule in rules)
        {
            if (!rule.Enabled) continue;

            // Check if the shortcut matches
            if (!rule.Shortcut.Matches(vkCode, ctrl, alt, shift, win))
                continue;

            // Check if the process is targeted
            bool isTargeted = IsProcessTargeted(rule, processName);
            if (!isTargeted) continue;

            // Match found : block it
            var evt = new ShortcutEvent
            {
                Timestamp = DateTime.UtcNow,
                ShortcutDisplay = rule.Shortcut.ToString(),
                ProcessName = processName,
                WindowTitle = windowTitle,
                WasBlocked = true,
                RuleId = rule.Id
            };

            LogEvent(evt);
            return true; // Block
        }

        // Log pass-through for any shortcut combo (or single key if enabled)
        // Note: use snapshot-based check to avoid racing with web-API config updates.
        if (logPassThrough && (ctrl || alt || shift || win))
        {
            var tempKey = new Models.ShortcutKey { VirtualKeyCode = vkCode };
            var keyName = tempKey.ToString().Split('+').Last().Trim();
            var parts = new List<string>();
            if (ctrl) parts.Add("Ctrl");
            if (alt) parts.Add("Alt");
            if (shift) parts.Add("Shift");
            if (win) parts.Add("Win");
            parts.Add(keyName);

            var evt = new ShortcutEvent
            {
                Timestamp = DateTime.UtcNow,
                ShortcutDisplay = string.Join("+", parts),
                ProcessName = processName,
                WindowTitle = windowTitle,
                WasBlocked = false,
                RuleId = string.Empty
            };

            LogEvent(evt);
        }

        return false; // Pass through
    }

    private static bool IsProcessTargeted(BlockingRule rule, string processName)
    {
        // Empty target list = global (all applications)
        if (rule.TargetProcesses.Count == 0)
            return true;

        // Match by process name (case-insensitive, strip .exe extension from both sides)
        return rule.TargetProcesses.Any(target =>
            string.Equals(
                StripExeExtension(target),
                StripExeExtension(processName),
                StringComparison.OrdinalIgnoreCase));
    }

    private static string StripExeExtension(string name)
    {
        return name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
            ? name[..^4]
            : name;
    }

    private void LogEvent(ShortcutEvent evt)
    {
        lock (_eventLogLock)
        {
            _eventLog.Enqueue(evt);

            var max = _configStore.Config.MaxLogEntries;
            while (_eventLog.Count > max)
                _eventLog.TryDequeue(out _);

            _eventLogVersion++;
            _eventLogSnapshotVersion = -1;
        }

        ShortcutEventOccurred?.Invoke(evt);
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            Stop();
            _configStore.ConfigChanged -= _onConfigChanged;
            _hook.KeyIntercepted -= OnKeyIntercepted;
            _hotkeyBlocker.Dispose();
            _hook.Dispose();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }

    ~ShortcutBlockingService() => Dispose();
}
