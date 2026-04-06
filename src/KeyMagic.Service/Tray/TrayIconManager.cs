using System.Runtime.InteropServices;
using KeyMagic.Core.Configuration;
using KeyMagic.Core.Models;
using KeyMagic.Core.Services;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Service.Tray;

/// <summary>
/// System tray icon with context menu for managing KeyMagic.
/// Uses a custom dark-theme renderer with light text for visibility.
/// </summary>
public class TrayIconManager : IDisposable
{
    private readonly NotifyIcon _notifyIcon;
    private readonly Control _uiInvoker;
    private readonly ConfigStore _configStore;
    private readonly ShortcutBlockingService _blockingService;
    private readonly int _dashboardPort;
    private readonly ILogger<TrayIconManager>? _logger;
    private readonly Image _brandMenuIcon;
    private readonly Image _dashboardMenuIcon;
    private readonly Image _resumeMenuIcon;
    private readonly Image _pauseMenuIcon;
    private readonly Image _rulesMenuIcon;
    private readonly Image _typingMenuIcon;
    private readonly Image _exitMenuIcon;
    private readonly Image _activeStatusMenuIcon;
    private readonly Image _inactiveStatusMenuIcon;
    private readonly Image _activeRuleMenuIcon;
    private readonly Image _inactiveRuleMenuIcon;
    private readonly Image _activeTypingMenuIcon;
    private readonly Image _inactiveTypingMenuIcon;
    private bool _disposed;

    public TrayIconManager(ConfigStore configStore, ShortcutBlockingService blockingService, ILogger<TrayIconManager>? logger = null)
    {
        _configStore = configStore;
        _blockingService = blockingService;
        _dashboardPort = configStore.Config.WebDashboardPort;
        _logger = logger;
        _uiInvoker = new Control();
        _ = _uiInvoker.Handle;
        _brandMenuIcon = CreateMenuIcon(MenuIconKind.Brand, Color.FromArgb(245, 158, 11));
        _dashboardMenuIcon = CreateMenuIcon(MenuIconKind.Dashboard, Color.FromArgb(6, 182, 212));
        _resumeMenuIcon = CreateMenuIcon(MenuIconKind.Resume, Color.FromArgb(16, 185, 129));
        _pauseMenuIcon = CreateMenuIcon(MenuIconKind.Pause, Color.FromArgb(244, 63, 94));
        _rulesMenuIcon = CreateMenuIcon(MenuIconKind.Rules, Color.FromArgb(245, 158, 11));
        _typingMenuIcon = CreateMenuIcon(MenuIconKind.Typing, Color.FromArgb(6, 182, 212));
        _exitMenuIcon = CreateMenuIcon(MenuIconKind.Exit, Color.FromArgb(244, 63, 94));
        _activeStatusMenuIcon = CreateMenuIcon(MenuIconKind.Active, Color.FromArgb(16, 185, 129));
        _inactiveStatusMenuIcon = CreateMenuIcon(MenuIconKind.Inactive, Color.FromArgb(107, 115, 148));
        _activeRuleMenuIcon = CreateMenuIcon(MenuIconKind.Active, Color.FromArgb(245, 158, 11));
        _inactiveRuleMenuIcon = CreateMenuIcon(MenuIconKind.Inactive, Color.FromArgb(107, 115, 148));
        _activeTypingMenuIcon = CreateMenuIcon(MenuIconKind.Active, Color.FromArgb(6, 182, 212));
        _inactiveTypingMenuIcon = CreateMenuIcon(MenuIconKind.Inactive, Color.FromArgb(107, 115, 148));

        _notifyIcon = new NotifyIcon
        {
            Icon = CreateTrayIcon(),
            Text = "KeyMagic: Keyboard Shortcut Blocker",
            Visible = configStore.Config.TrayIconVisible,
            ContextMenuStrip = BuildContextMenu()
        };

        _notifyIcon.DoubleClick += (_, _) => OpenDashboard();

        // Subscribe to blocking events for notifications
        _blockingService.ShortcutEventOccurred += OnShortcutEvent;

        // React to config changes (e.g. tray visibility toggled from dashboard)
        _configStore.ConfigChanged += OnConfigChanged;
    }

