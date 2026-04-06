using KeyMagic.Core.Configuration;
using KeyMagic.Core.Services;
using KeyMagic.Service.Hosting;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace KeyMagic.Service.Controllers;

/// <summary>
/// REST API for system status, toggling, settings, and event logs.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class StatusController : ControllerBase
{
    private readonly ConfigStore _configStore;
    private readonly ShortcutBlockingService _blockingService;
    private readonly DashboardMutationProtector _mutationProtector;

    public StatusController(
        ConfigStore configStore,
        ShortcutBlockingService blockingService,
        DashboardMutationProtector mutationProtector)
    {
        _configStore = configStore;
        _blockingService = blockingService;
        _mutationProtector = mutationProtector;
    }

    /// <summary>GET /api/status : overall system status</summary>
    [HttpGet]
    public ActionResult GetStatus()
    {
        var config = _configStore.Config;
        return Ok(new
        {
            globalEnabled = config.GlobalEnabled,
            hookActive = _blockingService.IsRunning,
            totalRules = config.Rules.Count,
            activeRules = config.Rules.Count(r => r.Enabled),
            showNotifications = config.ShowNotifications,
            trayIconVisible = config.TrayIconVisible,
            logPassThrough = config.LogPassThrough,
            allowSingleKeyBlocking = config.AllowSingleKeyBlocking,
            maxLogEntries = config.MaxLogEntries,
            startWithWindows = config.StartWithWindows,
            startEnabled = config.StartEnabled,
            activeProfile = config.ActiveProfile,
            profiles = config.Profiles.Keys.ToList(),
            notificationSound = config.NotificationSound,
            notificationDurationMs = config.NotificationDurationMs,
            webDashboardPort = config.WebDashboardPort,
            adminToken = _mutationProtector.AdminToken
        });
    }

    /// <summary>POST /api/status/toggle : toggle global blocking on/off</summary>
    [HttpPost("toggle")]
    public ActionResult ToggleGlobal()
    {
        var newState = _configStore.ToggleGlobal();
        return Ok(new { globalEnabled = newState });
    }

    /// <summary>PUT /api/status/settings : update all settings at once</summary>
    [HttpPut("settings")]
    public ActionResult UpdateSettings([FromBody] UpdateSettingsRequest request)
    {
        _configStore.Update(c =>
        {
            if (request.ShowNotifications.HasValue) c.ShowNotifications = request.ShowNotifications.Value;
            if (request.TrayIconVisible.HasValue) c.TrayIconVisible = request.TrayIconVisible.Value;
            if (request.LogPassThrough.HasValue) c.LogPassThrough = request.LogPassThrough.Value;
            if (request.AllowSingleKeyBlocking.HasValue) c.AllowSingleKeyBlocking = request.AllowSingleKeyBlocking.Value;
            if (request.MaxLogEntries.HasValue) c.MaxLogEntries = request.MaxLogEntries.Value;
            if (request.StartWithWindows.HasValue) c.StartWithWindows = request.StartWithWindows.Value;
            if (request.StartEnabled.HasValue) c.StartEnabled = request.StartEnabled.Value;
            if (request.NotificationSound.HasValue) c.NotificationSound = request.NotificationSound.Value;
            if (request.NotificationDurationMs.HasValue) c.NotificationDurationMs = request.NotificationDurationMs.Value;
        });
        return Ok(new { success = true });
    }

    /// <summary>GET /api/status/events : get recent shortcut events</summary>
    [HttpGet("events")]
    public ActionResult GetEvents([FromQuery] int? limit)
    {
        var events = _blockingService.EventLog;
        if (limit.HasValue && limit.Value > 0)
            events = events.Take(limit.Value).ToList().AsReadOnly();
        return Ok(events);
    }

    /// <summary>DELETE /api/status/events : clear event log</summary>
    [HttpDelete("events")]
    public ActionResult ClearEvents()
    {
        _blockingService.ClearLog();
        return NoContent();
    }

    /// <summary>GET /api/status/config : export full config as JSON</summary>
    [HttpGet("config")]
    public ActionResult ExportConfig()
    {
        return Ok(_configStore.Config);
    }

    /// <summary>PUT /api/status/config : import full config from JSON</summary>
    [HttpPut("config")]
    public ActionResult ImportConfig([FromBody] KeyMagic.Core.Models.KeyMagicConfig config)
    {
        if (config.MaxLogEntries is < 10 or > 10000)
            return BadRequest(new { error = "MaxLogEntries must be between 10 and 10,000." });
        if (config.NotificationDurationMs is < 500 or > 30000)
            return BadRequest(new { error = "NotificationDurationMs must be between 500 and 30,000 ms." });
        if (config.WebDashboardPort is < 1024 or > 65535)
            return BadRequest(new { error = "WebDashboardPort must be between 1024 and 65535." });

        var imported = config.Clone();

        _configStore.Update(c =>
        {
            c.GlobalEnabled = imported.GlobalEnabled;
            c.Rules = imported.Rules;
            c.WebDashboardPort = imported.WebDashboardPort;
            c.ShowNotifications = imported.ShowNotifications;
            c.TrayIconVisible = imported.TrayIconVisible;
            c.LogPassThrough = imported.LogPassThrough;
            c.AllowSingleKeyBlocking = imported.AllowSingleKeyBlocking;
            c.MaxLogEntries = imported.MaxLogEntries;
            c.StartWithWindows = imported.StartWithWindows;
            c.StartEnabled = imported.StartEnabled;
            c.ActiveProfile = imported.ActiveProfile;
            c.Profiles = imported.Profiles;
            c.NotificationSound = imported.NotificationSound;
            c.NotificationDurationMs = imported.NotificationDurationMs;
            c.TypingRules = imported.TypingRules;
        });
        return Ok(new { success = true });
    }

    /// <summary>GET /api/status/stats : blocking statistics</summary>
    [HttpGet("stats")]
    public ActionResult GetStats()
    {
        var events = _blockingService.EventLog;
        var blockedEvents = events.Where(e => e.WasBlocked).ToList();

        return Ok(new
        {
            totalEvents = events.Count,
            blockedCount = blockedEvents.Count,
            passedCount = events.Count - blockedEvents.Count,
            topBlocked = blockedEvents
                .GroupBy(e => e.ShortcutDisplay)
                .Select(group => new { shortcut = group.Key, count = group.Count() })
                .OrderByDescending(group => group.count)
                .Take(5)
                .ToList(),
            topProcesses = blockedEvents
                .GroupBy(e => e.ProcessName)
                .Select(group => new { process = group.Key, count = group.Count() })
                .OrderByDescending(group => group.count)
                .Take(5)
                .ToList()
        });
    }
}

// ─── Settings DTO ──────────────────────────────────────────────────

public class UpdateSettingsRequest
{
    public bool? ShowNotifications { get; set; }
    public bool? TrayIconVisible { get; set; }
    public bool? LogPassThrough { get; set; }
    public bool? AllowSingleKeyBlocking { get; set; }

    [Range(10, 10000)]
    public int? MaxLogEntries { get; set; }
    public bool? StartWithWindows { get; set; }
    public bool? StartEnabled { get; set; }
    public bool? NotificationSound { get; set; }

    [Range(500, 30000)]
    public int? NotificationDurationMs { get; set; }
}
