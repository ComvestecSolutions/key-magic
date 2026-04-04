namespace KeyMagic.Core.Models;

/// <summary>Controls where text comes from when a typing rule fires.</summary>
public enum TextSource
{
    /// <summary>Use the text stored in <see cref="TypingRule.Text"/>.</summary>
    Fixed = 0,

    /// <summary>Read the latest text from the system clipboard at trigger time.</summary>
    Clipboard = 1
}

/// <summary>
/// A rule that types a configurable block of text into the focused window
/// when a hotkey is pressed.
/// </summary>
public class TypingRule
{
    /// <summary>Unique identifier for this rule.</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];

    /// <summary>Human-readable name for this typing rule.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>The hotkey that triggers typing.</summary>
    public ShortcutKey Hotkey { get; set; } = new();

    /// <summary>Where the text comes from (fixed or clipboard).</summary>
    public TextSource Source { get; set; } = TextSource.Fixed;

    /// <summary>
    /// The text to type when <see cref="Source"/> is <see cref="TextSource.Fixed"/>.
    /// </summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>Milliseconds to wait between each typed character (0 = no delay).</summary>
    public int InterKeyDelayMs { get; set; } = 30;

    /// <summary>Whether this rule is currently active.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>When the rule was created.</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
