using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using KeyMagic.Service.Tray;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Service.Hosting;

internal sealed class KeyMagicRuntime : IDisposable
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly ShortcutBlockingService _blockingService;
    private readonly TypingService _typingService;
    private readonly TrayIconManager _trayIconManager;
    private readonly WebApplication _webApplication;

    private KeyMagicRuntime(
        ILoggerFactory loggerFactory,
        ShortcutBlockingService blockingService,
        TypingService typingService,
        TrayIconManager trayIconManager,
        WebApplication webApplication)
    {
        _loggerFactory = loggerFactory;
        _blockingService = blockingService;
        _typingService = typingService;
        _trayIconManager = trayIconManager;
        _webApplication = webApplication;
    }

    public static KeyMagicRuntime Start()
    {
        var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Information);
        });

        var configStore = new ConfigStore(logger: loggerFactory.CreateLogger<ConfigStore>());
        var blockingService = new ShortcutBlockingService(configStore, loggerFactory);
        var typingService = new TypingService(configStore);

        blockingService.Start();
        typingService.Start();

        var webApplication = WebDashboardHost.Start(
            configStore,
            blockingService,
            typingService,
            loggerFactory.CreateLogger("KeyMagic.WebDashboard"));

        var trayIconManager = new TrayIconManager(
            configStore,
            blockingService,
            loggerFactory.CreateLogger<TrayIconManager>());

        return new KeyMagicRuntime(loggerFactory, blockingService, typingService, trayIconManager, webApplication);
    }

    public void Dispose()
    {
        _trayIconManager.Dispose();
        _webApplication.StopAsync().GetAwaiter().GetResult();
        _webApplication.DisposeAsync().AsTask().GetAwaiter().GetResult();
        _typingService.Stop();
        _typingService.Dispose();
        _blockingService.Stop();
        _blockingService.Dispose();
        _loggerFactory.Dispose();
    }
}