using System.Text.Json;
using System.Text.Json.Serialization;
using KeyMagic.Core.Models;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Configuration;

/// <summary>
/// Persists KeyMagic configuration to a JSON file.
/// Thread-safe for concurrent reads/writes.
/// </summary>
public class ConfigStore
{
    private const string CurrentConfigFolderName = "KeyMagic";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly string _configPath;
    private readonly object _lock = new();
    private KeyMagicConfig _config;
    private readonly ILogger<ConfigStore>? _logger;

    public event Action<KeyMagicConfig>? ConfigChanged;

    public ConfigStore(string? configPath = null, ILogger<ConfigStore>? logger = null)
    {
        _configPath = configPath ?? GetDefaultConfigPath();
        _logger = logger;
        _config = Load();
    }

    public KeyMagicConfig Config
    {
        get { lock (_lock) return _config; }
    }

    /// <summary>
    /// Returns a thread-safe snapshot of the global-enabled flag, the
    /// rules list, and whether pass-through events should be logged.
    /// Callers can safely iterate the returned list without worrying
    /// about concurrent modifications from the web-API thread.
    /// </summary>
    public (bool globalEnabled, List<BlockingRule> rules, bool logPassThrough) GetBlockingSnapshot()
    {
        lock (_lock)
        {
            return (_config.GlobalEnabled, _config.Rules.ToList(), _config.LogPassThrough);
        }
    }

    /// <summary>Reloads configuration from disk.</summary>
    public KeyMagicConfig Reload()
    {
        KeyMagicConfig snapshot;
        lock (_lock)
        {
            _config = Load();
            snapshot = _config;
        }
        ConfigChanged?.Invoke(snapshot);
        return snapshot;
    }

    /// <summary>Saves the current configuration to disk.</summary>
    public void Save()
    {
        lock (_lock)
        {
            var dir = Path.GetDirectoryName(_configPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            var json = JsonSerializer.Serialize(_config, JsonOptions);
            File.WriteAllText(_configPath, json);
        }
    }

    /// <summary>Updates the configuration atomically and persists it.</summary>
    public void Update(Action<KeyMagicConfig> updater)
    {
        KeyMagicConfig snapshot;
        lock (_lock)
        {
            updater(_config);
            Save();
            snapshot = _config;
        }
        ConfigChanged?.Invoke(snapshot);
    }

    /// <summary>Adds a new blocking rule.</summary>
    public BlockingRule AddRule(ShortcutKey shortcut, List<string>? targetProcesses = null, string? description = null)
    {
        var rule = new BlockingRule
        {
            Shortcut = shortcut,
            TargetProcesses = targetProcesses ?? new List<string>(),
            Description = description ?? shortcut.ToString()
        };

        Update(c => c.Rules.Add(rule));
        return rule;
    }

    /// <summary>Removes a rule by its ID.</summary>
    public bool RemoveRule(string ruleId)
    {
        bool removed = false;
        Update(c => removed = c.Rules.RemoveAll(r => r.Id == ruleId) > 0);
        return removed;
    }

    /// <summary>Toggles a specific rule on/off.</summary>
    public bool ToggleRule(string ruleId)
    {
        bool newState = false;
        Update(c =>
        {
            var rule = c.Rules.Find(r => r.Id == ruleId);
            if (rule != null)
            {
                rule.Enabled = !rule.Enabled;
                newState = rule.Enabled;
            }
        });
        return newState;
    }

    // ── Typing Rules ────────────────────────────────────────────────

    /// <summary>Adds a new typing rule and persists the config.</summary>
    public TypingRule AddTypingRule(ShortcutKey hotkey, TextSource source, string text,
        string name, int interKeyDelayMs = 30)
    {
        var rule = new TypingRule
        {
            Name = name,
            Hotkey = hotkey,
            Source = source,
            Text = text,
            InterKeyDelayMs = interKeyDelayMs
        };
        Update(c => c.TypingRules.Add(rule));
        return rule;
    }

    /// <summary>Removes a typing rule by its ID.</summary>
    public bool RemoveTypingRule(string ruleId)
    {
        bool removed = false;
        Update(c => removed = c.TypingRules.RemoveAll(r => r.Id == ruleId) > 0);
        return removed;
    }

    /// <summary>Toggles a typing rule on/off.</summary>
    public bool ToggleTypingRule(string ruleId)
    {
        bool newState = false;
        Update(c =>
        {
            var rule = c.TypingRules.Find(r => r.Id == ruleId);
            if (rule != null)
            {
                rule.Enabled = !rule.Enabled;
                newState = rule.Enabled;
            }
        });
        return newState;
    }

    /// <summary>Toggles the master enable/disable switch.</summary>
    public bool ToggleGlobal()
    {
        bool newState = false;
        Update(c =>
        {
            c.GlobalEnabled = !c.GlobalEnabled;
            newState = c.GlobalEnabled;
        });
        return newState;
    }

    private KeyMagicConfig Load()
    {
        if (!File.Exists(_configPath))
        {
            var config = CreateDefaultConfig();
            _config = config;
            Save();
            return config;
        }

        try
        {
            var json = File.ReadAllText(_configPath);
            return JsonSerializer.Deserialize<KeyMagicConfig>(json, JsonOptions) ?? CreateDefaultConfig();
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to load config from {Path}, using defaults", _configPath);
            return CreateDefaultConfig();
        }
    }

    private static KeyMagicConfig CreateDefaultConfig()
    {
        return new KeyMagicConfig
        {
            GlobalEnabled = false,
            Rules = new List<BlockingRule>
            {
                new()
                {
                    Shortcut = new ShortcutKey
                    {
                        DisplayName = "Alt+Tab",
                        VirtualKeyCode = 0x09, // VK_TAB
                        Alt = true
                    },
                    TargetProcesses = new List<string>(),
                    Enabled = false,
                    Description = "Block Alt+Tab (example : disabled by default)"
                },
                new()
                {
                    Shortcut = new ShortcutKey
                    {
                        DisplayName = "Ctrl+W",
                        VirtualKeyCode = 0x57, // VK_W
                        Ctrl = true
                    },
                    TargetProcesses = new List<string> { "chrome", "msedge", "firefox" },
                    Enabled = false,
                    Description = "Prevent accidental tab close in browsers"
                }
            }
        };
    }

    private static string GetDefaultConfigPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, CurrentConfigFolderName, "config.json");
    }
}