    private void OnConfigChanged(KeyMagicConfig config)
    {
        try
        {
            if (_uiInvoker.IsDisposed)
            {
                return;
            }

            if (_uiInvoker.InvokeRequired)
            {
                _uiInvoker.BeginInvoke(() => ApplyConfigChange(config));
            }
            else
            {
                ApplyConfigChange(config);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to apply config change to tray icon");
        }
    }

    private void ApplyConfigChange(KeyMagicConfig config)
    {
        _notifyIcon.Visible = config.TrayIconVisible;
        UpdateIcon();
    }

    private ContextMenuStrip BuildContextMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Renderer = new DarkMenuRenderer();
        menu.BackColor = Color.FromArgb(10, 12, 16);       // --background
        menu.ForeColor = Color.FromArgb(226, 229, 235);    // --text
        menu.ShowImageMargin = true;
        menu.ShowCheckMargin = false;
        menu.ImageScalingSize = new Size(16, 16);
        menu.Padding = new Padding(4, 6, 4, 6);

        // ── Header with status ──
        var headerItem = new ToolStripMenuItem("KeyMagic")
        {
            Enabled = false,
            Font = new Font("Segoe UI Semibold", 10f, FontStyle.Bold),
            ForeColor = Color.FromArgb(245, 158, 11),      // --amber
            Padding = new Padding(4, 6, 4, 4),
            Image = CloneMenuIcon(_brandMenuIcon)
        };
        menu.Items.Add(headerItem);

        var subtitleItem = new ToolStripMenuItem("Keyboard control center")
        {
            Enabled = false,
            Font = new Font("Segoe UI", 8.5f),
            ForeColor = Color.FromArgb(107, 115, 148),
            Padding = new Padding(4, 0, 4, 6)
        };
        menu.Items.Add(subtitleItem);

        // ── Status line ──
        var statusItem = new ToolStripMenuItem("")
        {
            Enabled = false,
            Font = new Font("Segoe UI Semibold", 8.5f),
            ForeColor = Color.FromArgb(107, 115, 148),
            Padding = new Padding(4, 2, 4, 4)
        };
        menu.Items.Add(statusItem);
        menu.Items.Add(CreateSeparator());

        // ── Toggle blocking ──
        var toggleItem = new ToolStripMenuItem(GetToggleText())
        {
            Font = new Font("Segoe UI Semibold", 9.25f, FontStyle.Bold),
            ForeColor = Color.FromArgb(226, 229, 235),
            Padding = new Padding(4, 6, 4, 6),
            Image = CloneMenuIcon(_resumeMenuIcon)
        };
        toggleItem.Click += (_, _) =>
        {
            _configStore.ToggleGlobal();
            toggleItem.Text = GetToggleText();
            toggleItem.ForeColor = _configStore.Config.GlobalEnabled
                ? Color.FromArgb(244, 63, 94)               // --rose for "Disable"
                : Color.FromArgb(16, 185, 129);              // --emerald for "Enable"
            ReplaceMenuItemImage(toggleItem, _configStore.Config.GlobalEnabled ? _pauseMenuIcon : _resumeMenuIcon);
        };
        menu.Items.Add(toggleItem);

        // ── Open dashboard ──
        var dashboardItem = new ToolStripMenuItem("Open dashboard")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(6, 182, 212),        // --cyan
            Padding = new Padding(4, 6, 4, 6),
            Image = CloneMenuIcon(_dashboardMenuIcon)
        };
        dashboardItem.Click += (_, _) => OpenDashboard();
        menu.Items.Add(dashboardItem);

        menu.Items.Add(CreateSeparator());

