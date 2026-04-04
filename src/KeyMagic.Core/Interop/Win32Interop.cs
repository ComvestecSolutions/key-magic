using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Interop;

internal static class Win32Interop
{
    public const int KeyboardInputType = 1;
    public const uint KeyEventFKeyUp = 0x0002;
    public const uint KeyEventFUnicode = 0x0004;

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    // Layout assumes a 64-bit process, which matches the app's win-x64 deployment.
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    internal struct INPUT
    {
        [FieldOffset(0)] public int type;
        [FieldOffset(8)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public static int InputSize => Marshal.SizeOf<INPUT>();

    public static IntPtr GetForegroundWindowHandle() => GetForegroundWindow();

    public static INPUT CreateVirtualKeyInput(ushort virtualKeyCode, uint flags)
    {
        return new INPUT
        {
            type = KeyboardInputType,
            ki = new KEYBDINPUT
            {
                wVk = virtualKeyCode,
                wScan = 0,
                dwFlags = flags,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        };
    }

    public static INPUT CreateUnicodeInput(ushort codeUnit, uint extraFlags)
    {
        return new INPUT
        {
            type = KeyboardInputType,
            ki = new KEYBDINPUT
            {
                wVk = 0,
                wScan = codeUnit,
                dwFlags = KeyEventFUnicode | extraFlags,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        };
    }

    public static string GetProcessName(IntPtr hwnd, ILogger? logger = null)
    {
        if (hwnd == IntPtr.Zero)
        {
            return string.Empty;
        }

        try
        {
            GetWindowThreadProcessId(hwnd, out uint pid);
            using var process = Process.GetProcessById((int)pid);
            return process.ProcessName;
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "Could not get process name for window handle");
            return string.Empty;
        }
    }

    public static (string processName, string windowTitle) GetWindowInfo(IntPtr hwnd, ILogger? logger = null)
    {
        if (hwnd == IntPtr.Zero)
        {
            return (string.Empty, string.Empty);
        }

        try
        {
            GetWindowThreadProcessId(hwnd, out uint pid);
            using var process = Process.GetProcessById((int)pid);

            var titleBuilder = new StringBuilder(256);
            GetWindowText(hwnd, titleBuilder, titleBuilder.Capacity);
            return (process.ProcessName, titleBuilder.ToString());
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "Could not get foreground process info");
            return (string.Empty, string.Empty);
        }
    }
}