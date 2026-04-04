using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Interop;
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
    private static extern uint SendInput(uint nInputs, Win32Interop.INPUT[] pInputs, int cbSize);

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
        var inputs = new List<Win32Interop.INPUT>();
        // Release both LEFT and RIGHT variants so physical key state never
        // bleeds into the typed characters.
        if ((mods & MOD_CONTROL) != 0)
        {
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA2, Win32Interop.KeyEventFKeyUp)); // VK_LCONTROL
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA3, Win32Interop.KeyEventFKeyUp)); // VK_RCONTROL
        }
        if ((mods & MOD_ALT) != 0)
        {
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA4, Win32Interop.KeyEventFKeyUp)); // VK_LMENU
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA5, Win32Interop.KeyEventFKeyUp)); // VK_RMENU
        }
        if ((mods & MOD_SHIFT) != 0)
        {
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA0, Win32Interop.KeyEventFKeyUp)); // VK_LSHIFT
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0xA1, Win32Interop.KeyEventFKeyUp)); // VK_RSHIFT
        }
        if ((mods & MOD_WIN) != 0)
        {
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0x5B, Win32Interop.KeyEventFKeyUp)); // VK_LWIN
            inputs.Add(Win32Interop.CreateVirtualKeyInput(0x5C, Win32Interop.KeyEventFKeyUp)); // VK_RWIN
        }
        if (inputs.Count == 0) return;

        var arr = inputs.ToArray();
        SendInput((uint)arr.Length, arr, Win32Interop.InputSize);
    }

    /// <summary>
    /// Types each character via Unicode SendInput so that any character
    /// (including non-ASCII) is injected correctly regardless of the layout.
    /// </summary>
    private static void TypeText(string text, int interKeyDelayMs)
    {
        for (var index = 0; index < text.Length; index++)
        {
            var current = text[index];

            if (char.IsHighSurrogate(current))
            {
                if (index + 1 < text.Length && char.IsLowSurrogate(text[index + 1]))
                {
                    SendUnicodeInputs((ushort)current, (ushort)text[index + 1]);
                    index++;
                }
                else
                {
                    SendUnicodeInputs('\uFFFD');
                }
            }
            else if (char.IsLowSurrogate(current))
            {
                SendUnicodeInputs('\uFFFD');
            }
            else
            {
                SendUnicodeInputs(current);
            }

            if (interKeyDelayMs > 0)
                Thread.Sleep(interKeyDelayMs);
        }
    }

    private static void SendUnicodeInputs(params ushort[] codeUnits)
    {
        var inputs = new Win32Interop.INPUT[codeUnits.Length * 2];
        for (var index = 0; index < codeUnits.Length; index++)
        {
            inputs[index * 2] = Win32Interop.CreateUnicodeInput(codeUnits[index], 0);
            inputs[(index * 2) + 1] = Win32Interop.CreateUnicodeInput(codeUnits[index], Win32Interop.KeyEventFKeyUp);
        }

        SendInput((uint)inputs.Length, inputs, Win32Interop.InputSize);
    }

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
