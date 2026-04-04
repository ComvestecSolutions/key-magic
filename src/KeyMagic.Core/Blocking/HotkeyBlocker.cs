using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Models;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Blocking;

/// <summary>
/// Blocks keyboard shortcuts using <c>RegisterHotKey</c>.
///
/// <para><b>Why not WH_KEYBOARD_LL return 1?</b></para>
/// <para>
/// Returning non-zero from a low-level hook suppresses the keystroke from ALL
/// input mechanisms system-wide.  Background listeners like Cluely that use
/// Raw Input, their own LL hook, or <c>GetAsyncKeyState</c> will also lose
/// the event.  There is no way to suppress "only for one window" using LL hooks.
/// </para>
///
/// <para><b>How RegisterHotKey works:</b></para>
/// <para>
/// The Windows input pipeline processes keystrokes in this order:
/// </para>
/// <list type="number">
///   <item><c>WH_KEYBOARD_LL</c> hooks fire (Cluely sees the key here).</item>
///   <item>Raw Input (<c>WM_INPUT</c>) dispatched.</item>
///   <item><c>RegisterHotKey</c> table checked — if matched, keystroke consumed.</item>
///   <item><c>WM_KEYDOWN</c> dispatched to the focused window (skipped if step 3 matched).</item>
/// </list>
/// <para>
/// We use <c>SetWinEventHook(EVENT_SYSTEM_FOREGROUND)</c> to detect focus changes.
/// When a target app gains focus we register the matching hotkeys; when it loses
/// focus we unregister them.  All registration and unregistration happens on the
/// <b>UI thread</b> to avoid Win32 thread-affinity issues with <c>RegisterHotKey</c>.
/// Background threads (e.g. the web API) signal the UI thread via <c>PostMessage</c>.
/// </para>
/// </summary>
public class HotkeyBlocker : IDisposable
{
    // ─── RegisterHotKey Modifier Constants ─────────────────────────
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_WIN = 0x0008;
    private const uint MOD_NOREPEAT = 0x4000;

    // ─── WinEvent / Message Constants ──────────────────────────────
    private const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    private const uint WINEVENT_OUTOFCONTEXT = 0x0000;
    private const int WM_HOTKEY = 0x0312;
    private const uint WM_APP_REFRESH = 0x8001; // WM_APP + 1

