namespace KeyMagic.Core.Models;

/// <summary>
/// Top-level configuration for KeyMagic.
/// </summary>
public class KeyMagicConfig
{
    /// <summary>Master toggle : when false, no shortcuts are blocked.</summary>
    public bool GlobalEnabled { get; set; } = false;

    /// <summary>All configured blocking rules.</summary>
    public List<BlockingRule> Rules { get; set; } = CreateDefaultRules();

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
    public Dictionary<string, List<string>> Profiles { get; set; } = CreateDefaultProfiles();

    /// <summary>Notification sound enabled.</summary>
    public bool NotificationSound { get; set; } = false;

    /// <summary>Notification duration in ms.</summary>
    public int NotificationDurationMs { get; set; } = 2000;

    /// <summary>All configured typing rules.</summary>
    public List<TypingRule> TypingRules { get; set; } = new();

    public static KeyMagicConfig CreateDefault() => new();

    public KeyMagicConfig Clone()
    {
        return new KeyMagicConfig
        {
            GlobalEnabled = GlobalEnabled,
            Rules = Rules?.Select(rule => rule.Clone()).ToList() ?? CreateDefaultRules(),
            WebDashboardPort = WebDashboardPort,
            ShowNotifications = ShowNotifications,
            TrayIconVisible = TrayIconVisible,
            LogPassThrough = LogPassThrough,
            AllowSingleKeyBlocking = AllowSingleKeyBlocking,
            MaxLogEntries = MaxLogEntries,
            StartWithWindows = StartWithWindows,
            StartEnabled = StartEnabled,
            ActiveProfile = ActiveProfile,
            Profiles = Profiles?.ToDictionary(entry => entry.Key, entry => new List<string>(entry.Value)) ?? CreateDefaultProfiles(),
            NotificationSound = NotificationSound,
            NotificationDurationMs = NotificationDurationMs,
            TypingRules = TypingRules?.Select(rule => rule.Clone()).ToList() ?? new List<TypingRule>()
        };
    }

    private static List<BlockingRule> CreateDefaultRules()
    {
        return new List<BlockingRule>
        {
            new()
            {
                Shortcut = new ShortcutKey
                {
                    DisplayName = "Alt+Tab",
                    VirtualKeyCode = 0x09,
                    Alt = true
                },
                TargetProcesses = new List<string>(),
                Enabled = false,
                Description = "Block Alt+Tab (example: disabled by default)"
            },
            new()
            {
                Shortcut = new ShortcutKey
                {
                    DisplayName = "Ctrl+W",
                    VirtualKeyCode = 0x57,
                    Ctrl = true
                },
                TargetProcesses = new List<string> { "chrome", "msedge", "firefox" },
                Enabled = false,
                Description = "Prevent accidental tab close in browsers"
            }
        };
    }

    private static Dictionary<string, List<string>> CreateDefaultProfiles()
    {
        return new Dictionary<string, List<string>>
        {
            ["Default"] = new List<string>()
        };
    }
}
