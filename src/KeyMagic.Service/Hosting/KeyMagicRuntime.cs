using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using KeyMagic.Service.Tray;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Service.Hosting;

internal sealed class KeyMagicRuntime : IDisposable, IAsyncDisposable
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly ShortcutBlockingService _blockingService;
    private readonly TypingService _typingService;
    private readonly TrayIconManager _trayIconManager;
    private readonly WebApplication? _webApplication;
    private bool _disposed;

    private KeyMagicRuntime(
        ILoggerFactory loggerFactory,
        ShortcutBlockingService blockingService,
        TypingService typingService,
        TrayIconManager trayIconManager,
        WebApplication? webApplication)
    {
        _loggerFactory = loggerFactory;
        _blockingService = blockingService;
        _typingService = typingService;
        _trayIconManager = trayIconManager;
        _webApplication = webApplication;
    }

    public static KeyMagicRuntime Start()
    {
        ILoggerFactory? loggerFactory = null;
        ShortcutBlockingService? blockingService = null;
        TypingService? typingService = null;
        TrayIconManager? trayIconManager = null;
        WebApplication? webApplication = null;

        try
        {
            StartupDiagnostics.Record("Creating logger factory.");
            loggerFactory = LoggerFactory.Create(builder =>
            {
                builder.AddConsole();
                builder.SetMinimumLevel(LogLevel.Information);
            });

            StartupDiagnostics.Record("Loading configuration store.");
            var configStore = new ConfigStore(logger: loggerFactory.CreateLogger<ConfigStore>());
            var initialConfig = configStore.Config;
            StartupDiagnostics.Record(
                $"Configuration loaded. GlobalEnabled={initialConfig.GlobalEnabled}; TrayIconVisible={initialConfig.TrayIconVisible}; WebDashboardPort={initialConfig.WebDashboardPort}.");

            blockingService = new ShortcutBlockingService(configStore, loggerFactory);
            typingService = new TypingService(configStore);

            StartupDiagnostics.Record("Starting shortcut blocking service.");
            try
            {
                blockingService.Start();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("KeyMagic could not start keyboard monitoring.", ex);
            }

            StartupDiagnostics.Record("Shortcut blocking service started.");
            StartupDiagnostics.Record("Starting typing automation service.");
            try
            {
                typingService.Start();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("KeyMagic could not start typing automation.", ex);
            }

            StartupDiagnostics.Record("Typing automation service started.");

            var dashboardAvailable = true;
            StartupDiagnostics.Record("Starting local dashboard host.");
            try
            {
                webApplication = WebDashboardHost.Start(
                    configStore,
                    blockingService,
                    typingService,
                    loggerFactory.CreateLogger("KeyMagic.WebDashboard"));
                StartupDiagnostics.Record("Local dashboard host started.");
            }
            catch (Exception ex)
            {
                dashboardAvailable = false;
                StartupDiagnostics.RecordException("Local dashboard host failed to start; continuing without the dashboard", ex);
            }

            StartupDiagnostics.Record("Creating tray icon manager.");
            try
            {
                trayIconManager = new TrayIconManager(
                    configStore,
                    blockingService,
                    dashboardAvailable,
                    loggerFactory.CreateLogger<TrayIconManager>());
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("KeyMagic could not create the system tray icon.", ex);
            }

            StartupDiagnostics.Record(
                $"Tray icon manager created. DashboardAvailable={dashboardAvailable}; TrayIconVisible={initialConfig.TrayIconVisible}.");
            StartupDiagnostics.Record("KeyMagic runtime startup completed.");

            return new KeyMagicRuntime(loggerFactory!, blockingService!, typingService!, trayIconManager!, webApplication);
        }
        catch (Exception ex)
        {
            StartupDiagnostics.RecordException("KeyMagic runtime startup failed", ex);
            RollBackPartialStartup(trayIconManager, webApplication, typingService, blockingService, loggerFactory);
            throw;
        }
    }

    public void Dispose()
    {
        DisposeAsync().AsTask().GetAwaiter().GetResult();
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        StartupDiagnostics.Record("Shutting down KeyMagic runtime.");

        _trayIconManager.Dispose();
        if (_webApplication is not null)
        {
            await _webApplication.StopAsync();
            await _webApplication.DisposeAsync();
        }
        _typingService.Stop();
        _typingService.Dispose();
        _blockingService.Stop();
        _blockingService.Dispose();
        _loggerFactory.Dispose();
        StartupDiagnostics.Record("KeyMagic runtime shutdown completed.");
    }

    private static void RollBackPartialStartup(
        TrayIconManager? trayIconManager,
        WebApplication? webApplication,
        TypingService? typingService,
        ShortcutBlockingService? blockingService,
        ILoggerFactory? loggerFactory)
    {
        TryCleanup("tray icon manager", () => trayIconManager?.Dispose());
        TryCleanup("web dashboard host", () =>
        {
            if (webApplication is null)
            {
                return;
            }

            webApplication.StopAsync().GetAwaiter().GetResult();
            webApplication.DisposeAsync().AsTask().GetAwaiter().GetResult();
        });
        TryCleanup("typing automation service", () => typingService?.Dispose());
        TryCleanup("shortcut blocking service", () => blockingService?.Dispose());
        TryCleanup("logger factory", () => loggerFactory?.Dispose());
    }

    private static void TryCleanup(string componentName, Action cleanup)
    {
        try
        {
            cleanup();
        }
        catch (Exception ex)
        {
            StartupDiagnostics.RecordException($"Failed to roll back {componentName}", ex);
        }
    }
}