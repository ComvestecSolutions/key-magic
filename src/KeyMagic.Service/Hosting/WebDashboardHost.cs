using System.Security.Cryptography;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
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
        builder.Services.AddSingleton<DashboardMutationProtector>();
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
        var mutationProtector = app.Services.GetRequiredService<DashboardMutationProtector>();

        app.UseCors();
        app.Use(async (context, next) =>
        {
            var method = context.Request.Method;
            var isMutation = HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsDelete(method) || HttpMethods.IsPatch(method);

            if (isMutation && context.Request.Path.StartsWithSegments("/api") && !mutationProtector.HasValidToken(context.Request))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "Missing or invalid admin token." });
                return;
            }

            await next();
        });

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

internal sealed class DashboardMutationProtector
{
    public const string HeaderName = "X-Admin-Token";

    public DashboardMutationProtector()
    {
        AdminToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    }

    public string AdminToken { get; }

    public bool HasValidToken(HttpRequest request)
    {
        return request.Headers.TryGetValue(HeaderName, out var value)
            && value.Count == 1
            && string.Equals(value[0], AdminToken, StringComparison.Ordinal);
    }
}