namespace KeyMagic.Core.Models;

/// <summary>
/// Top-level configuration for KeyMagic.
/// </summary>
public class KeyMagicConfig
{
    /// <summary>Master toggle : when false, no shortcuts are blocked.</summary>
    public bool GlobalEnabled { get; set; } = true;

    /// <summary>All configured blocking rules.</summary>
    public List<BlockingRule> Rules { get; set; } = new();

    /// <summary>Port for the local web dashboard.</summary>
    public int WebDashboardPort { get; set; } = 5199;

    /// <summary>Whether to show a tray notification when a shortcut is blocked.</summary>
    public bool ShowNotifications { get; set; } = true;

    /// <summary>Whether the system tray icon is visible.</summary>
    public bool TrayIconVisible { get; set; } = true;

    /// <summary>Whether to log pass-through events (not just blocked).</summary>
    public bool LogPassThrough { get; set; } = true;

    /// <summary>Whether to block single keys (no modifier required).</summary>
    public bool AllowSingleKeyBlocking { get; set; } = true;

    /// <summary>Maximum number of log entries to keep in memory.</summary>
    public int MaxLogEntries { get; set; } = 1000;

    /// <summary>Auto-start KeyMagic with Windows.</summary>
    public bool StartWithWindows { get; set; } = false;

    /// <summary>Start with blocking enabled.</summary>
    public bool StartEnabled { get; set; } = false;

    /// <summary>Active profile name.</summary>
    public string ActiveProfile { get; set; } = "Default";

    /// <summary>Saved rule profiles for quick switching.</summary>
    public Dictionary<string, List<string>> Profiles { get; set; } = new()
    {
        ["Default"] = new List<string>()
    };

    /// <summary>Notification sound enabled.</summary>
    public bool NotificationSound { get; set; } = false;

    /// <summary>Notification duration in ms.</summary>
    public int NotificationDurationMs { get; set; } = 2000;

    /// <summary>All configured typing rules.</summary>
    public List<TypingRule> TypingRules { get; set; } = new();
}
