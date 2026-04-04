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
        get { lock (_lock) return _config.Clone(); }
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
            var snapshot = _config.Clone();
            return (snapshot.GlobalEnabled, snapshot.Rules, snapshot.LogPassThrough);
        }
    }

    /// <summary>Reloads configuration from disk.</summary>
    public KeyMagicConfig Reload()
    {
        KeyMagicConfig snapshot;
        lock (_lock)
        {
            _config = Load();
            snapshot = _config.Clone();
        }
        ConfigChanged?.Invoke(snapshot);
        return snapshot;
    }

    /// <summary>Saves the current configuration to disk.</summary>
    public void Save()
    {
        lock (_lock)
        {
            SaveConfigUnsafe(_config);
        }
    }

    /// <summary>Updates the configuration atomically and persists it.</summary>
    public void Update(Action<KeyMagicConfig> updater)
    {
        KeyMagicConfig snapshot;
        lock (_lock)
        {
            updater(_config);
            SaveConfigUnsafe(_config);
            snapshot = _config.Clone();
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
        string name, int interKeyDelayMs = 30, bool enabled = true)
    {
        var rule = new TypingRule
        {
            Name = name,
            Hotkey = hotkey,
            Source = source,
            Text = text,
            InterKeyDelayMs = interKeyDelayMs,
            Enabled = enabled
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
            var config = JsonSerializer.Deserialize<KeyMagicConfig>(json, JsonOptions);
            return NormalizeConfig(config ?? CreateDefaultConfig());
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to load config from {Path}, using defaults", _configPath);
            return CreateDefaultConfig();
        }
    }

    private static KeyMagicConfig CreateDefaultConfig()
    {
        return KeyMagicConfig.CreateDefault();
    }

    private void SaveConfigUnsafe(KeyMagicConfig config)
    {
        var dir = Path.GetDirectoryName(_configPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        var json = JsonSerializer.Serialize(config, JsonOptions);
        var tempDirectory = string.IsNullOrEmpty(dir) ? Directory.GetCurrentDirectory() : dir;
        var tempPath = Path.Combine(tempDirectory, $"{Path.GetFileName(_configPath)}.{Guid.NewGuid():N}.tmp");

        File.WriteAllText(tempPath, json);

        try
        {
            if (File.Exists(_configPath))
            {
                File.Replace(tempPath, _configPath, null);
            }
            else
            {
                File.Move(tempPath, _configPath);
            }
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    private static KeyMagicConfig NormalizeConfig(KeyMagicConfig config)
    {
        var defaults = KeyMagicConfig.CreateDefault();

        config.Rules ??= defaults.Rules.Select(rule => rule.Clone()).ToList();
        config.Profiles ??= defaults.Profiles.ToDictionary(entry => entry.Key, entry => new List<string>(entry.Value));
        config.TypingRules ??= new List<TypingRule>();
        config.ActiveProfile ??= defaults.ActiveProfile;

        return config;
    }

    private static string GetDefaultConfigPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, CurrentConfigFolderName, "config.json");
    }
}
