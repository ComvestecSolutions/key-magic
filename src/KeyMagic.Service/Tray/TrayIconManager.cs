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
    private readonly ConfigStore _configStore;
    private readonly ShortcutBlockingService _blockingService;
    private readonly int _dashboardPort;
    private readonly ILogger<TrayIconManager>? _logger;
    private bool _disposed;

    public TrayIconManager(ConfigStore configStore, ShortcutBlockingService blockingService, ILogger<TrayIconManager>? logger = null)
    {
        _configStore = configStore;
        _blockingService = blockingService;
        _dashboardPort = configStore.Config.WebDashboardPort;
        _logger = logger;

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
            // ConfigChanged fires from the web API background thread.
            // WinForms controls must only be accessed from the UI thread.
            if (_notifyIcon.ContextMenuStrip?.InvokeRequired == true)
            {
                _notifyIcon.ContextMenuStrip.BeginInvoke(() =>
                {
                    _notifyIcon.Visible = config.TrayIconVisible;
                    UpdateIcon();
                });
            }
            else
            {
                _notifyIcon.Visible = config.TrayIconVisible;
                UpdateIcon();
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to apply config change to tray icon");
        }
    }

    private ContextMenuStrip BuildContextMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Renderer = new DarkMenuRenderer();
        menu.BackColor = Color.FromArgb(24, 28, 39);
        menu.ForeColor = Color.FromArgb(226, 229, 235); // --text
        menu.ShowImageMargin = false;
        menu.Padding = new Padding(2, 4, 2, 4);

        // ── Header ──
        var headerItem = new ToolStripMenuItem("KeyMagic")
        {
            Enabled = false,
            Font = new Font("Segoe UI Semibold", 10, FontStyle.Bold),
            ForeColor = Color.FromArgb(79, 140, 255), // --accent
            Padding = new Padding(4, 6, 4, 6)
        };
        menu.Items.Add(headerItem);
        menu.Items.Add(CreateSeparator());

        // ── Toggle blocking ──
        var toggleItem = new ToolStripMenuItem(GetToggleText())
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(226, 229, 235),
            Padding = new Padding(4, 5, 4, 5)
        };
        toggleItem.Click += (_, _) =>
        {
            _configStore.ToggleGlobal();
            toggleItem.Text = GetToggleText();
            toggleItem.ForeColor = _configStore.Config.GlobalEnabled
                ? Color.FromArgb(248, 113, 113) // red for "Disable"
                : Color.FromArgb(52, 211, 153);  // green for "Enable"
            UpdateIcon();
        };
        menu.Items.Add(toggleItem);

        // ── Open dashboard ──
        var dashboardItem = new ToolStripMenuItem("Open Dashboard")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(226, 229, 235),
            Padding = new Padding(4, 5, 4, 5)
        };
        dashboardItem.Click += (_, _) => OpenDashboard();
        menu.Items.Add(dashboardItem);

        menu.Items.Add(CreateSeparator());

        // ── Rules submenu ──
        var rulesItem = new ToolStripMenuItem("Rules")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(156, 163, 184), // --text2
            Padding = new Padding(4, 5, 4, 5)
        };
        rulesItem.DropDown.BackColor = Color.FromArgb(24, 28, 39);
        menu.Items.Add(rulesItem);

        // Rebuild rules submenu dynamically
        menu.Opening += (_, _) =>
        {
            rulesItem.DropDownItems.Clear();
            toggleItem.Text = GetToggleText();
            toggleItem.ForeColor = _configStore.Config.GlobalEnabled
                ? Color.FromArgb(248, 113, 113)
                : Color.FromArgb(52, 211, 153);

            foreach (var rule in _configStore.Config.Rules)
            {
                var ruleItem = new ToolStripMenuItem(
                    $"{(rule.Enabled ? "\u2713" : "\u25CB")}  {rule.Shortcut.DisplayName} -> {rule.Description}")
                {
                    Font = new Font("Segoe UI", 9f),
                    ForeColor = rule.Enabled
                        ? Color.FromArgb(52, 211, 153)
                        : Color.FromArgb(107, 115, 148), // --text3
                    BackColor = Color.FromArgb(24, 28, 39),
                    Padding = new Padding(4, 3, 4, 3)
                };
                var ruleId = rule.Id;
                ruleItem.Click += (_, _) =>
                {
                    _configStore.ToggleRule(ruleId);
                };
                rulesItem.DropDownItems.Add(ruleItem);
            }

            if (rulesItem.DropDownItems.Count == 0)
            {
                rulesItem.DropDownItems.Add(new ToolStripMenuItem("(no rules configured)")
                {
                    Enabled = false,
                    ForeColor = Color.FromArgb(107, 115, 148),
                    BackColor = Color.FromArgb(24, 28, 39)
                });
            }
        };

        menu.Items.Add(CreateSeparator());

        // ── Exit ──
        var exitItem = new ToolStripMenuItem("Exit KeyMagic")
        {
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(248, 113, 113), // --red
            Padding = new Padding(4, 5, 4, 5)
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
        sep.ForeColor = Color.FromArgb(46, 51, 72);   // --border
        sep.BackColor = Color.FromArgb(24, 28, 39);
        return sep;
    }

    private string GetToggleText()
    {
        return _configStore.Config.GlobalEnabled
            ? "\u25CF  Disable Blocking"
            : "\u25CF  Enable Blocking";
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

        using var shadowBrush = new SolidBrush(Color.FromArgb(68, 0, 0, 0));
        g.FillEllipse(shadowBrush, 6, 24, 18, 4);

        var shellStart = active ? Color.FromArgb(255, 203, 141) : Color.FromArgb(177, 183, 195);
        var shellEnd = active ? Color.FromArgb(255, 153, 84) : Color.FromArgb(108, 115, 131);
        var borderColor = active ? Color.FromArgb(255, 231, 196) : Color.FromArgb(203, 207, 216);
        var keyLineColor = active ? Color.FromArgb(244, 241, 233) : Color.FromArgb(220, 223, 229);
        var sparkColor = active ? Color.FromArgb(118, 183, 255) : Color.FromArgb(153, 170, 194);
        var statusColor = active ? Color.FromArgb(111, 227, 181) : Color.FromArgb(142, 148, 160);

        using var outerPath = CreateRoundedRectanglePath(new RectangleF(4.5f, 5.5f, 20f, 18f), 5.5f);
        using var outerBrush = new System.Drawing.Drawing2D.LinearGradientBrush(
            new PointF(4.5f, 5.5f),
            new PointF(24.5f, 23.5f),
            shellStart,
            shellEnd);
        g.FillPath(outerBrush, outerPath);

        using var borderPen = new Pen(borderColor, 1.15f);
        g.DrawPath(borderPen, outerPath);

        using var innerPath = CreateRoundedRectanglePath(new RectangleF(6.75f, 8f, 15.5f, 11.25f), 4f);
        using var innerBrush = new SolidBrush(Color.FromArgb(25, 30, 41));
        g.FillPath(innerBrush, innerPath);

        using var highlightPen = new Pen(Color.FromArgb(active ? 210 : 150, 255, 255, 255), 1f);
        g.DrawLine(highlightPen, 8.5f, 9.4f, 18.75f, 9.4f);

        using var keyPen = new Pen(keyLineColor, 1.7f)
        {
            StartCap = System.Drawing.Drawing2D.LineCap.Round,
            EndCap = System.Drawing.Drawing2D.LineCap.Round,
            LineJoin = System.Drawing.Drawing2D.LineJoin.Round
        };
        g.DrawLine(keyPen, 11f, 10.9f, 11f, 17.7f);
        g.DrawLine(keyPen, 11f, 14.2f, 15.8f, 10.8f);
        g.DrawLine(keyPen, 11f, 14.2f, 15.8f, 18.1f);

        using var sparkPen = new Pen(sparkColor, 1.55f)
        {
            StartCap = System.Drawing.Drawing2D.LineCap.Round,
            EndCap = System.Drawing.Drawing2D.LineCap.Round
        };
        g.DrawLine(sparkPen, 24.6f, 5.8f, 24.6f, 11f);
        g.DrawLine(sparkPen, 22f, 8.4f, 27.2f, 8.4f);
        g.DrawLine(sparkPen, 22.9f, 6.6f, 26.3f, 10.1f);
        g.DrawLine(sparkPen, 22.9f, 10.1f, 26.3f, 6.6f);

        using var statusBrush = new SolidBrush(statusColor);
        using var statusRing = new Pen(Color.FromArgb(28, 33, 45), 1f);
        g.FillEllipse(statusBrush, 22f, 20.8f, 6f, 6f);
        g.DrawEllipse(statusRing, 22f, 20.8f, 6f, 6f);

        var hIcon = bitmap.GetHicon();
        var newIcon = Icon.FromHandle(hIcon);
        // Clone so the Icon owns its own handle and we can free the original
        var cloned = (Icon)newIcon.Clone();
        newIcon.Dispose();
        DestroyIcon(hIcon);
        return cloned;
    }

    private static System.Drawing.Drawing2D.GraphicsPath CreateRoundedRectanglePath(RectangleF rectangle, float radius)
    {
        var diameter = radius * 2;
        var path = new System.Drawing.Drawing2D.GraphicsPath();

        path.AddArc(rectangle.X, rectangle.Y, diameter, diameter, 180, 90);
        path.AddArc(rectangle.Right - diameter, rectangle.Y, diameter, diameter, 270, 90);
        path.AddArc(rectangle.Right - diameter, rectangle.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(rectangle.X, rectangle.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();

        return path;
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _blockingService.ShortcutEventOccurred -= OnShortcutEvent;
            _configStore.ConfigChanged -= OnConfigChanged;
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            _disposed = true;
        }
        GC.SuppressFinalize(this);
    }

    ~TrayIconManager() => Dispose();
}

