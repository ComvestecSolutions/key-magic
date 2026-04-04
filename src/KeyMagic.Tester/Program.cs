using System.Diagnostics;
using System.Runtime.InteropServices;

namespace KeyMagic.Tester;

/// <summary>
/// KeyMagic Key Tester : A standalone tool that detects and displays every
/// key press and key combination using a low-level keyboard hook.
/// No blocking : purely observation and logging.
/// </summary>
public static class Program
{
    [STAThread]
    public static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.Run(new TesterForm());
    }
}

public class TesterForm : Form
{
    // ─── Win32 ─────────────────────────────────────────────────────
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYUP = 0x0105;
    private const int LLKHF_ALTDOWN = 0x20;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public int vkCode;
        public int scanCode;
        public int flags;
        public int time;
        public IntPtr dwExtraInfo;
    }

    // ─── UI Controls ───────────────────────────────────────────────
    private readonly Label _comboLabel;
    private readonly Label _detailLabel;
    private readonly DataGridView _logGrid;
    private readonly Label _statusLabel;

    private IntPtr _hookId = IntPtr.Zero;
    private readonly LowLevelKeyboardProc _proc;
    private int _eventCount;

    public TesterForm()
    {
        _proc = HookCallback;

        // ── Form setup ─────────────────────────────────────────
        Text = "KeyMagic Tester : Key Detector";
        Size = new Size(780, 600);
        MinimumSize = new Size(600, 400);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(15, 17, 23);
        ForeColor = Color.FromArgb(226, 229, 235);
        Font = new Font("Segoe UI", 10);

        // ── Header panel ─────────────────────────────────────────
        var header = new Panel
        {
            Dock = DockStyle.Top,
            Height = 56,
            BackColor = Color.FromArgb(26, 30, 43),
            Padding = new Padding(16, 0, 16, 0)
        };
        var headerLabel = new Label
        {
            Text = "\U0001F6E1\uFE0F  KeyMagic Key Tester",
            Dock = DockStyle.Fill,
            ForeColor = Color.FromArgb(79, 140, 255),
            Font = new Font("Segoe UI", 14, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft
        };
        header.Controls.Add(headerLabel);
        Controls.Add(header);

        // ── Current combo display ─────────────────────────────────
        var comboPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 110,
            BackColor = Color.FromArgb(18, 21, 30),
            Padding = new Padding(24, 12, 24, 12)
        };

        var comboHint = new Label
        {
            Text = "DETECTED KEY / COMBO",
            Dock = DockStyle.Top,
            Height = 20,
            ForeColor = Color.FromArgb(107, 115, 148),
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
        };

        _comboLabel = new Label
        {
            Text = "Press any key...",
            Dock = DockStyle.Top,
            Height = 40,
            ForeColor = Color.FromArgb(79, 140, 255),
            Font = new Font("Cascadia Code", 22, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
        };

        _detailLabel = new Label
        {
            Text = "VK: : | Scan: : | Process: :",
            Dock = DockStyle.Top,
            Height = 22,
            ForeColor = Color.FromArgb(156, 163, 184),
            Font = new Font("Cascadia Code", 9),
        };

        comboPanel.Controls.Add(_detailLabel);
        comboPanel.Controls.Add(_comboLabel);
        comboPanel.Controls.Add(comboHint);
        Controls.Add(comboPanel);

        // ── Separator ────────────────────────────────────────────
        var sep = new Panel { Dock = DockStyle.Top, Height = 1, BackColor = Color.FromArgb(46, 51, 72) };
        Controls.Add(sep);

        // ── Button bar ───────────────────────────────────────────
        var btnPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 44,
            BackColor = Color.FromArgb(15, 17, 23),
            Padding = new Padding(24, 8, 24, 4)
        };

        var clearBtn = new Button
        {
            Text = "Clear Log",
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(35, 40, 56),
            ForeColor = Color.FromArgb(226, 229, 235),
            Size = new Size(100, 30),
            Cursor = Cursors.Hand
        };
        clearBtn.FlatAppearance.BorderColor = Color.FromArgb(46, 51, 72);
        btnPanel.Controls.Add(clearBtn);

        _statusLabel = new Label
        {
            Text = "Events: 0",
            Dock = DockStyle.Right,
            Width = 200,
            ForeColor = Color.FromArgb(156, 163, 184),
            Font = new Font("Segoe UI", 9),
            TextAlign = ContentAlignment.MiddleRight
        };
        btnPanel.Controls.Add(_statusLabel);
        Controls.Add(btnPanel);

        // ── Log grid ─────────────────────────────────────────────
        _logGrid = new DataGridView
        {
            Dock = DockStyle.Fill,
            BackgroundColor = Color.FromArgb(15, 17, 23),
            BorderStyle = BorderStyle.None,
            CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal,
            ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.Single,
            GridColor = Color.FromArgb(46, 51, 72),
            RowHeadersVisible = false,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            AllowUserToResizeRows = false,
            ReadOnly = true,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
            {
                BackColor = Color.FromArgb(26, 30, 43),
                ForeColor = Color.FromArgb(107, 115, 148),
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                SelectionBackColor = Color.FromArgb(26, 30, 43),
                SelectionForeColor = Color.FromArgb(107, 115, 148),
                Padding = new Padding(6, 4, 6, 4),
                Alignment = DataGridViewContentAlignment.MiddleLeft
            },
            DefaultCellStyle = new DataGridViewCellStyle
            {
                BackColor = Color.FromArgb(15, 17, 23),
                ForeColor = Color.FromArgb(226, 229, 235),
                SelectionBackColor = Color.FromArgb(35, 40, 56),
                SelectionForeColor = Color.FromArgb(226, 229, 235),
                Font = new Font("Cascadia Code", 9),
                Padding = new Padding(6, 3, 6, 3)
            },
            ColumnHeadersHeight = 36,
            RowTemplate = { Height = 30 },
            EnableHeadersVisualStyles = false
        };

        _logGrid.Columns.AddRange(new DataGridViewColumn[]
        {
            new DataGridViewTextBoxColumn { Name = "Time", HeaderText = "TIME", FillWeight = 12 },
            new DataGridViewTextBoxColumn { Name = "Type", HeaderText = "TYPE", FillWeight = 8 },
            new DataGridViewTextBoxColumn { Name = "Combo", HeaderText = "KEY / COMBO", FillWeight = 20 },
            new DataGridViewTextBoxColumn { Name = "VK", HeaderText = "VK CODE", FillWeight = 10 },
            new DataGridViewTextBoxColumn { Name = "Scan", HeaderText = "SCAN", FillWeight = 8 },
            new DataGridViewTextBoxColumn { Name = "Process", HeaderText = "FOREGROUND APP", FillWeight = 18 },
            new DataGridViewTextBoxColumn { Name = "Window", HeaderText = "WINDOW TITLE", FillWeight = 24 },
        });

        clearBtn.Click += (_, _) => { _logGrid.Rows.Clear(); _eventCount = 0; UpdateStatus(); };

        Controls.Add(_logGrid);

        // ── Install hook ─────────────────────────────────────────
        Load += (_, _) => InstallHook();
        FormClosing += (_, _) => UninstallHook();
    }

    private void InstallHook()
    {
        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule!;
        _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName!), 0);
        if (_hookId == IntPtr.Zero)
            MessageBox.Show("Failed to install keyboard hook!", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    private void UninstallHook()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        // CRITICAL: if an unhandled exception escapes an LL hook callback,
        // Windows silently removes the hook while _hookId stays set.
        // Wrapping in try/catch keeps the hook alive under all conditions.
        try
        {
            if (nCode >= 0)
            {
                var hs = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
                int msg = (int)wParam;

                bool isDown = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
                bool isUp = msg == WM_KEYUP || msg == WM_SYSKEYUP;

                if ((isDown || isUp) && !IsModifier(hs.vkCode))
                {
                    bool ctrl = (GetKeyState(0x11) & 0x8000) != 0;
                    bool shift = (GetKeyState(0x10) & 0x8000) != 0;
                    bool win = (GetKeyState(0x5B) & 0x8000) != 0 || (GetKeyState(0x5C) & 0x8000) != 0;
                    bool alt = (hs.flags & LLKHF_ALTDOWN) != 0 || (GetKeyState(0x12) & 0x8000) != 0;

                    string processName = "";
                    string windowTitle = "";
                    try
                    {
                        var hwnd = GetForegroundWindow();
                        if (hwnd != IntPtr.Zero)
                        {
                            GetWindowThreadProcessId(hwnd, out uint pid);
                            using var proc = Process.GetProcessById((int)pid);
                            processName = proc.ProcessName;
                            var sb = new System.Text.StringBuilder(256);
                            GetWindowText(hwnd, sb, sb.Capacity);
                            windowTitle = sb.ToString();
                        }
                    }
                    catch (Exception ex)
                    {
                        // Process may have exited between the foreground query and GetProcessById
                        Debug.WriteLine($"[Tester] Could not get foreground process info: {ex.Message}");
                    }

                    // Build display name
                    var parts = new List<string>();
                    if (ctrl) parts.Add("Ctrl");
                    if (alt) parts.Add("Alt");
                    if (shift) parts.Add("Shift");
                    if (win) parts.Add("Win");
                    parts.Add(VkName(hs.vkCode));
                    var combo = string.Join(" + ", parts);
                    var type = isDown ? "DOWN" : " UP ";

                    BeginInvoke(() =>
                    {
                        if (isDown)
                        {
                            _comboLabel.Text = combo;
                            _detailLabel.Text = $"VK: 0x{hs.vkCode:X2} ({hs.vkCode})  |  Scan: 0x{hs.scanCode:X2}  |  App: {processName}";
                        }

                        _logGrid.Rows.Insert(0, new object[]
                        {
                            DateTime.Now.ToString("HH:mm:ss.fff"),
                            type,
                            combo,
                            $"0x{hs.vkCode:X2}",
                            $"0x{hs.scanCode:X2}",
                            processName,
                            windowTitle.Length > 50 ? windowTitle[..50] + "..." : windowTitle
                        });

                        // Color the type cell
                        if (_logGrid.Rows.Count > 0)
                        {
                            var cell = _logGrid.Rows[0].Cells["Type"];
                            cell.Style.ForeColor = isDown
                                ? Color.FromArgb(79, 140, 255)
                                : Color.FromArgb(107, 115, 148);
                        }

                        // Cap at 500 rows
                        while (_logGrid.Rows.Count > 500)
                            _logGrid.Rows.RemoveAt(_logGrid.Rows.Count - 1);

                        _eventCount++;
                        UpdateStatus();
                    });
                }
            }
        }
        catch
        {
            // Swallow — never let an exception escape the hook callback.
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private void UpdateStatus()
    {
        _statusLabel.Text = $"Events: {_eventCount}  |  Rows: {_logGrid.Rows.Count}";
    }

    private static bool IsModifier(int vk) =>
        vk is 0x10 or 0x11 or 0x12 or 0xA0 or 0xA1 or 0xA2 or 0xA3 or 0xA4 or 0xA5 or 0x5B or 0x5C;

    private static string VkName(int vk) => vk switch
    {
        0x08 => "Backspace",
        0x09 => "Tab",
        0x0D => "Enter",
        0x1B => "Esc",
        0x20 => "Space",
        0x2C => "PrtSc",
        0x2D => "Insert",
        0x2E => "Delete",
        0x25 => "Left",
        0x26 => "Up",
        0x27 => "Right",
        0x28 => "Down",
        0x21 => "PgUp",
        0x22 => "PgDn",
        0x23 => "End",
        0x24 => "Home",
        0x13 => "Pause",
        0x14 => "CapsLock",
        0x90 => "NumLock",
        0x91 => "ScrLock",
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
        >= 0x60 and <= 0x69 => $"Num{vk - 0x60}",
        0x6A => "Num*",
        0x6B => "Num+",
        0x6D => "Num-",
        0x6E => "Num.",
        0x6F => "Num/",
        >= 0x30 and <= 0x39 => ((char)vk).ToString(),
        >= 0x41 and <= 0x5A => ((char)vk).ToString(),
        >= 0x70 and <= 0x7B => $"F{vk - 0x6F}",
        _ => $"0x{vk:X2}"
    };
}