        // ── Blocking rules submenu ──
        var rulesItem = new ToolStripMenuItem("Blocking rules")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(156, 163, 184),      // --text-secondary
            Padding = new Padding(4, 6, 4, 6),
            Image = CloneMenuIcon(_rulesMenuIcon)
        };
        rulesItem.DropDown.BackColor = Color.FromArgb(10, 12, 16);
        rulesItem.DropDown.Padding = new Padding(4);
        if (rulesItem.DropDown is ToolStripDropDownMenu rulesDropDown)
        {
            rulesDropDown.ShowImageMargin = true;
            rulesDropDown.ShowCheckMargin = false;
        }
        menu.Items.Add(rulesItem);

        // ── Typing rules submenu ──
        var typingItem = new ToolStripMenuItem("Typing macros")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(156, 163, 184),
            Padding = new Padding(4, 6, 4, 6),
            Image = CloneMenuIcon(_typingMenuIcon)
        };
        typingItem.DropDown.BackColor = Color.FromArgb(10, 12, 16);
        typingItem.DropDown.Padding = new Padding(4);
        if (typingItem.DropDown is ToolStripDropDownMenu typingDropDown)
        {
            typingDropDown.ShowImageMargin = true;
            typingDropDown.ShowCheckMargin = false;
        }
        menu.Items.Add(typingItem);

        // Rebuild submenus and status dynamically
        menu.Opening += (_, _) =>
        {
            // Update status line
            var config = _configStore.Config;
            var ruleCount = config.Rules.Count;
            var activeCount = config.Rules.Count(r => r.Enabled);
            var typingCount = config.TypingRules.Count;
            var activeTypingCount = config.TypingRules.Count(r => r.Enabled);
            statusItem.Text = config.GlobalEnabled
                ? $"Protection live • {activeCount}/{ruleCount} rules armed"
                : $"Protection paused • {activeCount}/{ruleCount} rules armed";
            statusItem.ForeColor = config.GlobalEnabled
                ? Color.FromArgb(16, 185, 129)
                : Color.FromArgb(107, 115, 148);
            ReplaceMenuItemImage(statusItem, config.GlobalEnabled ? _activeStatusMenuIcon : _inactiveStatusMenuIcon);

            // Update toggle state
            toggleItem.Text = GetToggleText();
            toggleItem.ForeColor = config.GlobalEnabled
                ? Color.FromArgb(244, 63, 94)
                : Color.FromArgb(16, 185, 129);
            ReplaceMenuItemImage(toggleItem, config.GlobalEnabled ? _pauseMenuIcon : _resumeMenuIcon);

            rulesItem.Text = $"Blocking rules • {activeCount}/{ruleCount}";
            typingItem.Text = $"Typing macros • {activeTypingCount}/{typingCount}";

            // Rebuild blocking rules
            DisposeMenuItemImages(rulesItem.DropDownItems);
            rulesItem.DropDownItems.Clear();
            foreach (var rule in config.Rules)
            {
                var ruleMenuItem = new ToolStripMenuItem(GetBlockingRuleLabel(rule))
                {
                    Font = new Font("Segoe UI", 8.75f),
                    ForeColor = rule.Enabled
                        ? Color.FromArgb(245, 158, 11)       // --amber
                        : Color.FromArgb(107, 115, 148),
                    BackColor = Color.FromArgb(10, 12, 16),
                    Padding = new Padding(4, 4, 4, 4),
                    Image = CloneMenuIcon(rule.Enabled ? _activeRuleMenuIcon : _inactiveRuleMenuIcon)
                };
                var ruleId = rule.Id;
                ruleMenuItem.Click += (_, _) => _configStore.ToggleRule(ruleId);
                rulesItem.DropDownItems.Add(ruleMenuItem);
            }
            if (rulesItem.DropDownItems.Count == 0)
            {
                rulesItem.DropDownItems.Add(new ToolStripMenuItem("No blocking rules yet")
                {
                    Enabled = false,
                    ForeColor = Color.FromArgb(107, 115, 148),
                    BackColor = Color.FromArgb(10, 12, 16),
                    Font = new Font("Segoe UI", 8.75f)
                });
            }

            // Rebuild typing rules
            DisposeMenuItemImages(typingItem.DropDownItems);
            typingItem.DropDownItems.Clear();
            foreach (var rule in config.TypingRules)
            {
                var typeMenuItem = new ToolStripMenuItem(GetTypingRuleLabel(rule))
                {
                    Font = new Font("Segoe UI", 8.75f),
                    ForeColor = rule.Enabled
                        ? Color.FromArgb(6, 182, 212)       // --cyan
                        : Color.FromArgb(107, 115, 148),
                    BackColor = Color.FromArgb(10, 12, 16),
                    Padding = new Padding(4, 4, 4, 4),
                    Image = CloneMenuIcon(rule.Enabled ? _activeTypingMenuIcon : _inactiveTypingMenuIcon)
                };
                var ruleId = rule.Id;
                typeMenuItem.Click += (_, _) => _configStore.ToggleTypingRule(ruleId);
                typingItem.DropDownItems.Add(typeMenuItem);
            }
            if (typingItem.DropDownItems.Count == 0)
            {
                typingItem.DropDownItems.Add(new ToolStripMenuItem("No typing macros yet")
                {
                    Enabled = false,
                    ForeColor = Color.FromArgb(107, 115, 148),
                    BackColor = Color.FromArgb(10, 12, 16),
                    Font = new Font("Segoe UI", 8.75f)
                });
            }
        };

        menu.Items.Add(CreateSeparator());

        // ── Exit ──
        var exitItem = new ToolStripMenuItem("Quit KeyMagic")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(244, 63, 94),        // --rose
            Padding = new Padding(4, 6, 4, 6),
            Image = CloneMenuIcon(_exitMenuIcon)
        };
        exitItem.Click += (_, _) =>
        {
            _notifyIcon.Visible = false;
            Application.Exit();
        };
        menu.Items.Add(exitItem);

        return menu;
    }

    private static ToolStripSeparator CreateSeparator()
    {
        var sep = new ToolStripSeparator();
        sep.ForeColor = Color.FromArgb(30, 35, 53);   // --border
        sep.BackColor = Color.FromArgb(10, 12, 16);
        return sep;
    }

    private static string GetBlockingRuleLabel(BlockingRule rule)
    {
        var shortcutLabel = GetShortcutLabel(rule.Shortcut);
        var description = rule.Description?.Trim();
        if (string.IsNullOrWhiteSpace(description) || string.Equals(description, shortcutLabel, StringComparison.OrdinalIgnoreCase))
        {
            return shortcutLabel;
        }

        return $"{TrimForMenu(description, 30)} • {shortcutLabel}";
    }

    private static string GetTypingRuleLabel(TypingRule rule)
    {
        var shortcutLabel = GetShortcutLabel(rule.Hotkey);
        var name = rule.Name?.Trim();
        var baseLabel = !string.IsNullOrWhiteSpace(name)
            ? name
            : rule.Source == TextSource.Clipboard
                ? "Clipboard macro"
                : "Text macro";

        return $"{TrimForMenu(baseLabel, 30)} • {shortcutLabel}";
    }

    private static string GetShortcutLabel(ShortcutKey shortcut)
    {
        if (!string.IsNullOrWhiteSpace(shortcut.DisplayName))
        {
            return shortcut.DisplayName.Trim();
        }

        var fallback = shortcut.ToString();
        return string.IsNullOrWhiteSpace(fallback)
            ? $"Key 0x{shortcut.VirtualKeyCode:X2}"
            : fallback;
    }

    private static string TrimForMenu(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        return value[..(maxLength - 1)].TrimEnd() + "…";
    }

    private static void ReplaceMenuItemImage(ToolStripMenuItem item, Image image)
    {
        item.Image?.Dispose();
        item.Image = CloneMenuIcon(image);
    }

    private static void DisposeMenuItemImages(ToolStripItemCollection items)
    {
        foreach (var item in items.OfType<ToolStripMenuItem>())
        {
            item.Image?.Dispose();
        }
    }

    private static Image CloneMenuIcon(Image image)
    {
        return (Image)image.Clone();
    }

    private string GetToggleText()
    {
        return _configStore.Config.GlobalEnabled
            ? "Pause protection"
            : "Resume protection";
    }

    private void UpdateIcon()
    {
        var oldIcon = _notifyIcon.Icon;
        _notifyIcon.Icon = CreateTrayIcon();
        oldIcon?.Dispose();
        _notifyIcon.Text = _configStore.Config.GlobalEnabled
            ? "KeyMagic: ACTIVE (blocking shortcuts)"
            : "KeyMagic: PAUSED";
    }

    private void OnShortcutEvent(ShortcutEvent evt)
    {
        if (!_configStore.Config.ShowNotifications) return;
        if (!evt.WasBlocked) return;

        try
        {
            _notifyIcon.ShowBalloonTip(
                _configStore.Config.NotificationDurationMs,
                "KeyMagic: Shortcut Blocked",
                $"{evt.ShortcutDisplay} blocked in {evt.ProcessName}",
                ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            // Notification failure is non-critical
            _logger?.LogDebug(ex, "Failed to show balloon notification");
        }
    }

    private void OpenDashboard()
    {
        try
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = $"http://localhost:{_dashboardPort}",
                UseShellExecute = true
            };
            System.Diagnostics.Process.Start(psi);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to open dashboard in browser");
        }
    }

    /// <summary>
    /// Creates a small keycap-and-spark tray icon so the brand reads as keyboard control,
    /// not a generic security product.
    /// </summary>
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern bool DestroyIcon(IntPtr handle);

    private Icon CreateTrayIcon()
    {
        bool active = _configStore.Config.GlobalEnabled;
        using var bitmap = new Bitmap(32, 32);
        using var g = Graphics.FromImage(bitmap);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g.Clear(Color.Transparent);

        // Colors
        var bgColor = Color.FromArgb(10, 12, 16);
        var borderColor = active ? Color.FromArgb(245, 158, 11) : Color.FromArgb(60, 65, 85);
        var letterColor = active ? Color.FromArgb(245, 158, 11) : Color.FromArgb(156, 163, 184);
        var boltColor = active ? Color.FromArgb(6, 182, 212) : Color.FromArgb(107, 115, 148);
        var statusColor = active ? Color.FromArgb(16, 185, 129) : Color.FromArgb(107, 115, 148);

        // Background square with cut corner
        using var bgPath = new System.Drawing.Drawing2D.GraphicsPath();
        bgPath.AddLine(2, 2, 24, 2);
        bgPath.AddLine(24, 2, 29, 7);
        bgPath.AddLine(29, 7, 29, 29);
        bgPath.AddLine(29, 29, 7, 29);
        bgPath.AddLine(7, 29, 2, 24);
        bgPath.AddLine(2, 24, 2, 2);
        bgPath.CloseFigure();
        using var bgBrush = new SolidBrush(bgColor);
        g.FillPath(bgBrush, bgPath);
        using var borderPen = new Pen(borderColor, 1.3f);
        g.DrawPath(borderPen, bgPath);

        // "K" lettermark
        using var kPen = new Pen(letterColor, 2.2f)
        {
            StartCap = System.Drawing.Drawing2D.LineCap.Square,
            EndCap = System.Drawing.Drawing2D.LineCap.Square,
            LineJoin = System.Drawing.Drawing2D.LineJoin.Miter
        };
        g.DrawLine(kPen, 9f, 8f, 9f, 23f);       // vertical stroke
        g.DrawLine(kPen, 9f, 16f, 19f, 8f);       // upper diagonal
        g.DrawLine(kPen, 9f, 16f, 19f, 23f);      // lower diagonal

        // Lightning bolt accent
        using var boltPen = new Pen(boltColor, 1.6f)
        {
            StartCap = System.Drawing.Drawing2D.LineCap.Round,
            EndCap = System.Drawing.Drawing2D.LineCap.Round
        };
        g.DrawLine(boltPen, 23f, 5f, 20f, 13f);
        g.DrawLine(boltPen, 20f, 13f, 24f, 13f);
        g.DrawLine(boltPen, 24f, 13f, 21f, 20f);

        // Status indicator dot (bottom-right)
        using var statusBrush = new SolidBrush(statusColor);
        using var statusRing = new Pen(bgColor, 1.5f);
        g.FillEllipse(statusBrush, 23f, 23f, 6f, 6f);
        g.DrawEllipse(statusRing, 23f, 23f, 6f, 6f);

        var hIcon = bitmap.GetHicon();
        var newIcon = Icon.FromHandle(hIcon);
        var cloned = (Icon)newIcon.Clone();
        newIcon.Dispose();
        DestroyIcon(hIcon);
        return cloned;
    }

    private static Image CreateMenuIcon(MenuIconKind kind, Color accent)
    {
        var bitmap = new Bitmap(16, 16);
        using var g = Graphics.FromImage(bitmap);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g.Clear(Color.Transparent);

        using var pen = new Pen(accent, 1.7f)
        {
            StartCap = System.Drawing.Drawing2D.LineCap.Round,
            EndCap = System.Drawing.Drawing2D.LineCap.Round,
            LineJoin = System.Drawing.Drawing2D.LineJoin.Round
        };
        using var brush = new SolidBrush(accent);

        switch (kind)
        {
            case MenuIconKind.Brand:
                {
                    using var backgroundBrush = new SolidBrush(Color.FromArgb(18, 22, 32));
                    using var backgroundPen = new Pen(Color.FromArgb(40, 46, 64), 1f);
                    var rect = new Rectangle(2, 2, 12, 12);
                    var radius = new Size(4, 4);
                    g.FillRoundedRectangle(backgroundBrush, rect, radius);
                    g.DrawRoundedRectangle(backgroundPen, rect, radius);
                    g.DrawLine(pen, 5f, 4.25f, 5f, 11.75f);
                    g.DrawLine(pen, 5f, 8f, 10.5f, 4.25f);
                    g.DrawLine(pen, 5f, 8f, 10.5f, 11.75f);
                    break;
                }
            case MenuIconKind.Dashboard:
                g.DrawRectangle(pen, 3.5f, 4.5f, 5f, 7f);
                g.DrawLine(pen, 7f, 9f, 12f, 4f);
                g.DrawLine(pen, 9f, 4f, 12f, 4f);
                g.DrawLine(pen, 12f, 4f, 12f, 7f);
                break;
            case MenuIconKind.Resume:
                g.FillPolygon(brush, [new PointF(5f, 4f), new PointF(11.5f, 8f), new PointF(5f, 12f)]);
                break;
            case MenuIconKind.Pause:
                g.FillRectangle(brush, 4.25f, 4f, 2.25f, 8f);
                g.FillRectangle(brush, 9.5f, 4f, 2.25f, 8f);
                break;
            case MenuIconKind.Rules:
                {
                    using var path = new System.Drawing.Drawing2D.GraphicsPath();
                    path.AddLine(8f, 2.5f, 12f, 4.25f);
                    path.AddLine(12f, 4.25f, 12f, 7.5f);
                    path.AddBezier(12f, 9.75f, 12f, 12.25f, 9.75f, 13.5f, 8f, 14f);
                    path.AddBezier(6.25f, 13.5f, 4f, 12.25f, 4f, 9.75f, 4f, 7.5f);
                    path.AddLine(4f, 7.5f, 4f, 4.25f);
                    path.CloseFigure();
                    g.DrawPath(pen, path);
                    break;
                }
            case MenuIconKind.Typing:
                g.DrawRectangle(pen, 2.5f, 4.5f, 11f, 7f);
                g.DrawLine(pen, 5f, 8f, 11f, 8f);
                g.FillEllipse(brush, 4f, 6f, 1.5f, 1.5f);
                g.FillEllipse(brush, 7f, 6f, 1.5f, 1.5f);
                g.FillEllipse(brush, 10f, 6f, 1.5f, 1.5f);
                break;
            case MenuIconKind.Exit:
                g.DrawLine(pen, 4.5f, 4.5f, 11.5f, 11.5f);
                g.DrawLine(pen, 11.5f, 4.5f, 4.5f, 11.5f);
                break;
            case MenuIconKind.Active:
                g.FillEllipse(brush, 4.5f, 4.5f, 7f, 7f);
                break;
            case MenuIconKind.Inactive:
                g.DrawEllipse(pen, 4.5f, 4.5f, 7f, 7f);
                break;
        }

        return bitmap;
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed)
        {
            return;
        }

        if (disposing)
        {
            _blockingService.ShortcutEventOccurred -= OnShortcutEvent;
            _configStore.ConfigChanged -= OnConfigChanged;


            // Dispose all cloned menu item images (Bitmaps) before disposing NotifyIcon
            if (_notifyIcon.ContextMenuStrip is ContextMenuStrip menu)
            {
                foreach (ToolStripItem item in menu.Items)
                {
                    if (item.Image != null)
                    {
                        item.Image.Dispose();
                        item.Image = null;
                    }
                    // Also dispose images in dropdowns (for rulesItem, typingItem, etc.)
                    if (item is ToolStripMenuItem menuItem && menuItem.HasDropDownItems)
                    {
                        foreach (ToolStripItem subItem in menuItem.DropDownItems)
                        {
                            if (subItem.Image != null)
                            {
                                subItem.Image.Dispose();
                                subItem.Image = null;
                            }
                        }
                    }
                }
                // Dispose the ContextMenuStrip itself to release fonts and child resources
                menu.Dispose();
                _notifyIcon.ContextMenuStrip = null;
            }

            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            _uiInvoker.Dispose();
            _brandMenuIcon.Dispose();
            _dashboardMenuIcon.Dispose();
            _resumeMenuIcon.Dispose();
            _pauseMenuIcon.Dispose();
            _rulesMenuIcon.Dispose();
            _typingMenuIcon.Dispose();
            _exitMenuIcon.Dispose();
            _activeStatusMenuIcon.Dispose();
            _inactiveStatusMenuIcon.Dispose();
            _activeRuleMenuIcon.Dispose();
            _inactiveRuleMenuIcon.Dispose();
            _activeTypingMenuIcon.Dispose();
            _inactiveTypingMenuIcon.Dispose();
        }

        _disposed = true;
    }

    ~TrayIconManager() => Dispose(disposing: false);
}