    // ─── SendInput constants ───────────────────────────────────────
    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    // ─── P/Invoke ──────────────────────────────────────────────────
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    private delegate void WinEventDelegate(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWinEventHook(
        uint eventMin, uint eventMax, IntPtr hmodWinEventProc,
        WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    // Explicit layout matching Win32 64-bit INPUT exactly (40 bytes).
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    private struct INPUT
    {
        [FieldOffset(0)] public int type;
        [FieldOffset(8)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    // ─── Fields ────────────────────────────────────────────────────
    private readonly ConfigStore _configStore;
    private readonly ILogger<HotkeyBlocker>? _logger;
    private BlockerWindow? _window;
    private IntPtr _winEventHook;
    private readonly WinEventDelegate _winEventDelegate; // prevent GC
    private readonly Dictionary<(uint mods, int vk), int> _registeredCombos = new();
    // Reverse map: hotkey ID → (mods, vk) for verifying hotkeys in WM_HOTKEY handler
    private readonly Dictionary<int, (uint mods, int vk)> _idToCombo = new();
    private int _nextHotkeyId = 1;
    private bool _disposed;

    // Safety-net timer: periodic refresh catches missed events & failed registrations
    private System.Windows.Forms.Timer? _safetyTimer;
    private const int SAFETY_TIMER_INTERVAL_MS = 250;

    // Foreground process cache for HotkeyBlocker (avoids transient UnregisterAll)
    private IntPtr _lastKnownFgHwnd;
    private string _lastKnownProcessName = string.Empty;

    public HotkeyBlocker(ConfigStore configStore, ILogger<HotkeyBlocker>? logger = null)
    {
        _configStore = configStore;
        _logger = logger;
        _winEventDelegate = OnWinEvent;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Lifecycle — must be called from the UI thread
    // ═══════════════════════════════════════════════════════════════

    public void Start()
    {
        // Create a lightweight window on the UI thread.
        // This window serves two purposes:
        //   1. Target HWND for RegisterHotKey / UnregisterHotKey
        //   2. Receives WM_APP_REFRESH posts from background threads
        _window = new BlockerWindow(this) { OnRefreshRequested = RefreshHotkeys };
        _window.CreateHandle(new CreateParams());

        // Monitor foreground window changes.  WINEVENT_OUTOFCONTEXT
        // means the callback fires on the thread that installed the hook
        // (i.e. the UI thread), so RefreshHotkeys runs on the correct thread.
        _winEventHook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND,
            IntPtr.Zero, _winEventDelegate,
            0, 0, WINEVENT_OUTOFCONTEXT);

        // React to config/rule changes from the web dashboard.
        _configStore.ConfigChanged += OnConfigChanged;

        // Safety-net timer: catches missed WinEvents, failed RegisterHotKey
        // calls, and any other desync between registrations and foreground state.
        _safetyTimer = new System.Windows.Forms.Timer { Interval = SAFETY_TIMER_INTERVAL_MS };
        _safetyTimer.Tick += (_, _) => RefreshHotkeys();
        _safetyTimer.Start();

        // Register hotkeys for whatever app is currently focused.
        RefreshHotkeys();
    }

    public void Stop()
    {
        _configStore.ConfigChanged -= OnConfigChanged;

        _safetyTimer?.Stop();
        _safetyTimer?.Dispose();
        _safetyTimer = null;

        UnregisterAll();

        if (_winEventHook != IntPtr.Zero)
        {
            UnhookWinEvent(_winEventHook);
            _winEventHook = IntPtr.Zero;
        }

        _window?.DestroyHandle();
        _window = null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Core — always runs on the UI thread
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Re-evaluates blocking rules against the current foreground window
    /// and (un)registers hotkeys accordingly.
    /// <para>This method MUST be called on the UI thread.</para>
    /// <para>
    /// Uses an <b>incremental diff</b> strategy: only hotkeys that are no
    /// longer needed are unregistered, and only new hotkeys are registered.
    /// Hotkeys that are still valid are left in place so there is never a
    /// gap where a keystroke could slip through to the target application.
    /// </para>
    /// </summary>
    public void RefreshHotkeys()
    {
        // Take a thread-safe snapshot so the web-API thread can't mutate
        // the rules list while we iterate it.
        var (globalEnabled, rules, _) = _configStore.GetBlockingSnapshot();

        if (!globalEnabled || _window == null)
        {
            UnregisterAll();
            return;
        }

        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero)
        {
            // No foreground window — keep existing state rather than
            // dropping all registrations (transient desktop focus, lock
            // screen, etc.).  The safety timer will fix it shortly.
            return;
        }

        string processName = GetProcessName(hwnd);
        if (string.IsNullOrEmpty(processName))
        {
            // Transient failure (process exited between PID lookup and
            // OpenProcess).  Re-use the cached name if the HWND hasn't
            // changed to avoid dropping all hotkeys on a flicker.
            if (hwnd == _lastKnownFgHwnd && !string.IsNullOrEmpty(_lastKnownProcessName))
            {
                processName = _lastKnownProcessName;
            }
            else
            {
                // Genuinely unknown — unregister to be safe.
                UnregisterAll();
                return;
            }
        }
        else
        {
            _lastKnownFgHwnd = hwnd;
            _lastKnownProcessName = processName;
        }

        // ── Build the set of combos needed for the current context ──
        var neededCombos = new HashSet<(uint mods, int vk)>();
        foreach (var rule in rules)
        {
            if (!rule.Enabled) continue;
            if (!IsProcessTargeted(rule, processName)) continue;

            uint modifiers = MOD_NOREPEAT;
            if (rule.Shortcut.Ctrl) modifiers |= MOD_CONTROL;
            if (rule.Shortcut.Alt) modifiers |= MOD_ALT;
            if (rule.Shortcut.Shift) modifiers |= MOD_SHIFT;
            if (rule.Shortcut.Win) modifiers |= MOD_WIN;

            neededCombos.Add((modifiers, rule.Shortcut.VirtualKeyCode));
        }

        // ── Unregister combos that are no longer needed ─────────────
        var toRemove = new List<(uint mods, int vk)>();
        foreach (var combo in _registeredCombos.Keys)
        {
            if (!neededCombos.Contains(combo))
                toRemove.Add(combo);
        }
        foreach (var combo in toRemove)
        {
            UnregisterHotKey(_window.Handle, _registeredCombos[combo]);
            _idToCombo.Remove(_registeredCombos[combo]);
            _registeredCombos.Remove(combo);
        }

        // ── Register new combos (existing ones stay in place) ───────
        foreach (var combo in neededCombos)
        {
            if (_registeredCombos.ContainsKey(combo))
                continue; // already registered — no gap

            int id = _nextHotkeyId++;
            if (RegisterHotKey(_window.Handle, id, combo.mods, (uint)combo.vk))
            {
                _registeredCombos[combo] = id;
                _idToCombo[id] = combo;
            }
            // If RegisterHotKey fails (e.g. another app holds the same
            // combo), we don't add it to _registeredCombos.  The safety
            // timer will retry on the next tick (every 250ms).
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Event handlers
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// SetWinEventHook callback.  Fires on the UI thread because we used
    /// <c>WINEVENT_OUTOFCONTEXT</c> and installed from the UI thread.
    /// </summary>
    private void OnWinEvent(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime)
    {
        // Already on the UI thread — call directly.
        RefreshHotkeys();
    }

    /// <summary>
    /// ConfigChanged fires on the web API background thread.
    /// We must NOT call RegisterHotKey/UnregisterHotKey from here because
    /// those are thread-affine.  Instead, post a custom message to our
    /// window which will be processed on the UI thread.
    /// </summary>
    private void OnConfigChanged(KeyMagicConfig config)
    {
        if (_window != null && _window.Handle != IntPtr.Zero)
            PostMessage(_window.Handle, WM_APP_REFRESH, IntPtr.Zero, IntPtr.Zero);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════

    private void UnregisterAll()
    {
        if (_window != null)
        {
            foreach (var id in _registeredCombos.Values)
                UnregisterHotKey(_window.Handle, id);
        }
        _registeredCombos.Clear();
        _idToCombo.Clear();
    }

    private static bool IsProcessTargeted(BlockingRule rule, string processName)
    {
        if (rule.TargetProcesses.Count == 0)
            return true;

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

    private string GetProcessName(IntPtr hwnd)
    {
        try
        {
            GetWindowThreadProcessId(hwnd, out uint pid);
            using var proc = Process.GetProcessById((int)pid);
            return proc.ProcessName;
        }
        catch (Exception ex)
        {
            _logger?.LogDebug(ex, "Could not get process name for window handle");
            return string.Empty;
        }
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            Stop();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }

    ~HotkeyBlocker() => Dispose();

    // ═══════════════════════════════════════════════════════════════
    //  Foreground verification for WM_HOTKEY
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Called from WM_HOTKEY to verify that the current foreground process
    /// is actually targeted by a rule matching this hotkey.  If not, the
    /// key is re-injected so the non-targeted app receives it.
    /// </summary>
    private void OnHotkeyMessage(int hotkeyId)
    {
        // Decode the combo that fired.
        if (!_idToCombo.TryGetValue(hotkeyId, out var combo))
            return; // unknown ID — consume silently

        // Check current foreground process.
        var hwnd = GetForegroundWindow();
        string processName = (hwnd != IntPtr.Zero) ? GetProcessName(hwnd) : string.Empty;
        if (string.IsNullOrEmpty(processName) && hwnd == _lastKnownFgHwnd)
            processName = _lastKnownProcessName;

        // Snapshot current rules.
        var (globalEnabled, rules, _) = _configStore.GetBlockingSnapshot();

        if (!globalEnabled)
        {
            ReInjectHotkey(combo);
            RefreshHotkeys();
            return;
        }

        // Is any enabled rule targeting this combo + this process?
        bool shouldBlock = false;
        foreach (var rule in rules)
        {
            if (!rule.Enabled) continue;

            uint mods = MOD_NOREPEAT;
            if (rule.Shortcut.Ctrl) mods |= MOD_CONTROL;
            if (rule.Shortcut.Alt) mods |= MOD_ALT;
            if (rule.Shortcut.Shift) mods |= MOD_SHIFT;
            if (rule.Shortcut.Win) mods |= MOD_WIN;

            if (mods == combo.mods && rule.Shortcut.VirtualKeyCode == combo.vk)
            {
                if (IsProcessTargeted(rule, processName))
                {
                    shouldBlock = true;
                    break;
                }
            }
        }

        if (!shouldBlock)
        {
            // The foreground app changed but unregistration hasn't happened
            // yet — re-inject the key so the non-targeted app receives it,
            // then fix registrations.
            ReInjectHotkey(combo);
            RefreshHotkeys();
        }
        // else: rightfully blocked — consume (do nothing).
    }

    /// <summary>
    /// Re-injects a hotkey combo into the input stream using <c>SendInput</c>
    /// so that a falsely-consumed keystroke reaches the intended application.
    /// </summary>
    private static void ReInjectHotkey((uint mods, int vk) combo)
    {
        var inputs = new List<INPUT>();

        // Press modifiers
        if ((combo.mods & MOD_CONTROL) != 0)
            inputs.Add(MakeKeyInput(0xA2, 0));           // VK_LCONTROL down
        if ((combo.mods & MOD_ALT) != 0)
            inputs.Add(MakeKeyInput(0xA4, 0));           // VK_LMENU down
        if ((combo.mods & MOD_SHIFT) != 0)
            inputs.Add(MakeKeyInput(0xA0, 0));           // VK_LSHIFT down
        if ((combo.mods & MOD_WIN) != 0)
            inputs.Add(MakeKeyInput(0x5B, 0));           // VK_LWIN down

        // Press + release the main key
        inputs.Add(MakeKeyInput((ushort)combo.vk, 0));
        inputs.Add(MakeKeyInput((ushort)combo.vk, KEYEVENTF_KEYUP));

        // Release modifiers (reverse order)
        if ((combo.mods & MOD_WIN) != 0)
            inputs.Add(MakeKeyInput(0x5B, KEYEVENTF_KEYUP));
        if ((combo.mods & MOD_SHIFT) != 0)
            inputs.Add(MakeKeyInput(0xA0, KEYEVENTF_KEYUP));
        if ((combo.mods & MOD_ALT) != 0)
            inputs.Add(MakeKeyInput(0xA4, KEYEVENTF_KEYUP));
        if ((combo.mods & MOD_CONTROL) != 0)
            inputs.Add(MakeKeyInput(0xA2, KEYEVENTF_KEYUP));

        if (inputs.Count > 0)
        {
            var arr = inputs.ToArray();
            SendInput((uint)arr.Length, arr, Marshal.SizeOf<INPUT>());
        }
    }

    private static INPUT MakeKeyInput(ushort vk, uint flags)
    {
        return new INPUT
        {
            type = INPUT_KEYBOARD,
            ki = new KEYBDINPUT
            {
                wVk = vk,
                wScan = 0,
                dwFlags = flags,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  Window that receives WM_HOTKEY + cross-thread refresh signals
    // ═══════════════════════════════════════════════════════════════
    private sealed class BlockerWindow : NativeWindow
    {
        private readonly HotkeyBlocker _owner;
        public Action? OnRefreshRequested;

        public BlockerWindow(HotkeyBlocker owner)
        {
            _owner = owner;
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY)
            {
                // Verify the foreground process is actually targeted before
                // consuming.  If it isn't (focus changed but unregistration
                // hasn't caught up), re-inject the keystroke.
                _owner.OnHotkeyMessage((int)m.WParam);
                return;
            }

            if (m.Msg == (int)WM_APP_REFRESH)
            {
                // Cross-thread signal from ConfigChanged → refresh on UI thread.
                OnRefreshRequested?.Invoke();
                return;
            }

            base.WndProc(ref m);
        }
    }
}
