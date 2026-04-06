namespace KeyMagic.Core.Models;

/// <summary>
/// A rule that ties a shortcut to one or more target applications.
/// </summary>
public class BlockingRule
{
    /// <summary>Unique identifier for this rule.</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];

    /// <summary>The shortcut to block.</summary>
    public ShortcutKey Shortcut { get; set; } = new();

    /// <summary>
    /// Process names to target (e.g. "notepad", "chrome").
    /// Empty list = block globally (all applications).
    /// </summary>
    public List<string> TargetProcesses { get; set; } = new();

    /// <summary>Whether this rule is currently active.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Human-readable description of the rule.</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>When the rule was created.</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public BlockingRule Clone()
    {
        return new BlockingRule
        {
            Id = Id,
            Shortcut = Shortcut.Clone(),
            TargetProcesses = new List<string>(TargetProcesses),
            Enabled = Enabled,
            Description = Description,
            CreatedAt = CreatedAt
        };
    }
}