internal enum MenuIconKind
{
    Brand,
    Dashboard,
    Resume,
    Pause,
    Rules,
    Typing,
    Exit,
    Active,
    Inactive
}

/// <summary>
/// Custom renderer for the tray context menu with a dark theme
/// and light-colored text for clear visibility.
/// </summary>
internal class DarkMenuRenderer : ToolStripProfessionalRenderer
{
    public DarkMenuRenderer() : base(new DarkColorTable()) { }

    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        if (e.Item is ToolStripMenuItem)
        {
            e.TextColor = e.Item.ForeColor;
        }
        base.OnRenderItemText(e);
    }

    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        var bounds = e.Item.ContentRectangle;
        using var pen = new Pen(Color.FromArgb(30, 35, 53));
        int y = bounds.Top + bounds.Height / 2;
        e.Graphics.DrawLine(pen, bounds.Left + 4, y, bounds.Right - 4, y);
    }

    protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
    {
        using var brush = new SolidBrush(Color.FromArgb(12, 15, 22));
        using var borderPen = new Pen(Color.FromArgb(26, 31, 45));
        var rect = new Rectangle(0, 0, Math.Max(24, e.ToolStrip.Padding.Left + 24), e.AffectedBounds.Height);
        e.Graphics.FillRectangle(brush, rect);
        e.Graphics.DrawLine(borderPen, rect.Right - 1, rect.Top, rect.Right - 1, rect.Bottom);
    }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        var rect = new Rectangle(2, 0, e.Item.Width - 4, e.Item.Height);
        if (e.Item.Selected && e.Item.Enabled)
        {
            using var brush = new SolidBrush(Color.FromArgb(22, 26, 38));
            e.Graphics.FillRectangle(brush, rect);
            // Amber left accent on hover
            using var accentPen = new Pen(Color.FromArgb(245, 158, 11), 2f);
            e.Graphics.DrawLine(accentPen, rect.Left, rect.Top + 2, rect.Left, rect.Bottom - 2);
        }
        else
        {
            using var brush = new SolidBrush(Color.FromArgb(10, 12, 16));
            e.Graphics.FillRectangle(brush, rect);
        }
    }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
    {
        using var brush = new SolidBrush(Color.FromArgb(10, 12, 16));
        e.Graphics.FillRectangle(brush, e.AffectedBounds);
    }

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        using var pen = new Pen(Color.FromArgb(30, 35, 53));
        var rect = new Rectangle(0, 0, e.AffectedBounds.Width - 1, e.AffectedBounds.Height - 1);
        e.Graphics.DrawRectangle(pen, rect);
    }

    protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
    {
        e.ArrowColor = Color.FromArgb(107, 115, 148);
        base.OnRenderArrow(e);
    }
}

