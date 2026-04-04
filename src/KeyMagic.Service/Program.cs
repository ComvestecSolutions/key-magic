using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using KeyMagic.Service.Hosting;

namespace KeyMagic.Service;

/// <summary>
/// KeyMagic entry point.
/// Hosts the system tray icon, keyboard hook, and web dashboard API simultaneously.
/// </summary>
public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        // ── Prevent multiple instances ──────────────────────────
        using var mutex = new Mutex(true, "KeyMagic_SingleInstance", out bool isNew);
        if (!isNew)
        {
            MessageBox.Show("KeyMagic is already running.\nCheck your system tray.", "KeyMagic",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        // ── WinForms must be initialised BEFORE any IWin32Window is created ──
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.SystemAware);

        using var runtime = KeyMagicRuntime.Start();

        Application.Run();
    }
}
