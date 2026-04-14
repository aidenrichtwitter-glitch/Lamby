using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.Runtime.InteropServices;

public class GridOverlay : Form {
  [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern bool GetPhysicalCursorPos(out POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  int step; int gridOpacity;
  Timer cursorTimer;
  Point lastCursor = Point.Empty;
  Point lastPhysCursor = Point.Empty;
  Bitmap gridBmp;

  public GridOverlay(int s, int op) {
    SetProcessDPIAware();
    step = s; gridOpacity = op;
    Text = "LambyGridOverlay";
    FormBorderStyle = FormBorderStyle.None;
    StartPosition = FormStartPosition.Manual;
    var scr = Screen.PrimaryScreen.Bounds;
    Location = new Point(0, 0);
    Size = new Size(scr.Width, scr.Height);
    TopMost = true; ShowInTaskbar = false;
    BackColor = Color.Magenta;
    TransparencyKey = Color.Magenta;
    SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
  }

  protected override void OnLoad(EventArgs e) {
    base.OnLoad(e);
    int ex = GetWindowLong(Handle, -20);
    SetWindowLong(Handle, -20, ex | 0x80000 | 0x20 | 0x8 | 0x80);
    RenderGridBitmap();
    cursorTimer = new Timer();
    cursorTimer.Interval = 50;
    cursorTimer.Tick += (s2, e2) => {
      POINT p; GetCursorPos(out p);
      POINT pp; GetPhysicalCursorPos(out pp);
      var cp = new Point(p.X, p.Y);
      var cpp = new Point(pp.X, pp.Y);
      if (cp != lastCursor) { lastCursor = cp; lastPhysCursor = cpp; Invalidate(); }
    };
    cursorTimer.Start();
  }

  void RenderGridBitmap() {
    var scr = Screen.PrimaryScreen.Bounds;
    int w = scr.Width, h = scr.Height;
    gridBmp = new Bitmap(w, h);
    using (var g = Graphics.FromImage(gridBmp)) {
      g.Clear(Color.Magenta);
      int labEvery = step <= 100 ? 4 : 2;
      using (var pen = new Pen(Color.FromArgb(gridOpacity, 0, 255, 0), 1))
      using (var penMaj = new Pen(Color.FromArgb(Math.Min(gridOpacity + 60, 255), 0, 255, 100), 2))
      using (var font = new Font("Consolas", 11, FontStyle.Bold))
      using (var brush = new SolidBrush(Color.FromArgb(200, 0, 255, 100)))
      using (var bg = new SolidBrush(Color.FromArgb(140, 0, 0, 0))) {
        for (int physX = 0; physX <= w; physX += step) {
          bool isMaj = (physX % (step * labEvery)) == 0;
          g.DrawLine(isMaj ? penMaj : pen, physX, 0, physX, h);
          if (isMaj) {
            string t = physX.ToString();
            var sz = g.MeasureString(t, font);
            g.FillRectangle(bg, physX + 2, 2, sz.Width, sz.Height);
            g.DrawString(t, font, brush, physX + 2, 2);
          }
        }
        for (int physY = 0; physY <= h; physY += step) {
          bool isMaj = (physY % (step * labEvery)) == 0;
          g.DrawLine(isMaj ? penMaj : pen, 0, physY, w, physY);
          if (isMaj) {
            string t = physY.ToString();
            var sz = g.MeasureString(t, font);
            g.FillRectangle(bg, 2, physY + 2, sz.Width, sz.Height);
            g.DrawString(t, font, brush, 2, physY + 2);
          }
        }
      }
    }
  }

  protected override void OnPaint(PaintEventArgs e) {
    var g = e.Graphics;
    g.DrawImageUnscaled(gridBmp, 0, 0);
    if (lastCursor != Point.Empty) {
      int cx = lastCursor.X, cy = lastCursor.Y;
      int scrW = Screen.PrimaryScreen.Bounds.Width;
      int scrH = Screen.PrimaryScreen.Bounds.Height;
      using (var crossPen = new Pen(Color.FromArgb(180, 255, 255, 0), 1)) {
        crossPen.DashStyle = DashStyle.Dash;
        g.DrawLine(crossPen, cx, 0, cx, scrH);
        g.DrawLine(crossPen, 0, cy, scrW, cy);
      }
      int px = lastPhysCursor.X, py = lastPhysCursor.Y;
      string label = "(" + px + ", " + py + ")";
      using (var font = new Font("Consolas", 13, FontStyle.Bold))
      using (var brush = new SolidBrush(Color.FromArgb(255, 255, 255, 0)))
      using (var bg = new SolidBrush(Color.FromArgb(200, 0, 0, 0)))
      using (var outline = new Pen(Color.FromArgb(200, 0, 0, 0), 3)) {
        var sz = g.MeasureString(label, font);
        int lx = Math.Min(cx + 18, scrW - (int)sz.Width - 5);
        int ly = Math.Max(cy - 25, 5);
        g.FillRectangle(bg, lx - 3, ly - 2, sz.Width + 6, sz.Height + 4);
        g.DrawString(label, font, brush, lx, ly);
      }
      using (var dotBrush = new SolidBrush(Color.FromArgb(255, 255, 50, 50))) {
        g.FillEllipse(dotBrush, cx - 4, cy - 4, 8, 8);
      }
    }
  }

  protected override void OnFormClosing(FormClosingEventArgs e) {
    if (cursorTimer != null) cursorTimer.Stop();
    if (gridBmp != null) gridBmp.Dispose();
    base.OnFormClosing(e);
  }

  [STAThread]
  static void Main(string[] args) {
    int s = args.Length > 0 ? int.Parse(args[0]) : 100;
    int op = args.Length > 1 ? int.Parse(args[1]) : 40;
    Application.EnableVisualStyles();
    Application.Run(new GridOverlay(s, op));
  }
}