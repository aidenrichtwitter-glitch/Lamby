using System;
using System.Runtime.InteropServices;
using System.Threading;

class HW {
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public INPUTUNION u; }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct POINT { public int X, Y; }

    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] p, int cb);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("shcore.dll")] static extern int SetProcessDpiAwareness(int v);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);

    const int SZ = 40;
    static int SW, SH;

    static void InitDPI() {
        try { SetProcessDpiAwareness(2); } catch { try { SetProcessDPIAware(); } catch {} }
        SW = GetSystemMetrics(0); SH = GetSystemMetrics(1);
    }

    static void MovePhysical(int physX, int physY) {
        var i = new INPUT(); i.type = 0;
        i.u.mi.dx = (int)((physX * 65535L) / SW); i.u.mi.dy = (int)((physY * 65535L) / SH);
        i.u.mi.dwFlags = 0x0001 | 0x8000;
        SendInput(1, new INPUT[] { i }, SZ);
    }
    static void MouseBtn(uint f) { var i = new INPUT(); i.type = 0; i.u.mi.dwFlags = f; SendInput(1, new INPUT[] { i }, SZ); }

    static void Click(int physX, int physY) { MovePhysical(physX, physY); Thread.Sleep(30); MouseBtn(0x0002); Thread.Sleep(30); MouseBtn(0x0004); Thread.Sleep(30); }
    static void RClick(int physX, int physY) { MovePhysical(physX, physY); Thread.Sleep(30); MouseBtn(0x0008); Thread.Sleep(30); MouseBtn(0x0010); Thread.Sleep(30); }
    static void DClick(int physX, int physY) { Click(physX, physY); Thread.Sleep(50); Click(physX, physY); }

    static void ClickNoFocus(int physX, int physY) {
        POINT savedPhysPos; GetCursorPos(out savedPhysPos);
        IntPtr fgWnd = GetForegroundWindow();
        MovePhysical(physX, physY); Thread.Sleep(30);
        MouseBtn(0x0002); Thread.Sleep(30); MouseBtn(0x0004); Thread.Sleep(30);
        MovePhysical(savedPhysPos.X, savedPhysPos.Y);
        Thread.Sleep(50);
        if (fgWnd != IntPtr.Zero) SetForegroundWindow(fgWnd);
    }
    static void RClickNoFocus(int physX, int physY) {
        POINT savedPhysPos; GetCursorPos(out savedPhysPos);
        IntPtr fgWnd = GetForegroundWindow();
        MovePhysical(physX, physY); Thread.Sleep(30);
        MouseBtn(0x0008); Thread.Sleep(30); MouseBtn(0x0010); Thread.Sleep(30);
        MovePhysical(savedPhysPos.X, savedPhysPos.Y);
        Thread.Sleep(50);
        if (fgWnd != IntPtr.Zero) SetForegroundWindow(fgWnd);
    }
    static void DClickNoFocus(int physX, int physY) { ClickNoFocus(physX, physY); Thread.Sleep(50); ClickNoFocus(physX, physY); }

    static void Drag(int physX1, int physY1, int physX2, int physY2, int steps) {
        MovePhysical(physX1, physY1); Thread.Sleep(40); MouseBtn(0x0002); Thread.Sleep(40);
        for (int s = 1; s <= steps; s++) { MovePhysical(physX1 + (physX2-physX1)*s/steps, physY1 + (physY2-physY1)*s/steps); Thread.Sleep(5); }
        Thread.Sleep(30); MouseBtn(0x0004); Thread.Sleep(10);
    }

    static void KeyDown(ushort vk) { var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; SendInput(1, new INPUT[] { i }, SZ); Thread.Sleep(15); }
    static void KeyUp(ushort vk) { var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.dwFlags = 2; SendInput(1, new INPUT[] { i }, SZ); Thread.Sleep(15); }
    static void KeyTap(ushort vk) { KeyDown(vk); KeyUp(vk); }

    static ushort ParseKey(string name) {
        switch (name.ToLower().Trim()) {
            case "ctrl": case "control": return 0x11;
            case "shift": return 0x10;
            case "alt": case "menu": return 0x12;
            case "win": case "lwin": return 0x5B;
            case "enter": case "return": return 0x0D;
            case "esc": case "escape": return 0x1B;
            case "tab": return 0x09;
            case "space": return 0x20;
            case "backspace": case "back": case "bs": return 0x08;
            case "delete": case "del": return 0x2E;
            case "insert": case "ins": return 0x2D;
            case "up": return 0x26; case "down": return 0x28;
            case "left": return 0x25; case "right": return 0x27;
            case "home": return 0x24; case "end": return 0x23;
            case "pageup": case "pgup": return 0x21;
            case "pagedown": case "pgdn": return 0x22;
            case "capslock": case "caps": return 0x14;
            case "numlock": return 0x90;
            case "scrolllock": return 0x91;
            case "printscreen": case "prtsc": return 0x2C;
            case "pause": return 0x13;
            case "f1": return 0x70; case "f2": return 0x71; case "f3": return 0x72;
            case "f4": return 0x73; case "f5": return 0x74; case "f6": return 0x75;
            case "f7": return 0x76; case "f8": return 0x77; case "f9": return 0x78;
            case "f10": return 0x79; case "f11": return 0x7A; case "f12": return 0x7B;
            case "num0": return 0x60; case "num1": return 0x61; case "num2": return 0x62;
            case "num3": return 0x63; case "num4": return 0x64; case "num5": return 0x65;
            case "num6": return 0x66; case "num7": return 0x67; case "num8": return 0x68;
            case "num9": return 0x69;
            case "multiply": return 0x6A; case "add": return 0x6B;
            case "subtract": return 0x6D; case "decimal": return 0x6E;
            case "divide": return 0x6F;
            case ";": case "semicolon": return 0xBA;
            case "=": case "equals": return 0xBB;
            case ",": case "comma": return 0xBC;
            case "-": case "minus": return 0xBD;
            case ".": case "period": return 0xBE;
            case "/": case "slash": return 0xBF;
            case "`": case "backtick": return 0xC0;
            case "[": case "lbracket": return 0xDB;
            case "\\": case "backslash": return 0xDC;
            case "]": case "rbracket": return 0xDD;
            case "'": case "quote": return 0xDE;
            default:
                if (name.Length == 1) {
                    char c = char.ToUpper(name[0]);
                    if (c >= 'A' && c <= 'Z') return (ushort)c;
                    if (c >= '0' && c <= '9') return (ushort)c;
                }
                ushort vk;
                if (name.StartsWith("0x") && ushort.TryParse(name.Substring(2), System.Globalization.NumberStyles.HexNumber, null, out vk)) return vk;
                if (ushort.TryParse(name, out vk)) return vk;
                return 0;
        }
    }

    static void KeyCombo(string combo) {
        string[] parts = combo.Split('+');
        ushort[] keys = new ushort[parts.Length];
        for (int i = 0; i < parts.Length; i++) {
            keys[i] = ParseKey(parts[i]);
            if (keys[i] == 0) { Console.WriteLine("unknown_key: " + parts[i]); return; }
        }
        for (int i = 0; i < keys.Length; i++) KeyDown(keys[i]);
        for (int i = keys.Length - 1; i >= 0; i--) KeyUp(keys[i]);
        Thread.Sleep(30);
    }

    static void TypeText(string text) {
        foreach (char ch in text) {
            bool shift = char.IsUpper(ch) || "~!@#$%^&*()_+{}|:\"<>?".IndexOf(ch) >= 0;
            char lookup = char.ToUpper(ch);
            ushort vk = 0;
            if (lookup >= 'A' && lookup <= 'Z') vk = (ushort)lookup;
            else if (lookup >= '0' && lookup <= '9') vk = (ushort)lookup;
            else vk = ParseKey(ch.ToString());
            if (vk == 0) continue;
            if (shift) KeyDown(0x10);
            KeyTap(vk);
            if (shift) KeyUp(0x10);
            Thread.Sleep(15);
        }
    }

    static void Main(string[] args) {
        InitDPI();
        Console.WriteLine("physical:" + SW + "x" + SH);
        if (args.Length == 0) {
            Console.WriteLine("ALL COORDINATES ARE PHYSICAL (" + SW + "x" + SH + "). Grid coords = hw.exe coords. No conversion.");
            Console.WriteLine("");
            Console.WriteLine("usage: hw <command> [args]");
            Console.WriteLine("");
            Console.WriteLine("  click    X Y       click at physical (X,Y) — moves cursor, may change focus");
            Console.WriteLine("  nfclick  X Y       click at physical (X,Y) — restores cursor pos + focus after");
            Console.WriteLine("  rclick   X Y       right-click at physical (X,Y)");
            Console.WriteLine("  nfrclick X Y       right-click at physical (X,Y) — no focus steal");
            Console.WriteLine("  dclick   X Y       double-click at physical (X,Y)");
            Console.WriteLine("  nfdclick X Y       double-click at physical (X,Y) — no focus steal");
            Console.WriteLine("  move     X Y       move cursor to physical (X,Y)");
            Console.WriteLine("  drag     X1 Y1 X2 Y2 [steps]   drag between physical coords");
            Console.WriteLine("  key      COMBO     key combo e.g. ctrl+z, shift+ctrl+s, f5, esc");
            Console.WriteLine("  type     TEXT      type text string");
            return;
        }
        string cmd = args[0].ToLower();
        try {
            switch (cmd) {
                case "click": Click(int.Parse(args[1]), int.Parse(args[2])); break;
                case "nfclick": ClickNoFocus(int.Parse(args[1]), int.Parse(args[2])); break;
                case "rclick": RClick(int.Parse(args[1]), int.Parse(args[2])); break;
                case "nfrclick": RClickNoFocus(int.Parse(args[1]), int.Parse(args[2])); break;
                case "dclick": DClick(int.Parse(args[1]), int.Parse(args[2])); break;
                case "nfdclick": DClickNoFocus(int.Parse(args[1]), int.Parse(args[2])); break;
                case "move": MovePhysical(int.Parse(args[1]), int.Parse(args[2])); break;
                case "drag": Drag(int.Parse(args[1]), int.Parse(args[2]), int.Parse(args[3]), int.Parse(args[4]),
                    args.Length > 5 ? int.Parse(args[5]) : 30); break;
                case "key": KeyCombo(args[1]); break;
                case "type": TypeText(string.Join(" ", args, 1, args.Length - 1)); break;
                default: Console.WriteLine("unknown: " + cmd); break;
            }
        } catch (Exception e) { Console.WriteLine("error: " + e.Message); }
        Console.WriteLine("done");
    }
}
