using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Models;

namespace KeyMagic.Core.Services;

/// <summary>
/// Service that registers configurable hotkeys and types text into the focused
/// window when a hotkey fires.
///
/// <para><b>Text injection:</b> Uses <c>SendInput</c> with
/// <c>KEYEVENTF_UNICODE</c> so that any Unicode character is typed correctly,
/// regardless of the current keyboard layout or modifier-key state.</para>
///
/// <para><b>Threading:</b> Hotkey registration (<c>RegisterHotKey</c>) is
/// thread-affine to the Win32 message thread (the WinForms UI thread).
/// All registration / unregistration therefore happens inside the
/// <see cref="TypingWindow"/> message pump.  When the web API signals a config
/// change, it posts <c>WM_APP_REFRESH</c> to the window so the refresh is
/// performed on the correct thread.</para>
/// </summary>
public sealed class TypingService : IDisposable
{
    // ─── Register/Unregister modifier constants ────────────────────
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_WIN = 0x0008;
    private const uint MOD_NOREPEAT = 0x4000;

    // ─── Message constants ─────────────────────────────────────────
    private const int WM_HOTKEY = 0x0312;
    private const uint WM_APP_REFRESH = 0x8002; // WM_APP + 2
    private const uint WM_APP_TRIGGER = 0x8003; // WM_APP + 3

    // ─── SendInput constants ───────────────────────────────────────
    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;

    // ─── Starting hotkey ID (each window has its own ID space) ─────
    private const int HOTKEY_ID_BASE = 1;

