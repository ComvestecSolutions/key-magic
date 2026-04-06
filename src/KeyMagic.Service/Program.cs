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
        StartupDiagnostics.BeginSession(args);

        Application.ThreadException += (_, eventArgs) =>
            StartupDiagnostics.RecordException("Unhandled UI thread exception", eventArgs.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, eventArgs) =>
        {
            if (eventArgs.ExceptionObject is Exception exception)
            {
                StartupDiagnostics.RecordException("Unhandled process exception", exception);
            }
            else
            {
                StartupDiagnostics.Record($"Unhandled process exception object: {eventArgs.ExceptionObject}");
            }
        };

        KeyMagicRuntime? runtime = null;

        try
        {
            // ── Prevent multiple instances ──────────────────────────
            using var mutex = new Mutex(true, "KeyMagic_SingleInstance", out bool isNew);
            if (!isNew)
            {
                StartupDiagnostics.Record("Another KeyMagic instance is already running; exiting after mutex check.");
                MessageBox.Show("KeyMagic is already running.\nCheck your system tray.", "KeyMagic",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            StartupDiagnostics.Record("Acquired single-instance mutex.");

            // ── WinForms must be initialised BEFORE any IWin32Window is created ──
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            StartupDiagnostics.Record("WinForms initialization completed.");

            runtime = KeyMagicRuntime.Start();
            StartupDiagnostics.Record("Runtime started successfully; entering WinForms message loop.");

            Application.Run();
            StartupDiagnostics.Record("WinForms message loop exited normally.");
        }
        catch (Exception ex)
        {
            StartupDiagnostics.RecordException("Fatal startup failure", ex);
            MessageBox.Show(
                StartupDiagnostics.BuildStartupFailureMessage(ex),
                "KeyMagic failed to start",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            if (runtime is not null)
            {
                try
                {
                    runtime.Dispose();
                    StartupDiagnostics.Record("Runtime disposed.");
                }
                catch (Exception ex)
                {
                    StartupDiagnostics.RecordException("Runtime disposal failed", ex);
                }
            }

            StartupDiagnostics.Record("KeyMagic process is shutting down.");
        }
    }
}
