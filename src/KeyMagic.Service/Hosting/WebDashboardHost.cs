using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Service.Hosting;

internal static class WebDashboardHost
{
    public static WebApplication Start(
        ConfigStore configStore,
        ShortcutBlockingService blockingService,
        TypingService typingService,
        ILogger startupLogger)
    {
        var port = configStore.Config.WebDashboardPort;
        var frontendAssets = FrontendAssetLocator.Resolve();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = AppContext.BaseDirectory,
            WebRootPath = frontendAssets?.RootPath
        });

        builder.Services.AddSingleton(configStore);
        builder.Services.AddSingleton(blockingService);
        builder.Services.AddSingleton(typingService);
        builder.Services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            });

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins($"http://localhost:{port}", $"http://127.0.0.1:{port}")
                    .AllowAnyMethod()
                    .AllowAnyHeader();
            });
        });

        builder.WebHost.ConfigureKestrel(options =>
        {
            options.ListenLocalhost(port);
        });

        var app = builder.Build();

        app.UseCors();

        if (frontendAssets != null)
        {
            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.MapFallbackToFile("index.html");
            startupLogger.LogInformation("Serving dashboard assets from {Source} at {Path}", frontendAssets.Source, frontendAssets.RootPath);
        }
        else
        {
            startupLogger.LogWarning("No dashboard assets were found. The API will start without a web UI.");
        }

        app.MapControllers();
        app.Start();

        startupLogger.LogInformation("KeyMagic dashboard: http://localhost:{Port}", port);
        return app;
    }
}