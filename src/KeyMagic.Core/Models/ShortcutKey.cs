using System.Text.Json.Serialization;

namespace KeyMagic.Core.Models;

/// <summary>
/// Represents a keyboard shortcut combination (e.g., Ctrl+Alt+Delete).
/// </summary>
public class ShortcutKey
{
    /// <summary>Unique identifier for this shortcut.</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];

    /// <summary>Display name (e.g. "Ctrl+Enter").</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>The primary virtual key code (e.g. 0x0D for Enter).</summary>
    public int VirtualKeyCode { get; set; }

    /// <summary>Whether Ctrl must be held.</summary>
    public bool Ctrl { get; set; }

    /// <summary>Whether Alt must be held.</summary>
    public bool Alt { get; set; }

    /// <summary>Whether Shift must be held.</summary>
    public bool Shift { get; set; }

    /// <summary>Whether the Windows key must be held.</summary>
    public bool Win { get; set; }

    public override string ToString()
    {
        var parts = new List<string>();
        if (Ctrl) parts.Add("Ctrl");
        if (Alt) parts.Add("Alt");
        if (Shift) parts.Add("Shift");
        if (Win) parts.Add("Win");
        parts.Add(!string.IsNullOrEmpty(DisplayName) ? DisplayName.Split('+').Last().Trim() : VkCodeToName(VirtualKeyCode));
        return string.Join("+", parts);
    }

    private static string VkCodeToName(int vk) => vk switch
    {
        0x08 => "Backspace",
        0x09 => "Tab",
        0x0D => "Enter",
        0x1B => "Escape",
        0x20 => "Space",
        0x2C => "PrintScreen",
        0x2D => "Insert",
        0x2E => "Delete",
        0x25 => "Left",
        0x26 => "Up",
        0x27 => "Right",
        0x28 => "Down",
        0x21 => "PageUp",
        0x22 => "PageDown",
        0x23 => "End",
        0x24 => "Home",
        0x13 => "Pause",
        0x14 => "CapsLock",
        0x90 => "NumLock",
        0x91 => "ScrollLock",
        // OEM keys : critical for shortcuts like Ctrl+\ (Cluely), Ctrl+; etc.
        0xBA => ";",
        0xBB => "=",
        0xBC => ",",
        0xBD => "-",
        0xBE => ".",
        0xBF => "/",
        0xC0 => "`",
        0xDB => "[",
        0xDC => "\\",
        0xDD => "]",
        0xDE => "'",
        // Numpad
        0x60 => "Num0",
        0x61 => "Num1",
        0x62 => "Num2",
        0x63 => "Num3",
        0x64 => "Num4",
        0x65 => "Num5",
        0x66 => "Num6",
        0x67 => "Num7",
        0x68 => "Num8",
        0x69 => "Num9",
        0x6A => "Num*",
        0x6B => "Num+",
        0x6D => "Num-",
        0x6E => "Num.",
        0x6F => "Num/",
        // Letters and digits
        >= 0x30 and <= 0x39 => ((char)vk).ToString(),
        >= 0x41 and <= 0x5A => ((char)vk).ToString(),
        // Function keys
        >= 0x70 and <= 0x7B => $"F{vk - 0x6F}",
        _ => $"0x{vk:X2}"
    };

    public bool Matches(int vkCode, bool ctrl, bool alt, bool shift, bool win)
    {
        return VirtualKeyCode == vkCode
            && Ctrl == ctrl
            && Alt == alt
            && Shift == shift
            && Win == win;
    }
}