internal class DarkColorTable : ProfessionalColorTable
{
    public override Color MenuBorder => Color.FromArgb(30, 35, 53);
    public override Color MenuItemBorder => Color.Transparent;
    public override Color MenuItemSelected => Color.FromArgb(22, 26, 38);
    public override Color MenuStripGradientBegin => Color.FromArgb(10, 12, 16);
    public override Color MenuStripGradientEnd => Color.FromArgb(10, 12, 16);
    public override Color MenuItemSelectedGradientBegin => Color.FromArgb(22, 26, 38);
    public override Color MenuItemSelectedGradientEnd => Color.FromArgb(22, 26, 38);
    public override Color MenuItemPressedGradientBegin => Color.FromArgb(15, 17, 22);
    public override Color MenuItemPressedGradientEnd => Color.FromArgb(15, 17, 22);
    public override Color ToolStripDropDownBackground => Color.FromArgb(10, 12, 16);
    public override Color ImageMarginGradientBegin => Color.FromArgb(10, 12, 16);
    public override Color ImageMarginGradientEnd => Color.FromArgb(10, 12, 16);
    public override Color ImageMarginGradientMiddle => Color.FromArgb(10, 12, 16);
    public override Color SeparatorDark => Color.FromArgb(30, 35, 53);
    public override Color SeparatorLight => Color.FromArgb(30, 35, 53);
}
