namespace KeyMagic.Core.Models;

/// <summary>
/// Represents a single blocked/passed shortcut event for logging.
/// </summary>
public class ShortcutEvent
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string ShortcutDisplay { get; set; } = string.Empty;
    public string ProcessName { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;
    public bool WasBlocked { get; set; }
    public string RuleId { get; set; } = string.Empty;
}