/// <summary>
/// Custom renderer for the tray context menu with a dark theme
/// and light-colored text for clear visibility.
/// </summary>
internal class DarkMenuRenderer : ToolStripProfessionalRenderer
{
    public DarkMenuRenderer() : base(new DarkColorTable()) { }

    // Override text painting to ensure light text on dark background
    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        if (e.Item is ToolStripMenuItem)
        {
            e.TextColor = e.Item.ForeColor;
        }
        base.OnRenderItemText(e);
    }

    // Custom separator with visible line
    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        var bounds = e.Item.ContentRectangle;
        using var pen = new Pen(Color.FromArgb(46, 51, 72));
        int y = bounds.Top + bounds.Height / 2;
        e.Graphics.DrawLine(pen, bounds.Left + 4, y, bounds.Right - 4, y);
    }

    // Hover background
    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        var rect = new Rectangle(2, 0, e.Item.Width - 4, e.Item.Height);
        if (e.Item.Selected && e.Item.Enabled)
        {
            using var brush = new SolidBrush(Color.FromArgb(44, 49, 69));
            using var roundPath = RoundRect(rect, 4);
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            e.Graphics.FillPath(brush, roundPath);
        }
        else
        {
            using var brush = new SolidBrush(Color.FromArgb(24, 28, 39));
            e.Graphics.FillRectangle(brush, rect);
        }
    }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
    {
        using var brush = new SolidBrush(Color.FromArgb(24, 28, 39));
        e.Graphics.FillRectangle(brush, e.AffectedBounds);
    }

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        using var pen = new Pen(Color.FromArgb(46, 51, 72));
        var rect = new Rectangle(0, 0, e.AffectedBounds.Width - 1, e.AffectedBounds.Height - 1);
        using var path = RoundRect(rect, 6);
        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        e.Graphics.DrawPath(pen, path);
    }

    private static System.Drawing.Drawing2D.GraphicsPath RoundRect(Rectangle r, int radius)
    {
        var path = new System.Drawing.Drawing2D.GraphicsPath();
        int d = radius * 2;
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}

