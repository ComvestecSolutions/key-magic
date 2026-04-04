using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using KeyMagic.Core.Interop;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Hooks;

/// <summary>
/// Windows low-level keyboard hook (WH_KEYBOARD_LL) used for
/// <b>monitoring only</b>.  This hook never suppresses keystrokes — it always
/// returns <c>CallNextHookEx</c> so every input mechanism (Raw Input, other LL
/// hooks, message queues) sees the key normally.
///
/// <para>
/// Actual blocking is handled by
/// <see cref="KeyMagic.Core.Blocking.HotkeyBlocker"/> which uses
/// <c>RegisterHotKey</c>.  LL hooks fire <b>before</b> hotkey processing in the
/// Windows input pipeline, so this monitor hook and any third-party hooks
/// (e.g. Cluely) always see every keystroke regardless of whether a
/// <c>RegisterHotKey</c> match later consumes it.
/// </para>
/// </summary>
public class LowLevelKeyboardHook : IDisposable
{
    // ─── Win32 Constants ───────────────────────────────────────────
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    private const int VK_LSHIFT = 0xA0;
    private const int VK_RSHIFT = 0xA1;
    private const int VK_LCONTROL = 0xA2;
    private const int VK_RCONTROL = 0xA3;
    private const int VK_LMENU = 0xA4;
    private const int VK_RMENU = 0xA5;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;
    private const int VK_SHIFT = 0x10;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12;

    private const int LLKHF_ALTDOWN = 0x20;

    // ─── Win32 P/Invoke ────────────────────────────────────────────
    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public int vkCode;
        public int scanCode;
        public int flags;
        public int time;
        public IntPtr dwExtraInfo;
    }

    // ─── Events ────────────────────────────────────────────────────
    /// <summary>
    /// Fired on every non-modifier key-down event for monitoring / logging.
    /// Parameters: vkCode, ctrl, alt, shift, win, processName, windowTitle.
    /// The return value is used only for logging (true = a rule matched);
    /// the hook NEVER suppresses the keystroke regardless of the return value.
    /// </summary>
    public event Func<int, bool, bool, bool, bool, string, string, bool>? KeyIntercepted;

    /// <summary>When true, fires KeyIntercepted even for single keys without modifiers.</summary>
    public bool InterceptSingleKeys { get; set; } = true;

    // ─── Fields ────────────────────────────────────────────────────
    private IntPtr _hookId = IntPtr.Zero;
    private readonly LowLevelKeyboardProc _proc;
    private bool _disposed;

    // Foreground window cache — avoids expensive cross-process lookups on every keystroke.
    private IntPtr _cachedFgHwnd;
    private string _cachedProcessName = string.Empty;
    private string _cachedWindowTitle = string.Empty;

    private readonly ILogger<LowLevelKeyboardHook>? _logger;

    public bool IsHooked => _hookId != IntPtr.Zero;

    public LowLevelKeyboardHook(ILogger<LowLevelKeyboardHook>? logger = null)
    {
        _logger = logger;
        _proc = HookCallback;
    }

    /// <summary>Installs the low-level keyboard hook.</summary>
    public void Install()
    {
        if (_hookId != IntPtr.Zero) return;

        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule;
        if (curModule == null)
        {
            _logger?.LogWarning("Current process main module was unavailable while installing the keyboard hook; falling back to the current process module handle.");
        }

        _hookId = SetWindowsHookEx(
            WH_KEYBOARD_LL,
            _proc,
            GetModuleHandle(curModule?.ModuleName),
            0);

        if (_hookId == IntPtr.Zero)
        {
            var error = Marshal.GetLastWin32Error();
            throw new InvalidOperationException($"Failed to install keyboard hook. Win32 error: {error}");
        }
    }

    /// <summary>Removes the keyboard hook.</summary>
    public void Uninstall()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Hook callback — monitoring only, NEVER suppresses
    // ═══════════════════════════════════════════════════════════════
    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        // CRITICAL: if an unhandled exception escapes an LL hook callback,
        // Windows silently removes the hook while _hookId stays set —
        // making IsHooked report true when the hook is actually dead.
        // Wrapping in try/catch keeps the hook alive under all conditions.
        try
        {
            if (nCode >= 0)
            {
                var hookStruct = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
                int vkCode = hookStruct.vkCode;
                int msg = (int)wParam;

                // Only monitor key-down events
                if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                {
                    if (!IsModifierKey(vkCode))
                    {
                        bool ctrl = IsKeyToggled(VK_CONTROL);
                        bool shift = IsKeyToggled(VK_SHIFT);
                        bool win = IsKeyToggled(VK_LWIN) || IsKeyToggled(VK_RWIN);
                        bool alt = (hookStruct.flags & LLKHF_ALTDOWN) != 0 || IsKeyToggled(VK_MENU);

                        bool hasModifier = ctrl || alt || shift || win;

                        if (hasModifier || InterceptSingleKeys)
                        {
                            var (processName, windowTitle) = GetForegroundInfo();

                            // Fire event for monitoring / dashboard logging.
                            // Return value is used for the event log's WasBlocked
                            // flag only — the hook NEVER suppresses.
                            KeyIntercepted?.Invoke(
                                vkCode, ctrl, alt, shift, win, processName, windowTitle);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogDebug(ex, "Exception in keyboard hook callback");
        }

        // Always pass through — never suppress keystrokes
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Returns cached foreground window info.  Only performs the (expensive)
    /// cross-process lookup when the foreground window HWND changes.
    /// </summary>
    private (string processName, string windowTitle) GetForegroundInfo()
    {
        var hwnd = Win32Interop.GetForegroundWindowHandle();
        if (hwnd == IntPtr.Zero)
            return (string.Empty, string.Empty);

        if (hwnd == _cachedFgHwnd)
            return (_cachedProcessName, _cachedWindowTitle);

        var (processName, windowTitle) = Win32Interop.GetWindowInfo(hwnd, _logger);

        _cachedFgHwnd = hwnd;
        _cachedProcessName = processName;
        _cachedWindowTitle = windowTitle;

        return (processName, windowTitle);
    }

    private static bool IsKeyToggled(int vkCode)
    {
        return (GetKeyState(vkCode) & 0x8000) != 0;
    }

    private static bool IsModifierKey(int vkCode)
    {
        return vkCode is VK_SHIFT or VK_LSHIFT or VK_RSHIFT
            or VK_CONTROL or VK_LCONTROL or VK_RCONTROL
            or VK_MENU or VK_LMENU or VK_RMENU
            or VK_LWIN or VK_RWIN;
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            Uninstall();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }

    ~LowLevelKeyboardHook() => Dispose();
}
