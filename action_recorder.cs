using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
using System.Collections.Generic;

class ActionRecorder : Form
{
    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_RBUTTONUP = 0x0205;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_MOUSEWHEEL = 0x020A;
    private const int WM_MOUSEMOVE = 0x0200;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;

    private IntPtr mouseHook = IntPtr.Zero;
    private IntPtr kbHook = IntPtr.Zero;
    private LowLevelMouseProc mouseProc;
    private LowLevelKeyboardProc kbProc;
    private int actionCount = 0;
    private string baseDir, logPath, cropDir, fullDir;
    private Label statusLabel;
    private Timer screenshotTimer;
    private int fullScreenCount = 0;

    private bool isDragging = false;
    private Point dragStart;
    private DateTime dragStartTime;
    private string lastWindow = "";
    private DateTime lastFullScreenshot = DateTime.MinValue;
    private HashSet<Keys> heldKeys = new HashSet<Keys>();
    private DateTime lastActionTime = DateTime.Now;
    private Point lastMousePos = Point.Empty;

    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LowLevelMouseProc cb, IntPtr hMod, uint tid);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LowLevelKeyboardProc cb, IntPtr hMod, uint tid);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hk);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hk, int n, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder t, int c);
    [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder t, int c);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromPoint(POINT p, [MarshalAs(UnmanagedType.Interface)] out object acc, out object child);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    delegate IntPtr LowLevelMouseProc(int n, IntPtr w, IntPtr l);
    delegate IntPtr LowLevelKeyboardProc(int n, IntPtr w, IntPtr l);

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public IntPtr extra; }

    public ActionRecorder()
    {
        baseDir = @"C:\Users\Aiden\Desktop\Lamby\recordings";
        string session = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        string sessionDir = Path.Combine(baseDir, "session_" + session);
        Directory.CreateDirectory(sessionDir);
        cropDir = Path.Combine(sessionDir, "crops");
        fullDir = Path.Combine(sessionDir, "full");
        Directory.CreateDirectory(cropDir);
        Directory.CreateDirectory(fullDir);
        logPath = Path.Combine(sessionDir, "actions.log");

        var header = new StringBuilder();
        header.AppendLine("╔══════════════════════════════════════════════════════════════════╗");
        header.AppendLine("║          ACTION RECORDER — SESSION " + session + "            ║");
        header.AppendLine("║  All coordinates are LOGICAL (matches hw.exe / overlay grid)    ║");
        header.AppendLine("║  Screen: 1536x864 logical (3840x2160 physical, DPI 2.5)         ║");
        header.AppendLine("╚══════════════════════════════════════════════════════════════════╝");
        header.AppendLine();
        File.WriteAllText(logPath, header.ToString());

        TakeFullScreenshot("session_start");

        this.Text = "Action Recorder — RECORDING (ESC to stop)";
        this.Size = new Size(420, 60);
        this.TopMost = true;
        this.FormBorderStyle = FormBorderStyle.FixedToolWindow;
        this.StartPosition = FormStartPosition.Manual;
        this.Location = new Point(5, 5);
        this.BackColor = Color.FromArgb(20, 20, 20);
        this.Opacity = 0.92;
        this.ShowInTaskbar = false;

        statusLabel = new Label();
        statusLabel.Text = "● RECORDING — use the app normally. ESC to stop.";
        statusLabel.ForeColor = Color.FromArgb(255, 80, 80);
        statusLabel.Font = new Font("Consolas", 9, FontStyle.Bold);
        statusLabel.Dock = DockStyle.Fill;
        statusLabel.TextAlign = ContentAlignment.MiddleCenter;
        this.Controls.Add(statusLabel);

        this.KeyPreview = true;
        this.KeyDown += (s, e) => { if (e.KeyCode == Keys.Escape) { Stop(); Close(); } };

        screenshotTimer = new Timer();
        screenshotTimer.Interval = 8000;
        screenshotTimer.Tick += (s, e) => {
            string curWin = GetActiveWindowTitle();
            if (curWin != lastWindow || (DateTime.Now - lastFullScreenshot).TotalSeconds > 15)
            {
                TakeFullScreenshot("periodic_" + fullScreenCount);
                lastWindow = curWin;
            }
        };
        screenshotTimer.Start();

        mouseProc = MouseHookCB;
        kbProc = KbHookCB;
        using (var p = System.Diagnostics.Process.GetCurrentProcess())
        using (var m = p.MainModule)
        {
            IntPtr hMod = GetModuleHandle(m.ModuleName);
            mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, hMod, 0);
            kbHook = SetWindowsHookEx(WH_KEYBOARD_LL, kbProc, hMod, 0);
        }
    }

    string GetActiveWindowTitle()
    {
        IntPtr fg = GetForegroundWindow();
        var sb = new StringBuilder(256);
        GetWindowText(fg, sb, 256);
        return sb.ToString();
    }

    string GetModifiers()
    {
        var mods = new List<string>();
        if ((GetAsyncKeyState(0x11) & 0x8000) != 0) mods.Add("Ctrl");
        if ((GetAsyncKeyState(0x10) & 0x8000) != 0) mods.Add("Shift");
        if ((GetAsyncKeyState(0x12) & 0x8000) != 0) mods.Add("Alt");
        if ((GetAsyncKeyState(0x5B) & 0x8000) != 0) mods.Add("Win");
        return mods.Count > 0 ? string.Join("+", mods) : "none";
    }

    ElementInfo GetElementAt(int x, int y)
    {
        var info = new ElementInfo();
        try
        {
            IntPtr fg = GetForegroundWindow();
            var tb = new StringBuilder(256); GetWindowText(fg, tb, 256); info.WindowTitle = tb.ToString();
            var cb = new StringBuilder(256); GetClassName(fg, cb, 256); info.WindowClass = cb.ToString();
            RECT wr; GetWindowRect(fg, out wr);
            info.RelX = x - wr.Left; info.RelY = y - wr.Top;
            info.WinRect = string.Format("({0},{1})-({2},{3})", wr.Left, wr.Top, wr.Right, wr.Bottom);

            uint pid = 0;
            GetWindowThreadProcessId(fg, out pid);
            try { info.ProcessName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { info.ProcessName = "?"; }

            POINT pt = new POINT { X = x, Y = y };
            IntPtr wuc = WindowFromPoint(pt);
            var ucb = new StringBuilder(256); GetClassName(wuc, ucb, 256); info.CtrlClass = ucb.ToString();
            var utb = new StringBuilder(256); GetWindowText(wuc, utb, 256); info.CtrlText = utb.ToString();

            object acc, cid;
            if (AccessibleObjectFromPoint(pt, out acc, out cid) == 0 && acc != null)
            {
                dynamic a = acc;
                try { info.ElemName = a.accName[cid] ?? ""; } catch {}
                try { object r = a.accRole[cid]; info.ElemRole = r != null ? RoleName((int)r) : ""; } catch {}
                try { info.ElemValue = a.accValue[cid] ?? ""; } catch {}
                try { info.ElemDesc = a.accDescription[cid] ?? ""; } catch {}
                try
                {
                    object state = a.accState[cid];
                    if (state != null) info.ElemState = DecodeState((int)state);
                } catch {}
                Marshal.ReleaseComObject(acc);
            }
        }
        catch {}
        return info;
    }

    string TakeCrop(int x, int y, string prefix)
    {
        try
        {
            int cs = 150;
            int sx = Math.Max(0, x - cs / 2), sy = Math.Max(0, y - cs / 2);
            string fname = prefix + "_" + actionCount.ToString("D4") + ".png";
            using (var bmp = new Bitmap(cs, cs))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(sx, sy, 0, 0, new Size(cs, cs));
                    using (var pen = new Pen(Color.Red, 2))
                    {
                        g.DrawLine(pen, cs/2-12, cs/2, cs/2+12, cs/2);
                        g.DrawLine(pen, cs/2, cs/2-12, cs/2, cs/2+12);
                        g.DrawEllipse(pen, cs/2-6, cs/2-6, 12, 12);
                    }
                    using (var f = new Font("Arial", 8, FontStyle.Bold))
                    using (var br = new SolidBrush(Color.Yellow))
                    using (var bg = new SolidBrush(Color.FromArgb(180, 0, 0, 0)))
                    {
                        string label = "#" + actionCount;
                        var sz = g.MeasureString(label, f);
                        g.FillRectangle(bg, 1, 1, sz.Width + 2, sz.Height);
                        g.DrawString(label, f, br, 2, 1);
                    }
                }
                bmp.Save(Path.Combine(cropDir, fname), ImageFormat.Png);
            }
            return fname;
        }
        catch { return "FAILED"; }
    }

    void TakeFullScreenshot(string tag)
    {
        try
        {
            fullScreenCount++;
            var scr = Screen.PrimaryScreen.Bounds;
            string fname = "full_" + fullScreenCount.ToString("D3") + "_" + tag + ".png";
            using (var bmp = new Bitmap(scr.Width, scr.Height))
            {
                using (var g = Graphics.FromImage(bmp))
                    g.CopyFromScreen(0, 0, 0, 0, scr.Size);
                bmp.Save(Path.Combine(fullDir, fname), ImageFormat.Png);
            }
            lastFullScreenshot = DateTime.Now;
        }
        catch {}
    }

    void LogAction(string actionType, string details)
    {
        actionCount++;
        var sb = new StringBuilder();
        sb.AppendLine("┌─ Action #" + actionCount + " ─── " + actionType + " ─── " + DateTime.Now.ToString("HH:mm:ss.fff") + " ───");
        sb.Append(details);
        sb.AppendLine("└" + new string('─', 70));
        sb.AppendLine();
        File.AppendAllText(logPath, sb.ToString());

        try { this.BeginInvoke((Action)(() => {
            this.Text = "Action Recorder — " + actionCount + " actions (ESC to stop)";
            statusLabel.Text = "● #" + actionCount + " " + actionType;
        })); } catch {}
    }

    private IntPtr MouseHookCB(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var hs = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
            int x = hs.pt.X, y = hs.pt.Y;
            int msg = (int)wParam;

            if (msg == WM_LBUTTONDOWN)
            {
                isDragging = true;
                dragStart = new Point(x, y);
                dragStartTime = DateTime.Now;
                lastMousePos = new Point(x, y);
            }
            else if (msg == WM_LBUTTONUP)
            {
                if (isDragging)
                {
                    isDragging = false;
                    int dist = (int)Math.Sqrt(Math.Pow(x - dragStart.X, 2) + Math.Pow(y - dragStart.Y, 2));
                    double duration = (DateTime.Now - dragStartTime).TotalMilliseconds;

                    if (dist > 8)
                    {
                        var startInfo = GetElementAt(dragStart.X, dragStart.Y);
                        var endInfo = GetElementAt(x, y);
                        string cropStart = TakeCrop(dragStart.X, dragStart.Y, "drag_start");
                        string cropEnd = TakeCrop(x, y, "drag_end");
                        TakeFullScreenshot("after_drag");

                        var sb = new StringBuilder();
                        sb.AppendLine("│  DRAG from (" + dragStart.X + "," + dragStart.Y + ") to (" + x + "," + y + ")");
                        sb.AppendLine("│  Distance: " + dist + "px  Duration: " + duration.ToString("F0") + "ms");
                        sb.AppendLine("│  Modifiers: " + GetModifiers());
                        sb.AppendLine("│  App: \"" + startInfo.WindowTitle + "\" [" + startInfo.ProcessName + "]");
                        sb.AppendLine("│  Start element: \"" + startInfo.ElemName + "\" (" + startInfo.ElemRole + ")  Rel:(" + startInfo.RelX + "," + startInfo.RelY + ")");
                        sb.AppendLine("│  End element: \"" + endInfo.ElemName + "\" (" + endInfo.ElemRole + ")  Rel:(" + endInfo.RelX + "," + endInfo.RelY + ")");
                        sb.AppendLine("│  Crops: " + cropStart + " → " + cropEnd);
                        LogAction("DRAG", sb.ToString());
                    }
                    else
                    {
                        var info = GetElementAt(x, y);
                        string crop = TakeCrop(x, y, "click");
                        TakeFullScreenshot("after_click");

                        var sb = new StringBuilder();
                        sb.AppendLine("│  LEFT CLICK at (" + x + "," + y + ")");
                        sb.AppendLine("│  Modifiers: " + GetModifiers());
                        sb.AppendLine("│  App: \"" + info.WindowTitle + "\" [" + info.ProcessName + "]  Class: " + info.WindowClass);
                        sb.AppendLine("│  Window rect: " + info.WinRect + "  Relative pos: (" + info.RelX + "," + info.RelY + ")");
                        sb.AppendLine("│  Control: \"" + info.CtrlText + "\" [" + info.CtrlClass + "]");
                        sb.AppendLine("│  UI Element: \"" + info.ElemName + "\"");
                        sb.AppendLine("│  Role: " + info.ElemRole + "  State: " + info.ElemState);
                        if (!string.IsNullOrEmpty(info.ElemValue)) sb.AppendLine("│  Value: " + info.ElemValue);
                        if (!string.IsNullOrEmpty(info.ElemDesc)) sb.AppendLine("│  Description: " + info.ElemDesc);
                        sb.AppendLine("│  Crop: " + crop);
                        LogAction("LEFT_CLICK", sb.ToString());
                    }
                }
            }
            else if (msg == WM_RBUTTONDOWN)
            {
                var info = GetElementAt(x, y);
                string crop = TakeCrop(x, y, "rclick");
                TakeFullScreenshot("after_rclick");

                var sb = new StringBuilder();
                sb.AppendLine("│  RIGHT CLICK at (" + x + "," + y + ")");
                sb.AppendLine("│  App: \"" + info.WindowTitle + "\" [" + info.ProcessName + "]");
                sb.AppendLine("│  UI Element: \"" + info.ElemName + "\" (" + info.ElemRole + ")  Rel:(" + info.RelX + "," + info.RelY + ")");
                sb.AppendLine("│  Crop: " + crop);
                LogAction("RIGHT_CLICK", sb.ToString());
            }
            else if (msg == WM_MBUTTONDOWN)
            {
                var info = GetElementAt(x, y);
                var sb = new StringBuilder();
                sb.AppendLine("│  MIDDLE CLICK at (" + x + "," + y + ")");
                sb.AppendLine("│  App: \"" + info.WindowTitle + "\" [" + info.ProcessName + "]");
                LogAction("MIDDLE_CLICK", sb.ToString());
            }
            else if (msg == WM_MOUSEWHEEL)
            {
                short delta = (short)(hs.mouseData >> 16);
                string dir = delta > 0 ? "UP" : "DOWN";
                var info = GetElementAt(x, y);
                var sb = new StringBuilder();
                sb.AppendLine("│  SCROLL " + dir + " (delta=" + delta + ") at (" + x + "," + y + ")");
                sb.AppendLine("│  App: \"" + info.WindowTitle + "\" [" + info.ProcessName + "]");
                sb.AppendLine("│  Element: \"" + info.ElemName + "\" (" + info.ElemRole + ")");
                LogAction("SCROLL_" + dir, sb.ToString());
            }
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    private IntPtr KbHookCB(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var hs = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
            int msg = (int)wParam;
            Keys key = (Keys)hs.vkCode;

            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
            {
                if (key == Keys.Escape && this.Focused) { return CallNextHookEx(kbHook, nCode, wParam, lParam); }

                bool isModifier = key == Keys.LShiftKey || key == Keys.RShiftKey ||
                                  key == Keys.LControlKey || key == Keys.RControlKey ||
                                  key == Keys.LMenu || key == Keys.RMenu ||
                                  key == Keys.LWin || key == Keys.RWin ||
                                  key == Keys.ShiftKey || key == Keys.ControlKey || key == Keys.Menu;

                if (!isModifier && !heldKeys.Contains(key))
                {
                    heldKeys.Add(key);
                    string mods = GetModifiers();
                    string keyName = key.ToString();
                    string combo = mods != "none" ? mods + "+" + keyName : keyName;
                    string winTitle = GetActiveWindowTitle();

                    var sb = new StringBuilder();
                    sb.AppendLine("│  KEY: " + combo + "  (VK=" + hs.vkCode + ")");
                    sb.AppendLine("│  App: \"" + winTitle + "\"");

                    if (mods != "none")
                    {
                        TakeFullScreenshot("after_shortcut");
                    }

                    LogAction("KEY_PRESS", sb.ToString());
                }
            }
            else if (msg == WM_KEYUP)
            {
                heldKeys.Remove(key);
            }
        }
        return CallNextHookEx(kbHook, nCode, wParam, lParam);
    }

    void Stop()
    {
        if (screenshotTimer != null) screenshotTimer.Stop();
        if (mouseHook != IntPtr.Zero) { UnhookWindowsHookEx(mouseHook); mouseHook = IntPtr.Zero; }
        if (kbHook != IntPtr.Zero) { UnhookWindowsHookEx(kbHook); kbHook = IntPtr.Zero; }
        TakeFullScreenshot("session_end");

        var footer = new StringBuilder();
        footer.AppendLine();
        footer.AppendLine("╔══════════════════════════════════════════════════════════════════╗");
        footer.AppendLine("║  SESSION COMPLETE — " + actionCount + " actions recorded");
        footer.AppendLine("║  " + fullScreenCount + " full screenshots, crops in /crops/");
        footer.AppendLine("║  Stopped: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
        footer.AppendLine("╚══════════════════════════════════════════════════════════════════╝");
        File.AppendAllText(logPath, footer.ToString());
    }

    protected override void OnFormClosing(FormClosingEventArgs e) { Stop(); base.OnFormClosing(e); }

    static string RoleName(int r)
    {
        switch(r)
        {
            case 0x09: return "PushButton"; case 0x0A: return "CheckButton"; case 0x0B: return "RadioButton";
            case 0x0C: return "ComboBox"; case 0x0D: return "DropDown"; case 0x0E: return "Edit";
            case 0x19: return "Grouping"; case 0x21: return "ToolBar"; case 0x22: return "StatusBar";
            case 0x25: return "MenuItem"; case 0x26: return "MenuPopup"; case 0x2B: return "Pane";
            case 0x2C: return "ScrollBar"; case 0x33: return "ListItem"; case 0x34: return "Graphic";
            case 0x37: return "PageTabList"; case 0x39: return "Text"; case 0x3A: return "Client";
            case 0x3B: return "TitleBar"; case 0x3D: return "Window"; case 0x38: return "PageTab";
            case 0x1C: return "SplitButton"; case 0x2E: return "Document";
            default: return "role_" + r;
        }
    }

    static string DecodeState(int s)
    {
        var states = new List<string>();
        if ((s & 0x1) != 0) states.Add("unavailable");
        if ((s & 0x2) != 0) states.Add("selected");
        if ((s & 0x4) != 0) states.Add("focused");
        if ((s & 0x8) != 0) states.Add("pressed");
        if ((s & 0x10) != 0) states.Add("checked");
        if ((s & 0x100000) != 0) states.Add("collapsed");
        if ((s & 0x200) != 0) states.Add("expanded");
        if ((s & 0x8000) != 0) states.Add("invisible");
        if ((s & 0x10000) != 0) states.Add("offscreen");
        return states.Count > 0 ? string.Join(",", states) : "normal";
    }

    struct ElementInfo
    {
        public string WindowTitle, WindowClass, ProcessName, WinRect;
        public int RelX, RelY;
        public string CtrlClass, CtrlText;
        public string ElemName, ElemRole, ElemValue, ElemDesc, ElemState;
    }

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.Run(new ActionRecorder());
    }
}