    // ─── P/Invoke ──────────────────────────────────────────────────
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    // Win32 INPUT on 64-bit: DWORD type(4) + padding(4) + union(32) = 40 bytes.
    // The union must be at least as large as MOUSEINPUT (32 bytes).  We use an
    // explicit layout so Marshal.SizeOf<INPUT>() == 40, matching the cbSize that
    // SendInput requires.  Without this, SendInput receives a wrong cbSize and
    // injects nothing.
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    private struct INPUT
    {
        [FieldOffset(0)] public int type;
        // The union starts at offset 8 (4-byte DWORD + 4-byte padding for
        // 8-byte alignment required by ULONG_PTR inside the union members).
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
    private readonly Action<KeyMagicConfig> _onConfigChanged;

    // Window is created and owned by the WinForms UI thread.
    private TypingWindow? _window;

    // Registered combo → rule (for WM_HOTKEY dispatch).
    private readonly Dictionary<(uint mods, int vk), TypingRule> _registeredRules = new();
    // Hotkey ID → combo (for reverse lookup).
    private readonly Dictionary<int, (uint mods, int vk)> _idToCombo = new();
    // Combo → hotkey ID.
    private readonly Dictionary<(uint mods, int vk), int> _comboToId = new();

    private int _nextHotkeyId = HOTKEY_ID_BASE;
    private bool _disposed;

    // Cross-thread trigger queue (API → UI thread via WM_APP_TRIGGER).
    // tuple: text, interKeyDelayMs, preDelayMs
    private readonly ConcurrentQueue<(string text, int delayMs, int preDelayMs)> _pendingTriggers = new();

    private System.Windows.Forms.Timer? _safetyTimer;

    public TypingService(ConfigStore configStore)
    {
        _configStore = configStore;
        _onConfigChanged = _ => OnConfigChanged();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Lifecycle
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Starts the typing service.  Must be called on the WinForms UI thread.
    /// </summary>
    public void Start()
    {
        _window = new TypingWindow(this);
        _window.CreateHandle(new CreateParams());

        _configStore.ConfigChanged += _onConfigChanged;

        _safetyTimer = new System.Windows.Forms.Timer { Interval = 500 };
        _safetyTimer.Tick += (_, _) => RefreshHotkeys();
        _safetyTimer.Start();

        RefreshHotkeys();
    }

    /// <summary>
    /// Stops the typing service.  Must be called on the WinForms UI thread.
    /// </summary>
    public void Stop()
    {
        _configStore.ConfigChanged -= _onConfigChanged;

        _safetyTimer?.Stop();
        _safetyTimer?.Dispose();
        _safetyTimer = null;

        UnregisterAll();

        _window?.DestroyHandle();
        _window = null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Public API (callable from any thread)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Types <paramref name="text"/> into the currently focused window.
    /// Safe to call from any thread.
    /// </summary>
    /// <param name="text">Text to inject.</param>
    /// <param name="interKeyDelayMs">Milliseconds between keystrokes.</param>
    /// <param name="preDelayMs">
    /// Milliseconds to wait before the first keystroke.  Use a larger value
    /// (e.g. 2500) when the call originates from a UI button so the user has
    /// time to switch focus to the target application.
    /// </param>
    public void TriggerTyping(string text, int interKeyDelayMs = 30, int preDelayMs = 50)
    {
        if (string.IsNullOrEmpty(text)) return;

        _pendingTriggers.Enqueue((text, interKeyDelayMs, preDelayMs));

        if (_window != null && _window.Handle != IntPtr.Zero)
            PostMessage(_window.Handle, WM_APP_TRIGGER, IntPtr.Zero, IntPtr.Zero);
        else
            // Window not ready yet — fire directly from this thread.
            DispatchPendingTriggers();
    }

    // ═══════════════════════════════════════════════════════════════
    //  UI-thread core methods
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Re-evaluates TypingRules and (un)registers hotkeys to match.
    /// Must run on the UI thread.
    /// </summary>
    public void RefreshHotkeys()
    {
        if (_window == null) return;

        var config = _configStore.Config;
        var needed = new Dictionary<(uint mods, int vk), TypingRule>();

        // Take a snapshot so a concurrent web-API add/remove doesn't throw.
        foreach (var rule in config.TypingRules.ToList())
        {
            if (!rule.Enabled || rule.Hotkey.VirtualKeyCode == 0) continue;

            uint mods = MOD_NOREPEAT;
            if (rule.Hotkey.Ctrl) mods |= MOD_CONTROL;
            if (rule.Hotkey.Alt) mods |= MOD_ALT;
            if (rule.Hotkey.Shift) mods |= MOD_SHIFT;
            if (rule.Hotkey.Win) mods |= MOD_WIN;

            var combo = (mods, rule.Hotkey.VirtualKeyCode);
            // First matching rule wins if two rules share the same combo.
            if (!needed.ContainsKey(combo))
                needed[combo] = rule;
        }

        // ── Unregister combos that are no longer needed ─────────────
        var toRemove = _registeredRules.Keys.Where(c => !needed.ContainsKey(c)).ToList();
        foreach (var combo in toRemove)
        {
            if (_comboToId.TryGetValue(combo, out int id))
            {
                UnregisterHotKey(_window.Handle, id);
                _idToCombo.Remove(id);
                _comboToId.Remove(combo);
            }
            _registeredRules.Remove(combo);
        }

        // ── Register new combos; update rule references for existing ones ──
        foreach (var (combo, rule) in needed)
        {
            if (_registeredRules.ContainsKey(combo))
            {
                _registeredRules[combo] = rule; // rule payload may have changed
                continue;
            }

            int id = _nextHotkeyId++;
            if (RegisterHotKey(_window.Handle, id, combo.mods, (uint)combo.vk))
            {
                _registeredRules[combo] = rule;
                _idToCombo[id] = combo;
                _comboToId[combo] = id;
            }
            // If registration fails (e.g. another app already owns the combo),
            // the safety timer will retry on the next tick.
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WM_HOTKEY handler (UI thread)
    // ═══════════════════════════════════════════════════════════════

    private void OnHotkeyMessage(int hotkeyId)
    {
        if (!_idToCombo.TryGetValue(hotkeyId, out var combo)) return;
        if (!_registeredRules.TryGetValue(combo, out var rule)) return;

        string text;
        if (rule.Source == TextSource.Clipboard)
        {
            // We are on the STA / WinForms UI thread — safe to access Clipboard.
            try { text = Clipboard.GetText(); }
            catch { text = string.Empty; }
        }
        else
        {
            text = rule.Text ?? string.Empty;
        }

        if (string.IsNullOrEmpty(text)) return;

        var delay = rule.InterKeyDelayMs;
        var mods = combo.mods;

        Task.Run(async () =>
        {
            // Release held modifier keys so they don't interfere with the typed text.
            ReleaseModifiers(mods);

            // Brief pause to let the focused application process the key-up events.
            await Task.Delay(150);

            TypeText(text, delay);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  WM_APP_TRIGGER handler (dispatched to UI thread)
    // ═══════════════════════════════════════════════════════════════

    private void DispatchPendingTriggers()
    {
        while (_pendingTriggers.TryDequeue(out var job))
        {
            var (text, delay, preDelay) = job;
            Task.Run(async () =>
            {
                if (preDelay > 0)
                    await Task.Delay(preDelay);
                TypeText(text, delay);
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Config-change cross-thread signal
    // ═══════════════════════════════════════════════════════════════

    private void OnConfigChanged()
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
            foreach (var id in _comboToId.Values)
                UnregisterHotKey(_window.Handle, id);
        }
        _registeredRules.Clear();
        _idToCombo.Clear();
        _comboToId.Clear();
    }

    /// <summary>
    /// Sends key-up events for any modifier keys that were part of the
    /// hotkey combo, so they do not affect the subsequent typed text.
    /// </summary>
    private static void ReleaseModifiers(uint mods)
    {
        var inputs = new List<INPUT>();
        // Release both LEFT and RIGHT variants so physical key state never
        // bleeds into the typed characters.
        if ((mods & MOD_CONTROL) != 0)
        {
            inputs.Add(MakeVkInput(0xA2, KEYEVENTF_KEYUP)); // VK_LCONTROL
            inputs.Add(MakeVkInput(0xA3, KEYEVENTF_KEYUP)); // VK_RCONTROL
        }
        if ((mods & MOD_ALT) != 0)
        {
            inputs.Add(MakeVkInput(0xA4, KEYEVENTF_KEYUP)); // VK_LMENU
            inputs.Add(MakeVkInput(0xA5, KEYEVENTF_KEYUP)); // VK_RMENU
        }
        if ((mods & MOD_SHIFT) != 0)
        {
            inputs.Add(MakeVkInput(0xA0, KEYEVENTF_KEYUP)); // VK_LSHIFT
            inputs.Add(MakeVkInput(0xA1, KEYEVENTF_KEYUP)); // VK_RSHIFT
        }
        if ((mods & MOD_WIN) != 0)
        {
            inputs.Add(MakeVkInput(0x5B, KEYEVENTF_KEYUP)); // VK_LWIN
            inputs.Add(MakeVkInput(0x5C, KEYEVENTF_KEYUP)); // VK_RWIN
        }
        if (inputs.Count == 0) return;

        var arr = inputs.ToArray();
        SendInput((uint)arr.Length, arr, Marshal.SizeOf<INPUT>());
    }

    /// <summary>
    /// Types each character via Unicode SendInput so that any character
    /// (including non-ASCII) is injected correctly regardless of the layout.
    /// </summary>
    private static void TypeText(string text, int interKeyDelayMs)
    {
        foreach (char c in text)
        {
            // Handle surrogate pairs (characters outside the BMP).
            if (char.IsHighSurrogate(c)) continue; // paired with next char below

            var down = MakeUnicodeInput(c, 0);
            var up = MakeUnicodeInput(c, KEYEVENTF_KEYUP);
            SendInput(2, [down, up], Marshal.SizeOf<INPUT>());

            if (interKeyDelayMs > 0)
                Thread.Sleep(interKeyDelayMs);
        }
    }

    private static INPUT MakeVkInput(ushort vk, uint flags) => new()
    {
        type = INPUT_KEYBOARD,
        ki = new KEYBDINPUT { wVk = vk, dwFlags = flags }
    };

    private static INPUT MakeUnicodeInput(char c, uint extraFlags) => new()
    {
        type = INPUT_KEYBOARD,
        ki = new KEYBDINPUT
        {
            wVk = 0,
            wScan = c,
            dwFlags = KEYEVENTF_UNICODE | extraFlags
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  Native window
    // ═══════════════════════════════════════════════════════════════
    private sealed class TypingWindow : NativeWindow
    {
        private readonly TypingService _owner;

        public TypingWindow(TypingService owner) { _owner = owner; }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY)
            {
                _owner.OnHotkeyMessage((int)m.WParam);
                return;
            }
            if (m.Msg == (int)WM_APP_REFRESH)
            {
                _owner.RefreshHotkeys();
                return;
            }
            if (m.Msg == (int)WM_APP_TRIGGER)
            {
                _owner.DispatchPendingTriggers();
                return;
            }
            base.WndProc(ref m);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  IDisposable
    // ═══════════════════════════════════════════════════════════════
    public void Dispose()
    {
        if (!_disposed)
        {
            Stop();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }

    ~TypingService() => Dispose();
}