/// <summary>Dark color scheme for the tray context menu.</summary>
internal class DarkColorTable : ProfessionalColorTable
{
    public override Color MenuBorder => Color.FromArgb(46, 51, 72);
    public override Color MenuItemBorder => Color.Transparent;
    public override Color MenuItemSelected => Color.FromArgb(44, 49, 69);
    public override Color MenuStripGradientBegin => Color.FromArgb(24, 28, 39);
    public override Color MenuStripGradientEnd => Color.FromArgb(24, 28, 39);
    public override Color MenuItemSelectedGradientBegin => Color.FromArgb(44, 49, 69);
    public override Color MenuItemSelectedGradientEnd => Color.FromArgb(44, 49, 69);
    public override Color MenuItemPressedGradientBegin => Color.FromArgb(35, 39, 52);
    public override Color MenuItemPressedGradientEnd => Color.FromArgb(35, 39, 52);
    public override Color ToolStripDropDownBackground => Color.FromArgb(24, 28, 39);
    public override Color ImageMarginGradientBegin => Color.FromArgb(24, 28, 39);
    public override Color ImageMarginGradientEnd => Color.FromArgb(24, 28, 39);
    public override Color ImageMarginGradientMiddle => Color.FromArgb(24, 28, 39);
    public override Color SeparatorDark => Color.FromArgb(46, 51, 72);
    public override Color SeparatorLight => Color.FromArgb(46, 51, 72);
}
