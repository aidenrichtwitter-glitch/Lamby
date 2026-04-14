Add-Type @'
using System;
using System.Runtime.InteropServices;
public class HW {
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx; public int dy; public uint mouseData;
        public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type; public MOUSEINPUT mi;
    }
    [DllImport("user32.dll",SetLastError=true)]
    public static extern uint SendInput(uint n, INPUT[] p, int cb);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int i);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWndProc cb, IntPtr lp);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
    public delegate bool EnumWndProc(IntPtr h, IntPtr l);
    static int SW = GetSystemMetrics(0);
    static int SH = GetSystemMetrics(1);
    const uint MOVE=0x0001, DOWN=0x0002, UP=0x0004, ABS=0x8000;
    static void Send(uint flags, int x, int y) {
        INPUT[] inp = new INPUT[1];
        inp[0].type = 0;
        inp[0].mi.dx = (int)((x*65535L)/SW);
        inp[0].mi.dy = (int)((y*65535L)/SH);
        inp[0].mi.dwFlags = flags;
        SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
    }
    public static void M(int x,int y){ Send(MOVE|ABS,x,y); }
    public static void D(){ Send(DOWN,0,0); }
    public static void U(){ Send(UP,0,0); }
    public static void Click(int x,int y){
        M(x,y); System.Threading.Thread.Sleep(30);
        D(); System.Threading.Thread.Sleep(30); U();
    }
    public static void Drag(int x1,int y1,int x2,int y2,int s){
        M(x1,y1); System.Threading.Thread.Sleep(50);
        D(); System.Threading.Thread.Sleep(50);
        for(int i=1;i<=s;i++){
            M(x1+(x2-x1)*i/s, y1+(y2-y1)*i/s);
            System.Threading.Thread.Sleep(8);
        }
        System.Threading.Thread.Sleep(30); U();
    }
    public static bool Focus(string partial) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            var sb = new System.Text.StringBuilder(256);
            GetWindowText(h, sb, 256);
            if(sb.ToString().IndexOf(partial, StringComparison.OrdinalIgnoreCase) >= 0) {
                found = h;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        if(found != IntPtr.Zero) {
            ShowWindow(found, 9);
            SetForegroundWindow(found);
            return true;
        }
        return false;
    }
}
'@
$cmds = $args -join " "
foreach($line in ($cmds -split "\\|")) {
    $p = $line.Trim() -split ","
    switch($p[0]) {
        "c" { [HW]::Click([int]$p[1],[int]$p[2]) }
        "m" { [HW]::M([int]$p[1],[int]$p[2]) }
        "d" { [HW]::Drag([int]$p[1],[int]$p[2],[int]$p[3],[int]$p[4],[int]$p[5]) }
        "w" { Start-Sleep -Milliseconds ([int]$p[1]) }
        "f" { [HW]::Focus($p[1]) }
    }
}
Write-Output "ok"