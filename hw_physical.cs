using System;
using System.Runtime.InteropServices;
using System.Threading;

class HW {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int n);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, uint data, IntPtr extra);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;

    static void Click(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
    }

    static void RClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, IntPtr.Zero);
    }

    static void DClick(int x, int y) {
        Click(x, y);
        Thread.Sleep(50);
        Click(x, y);
    }

    static void Drag(int x1, int y1, int x2, int y2, int steps) {
        SetCursorPos(x1, y1);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(30);
        for (int i = 1; i <= steps; i++) {
            int cx = x1 + (x2 - x1) * i / steps;
            int cy = y1 + (y2 - y1) * i / steps;
            SetCursorPos(cx, cy);
            Thread.Sleep(5);
        }
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
    }

    static void Main(string[] args) {
        SetProcessDPIAware();
        int w = GetSystemMetrics(0);
        int h = GetSystemMetrics(1);

        if (args.Length < 1) {
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("usage: hw <click|drag|move|rclick|dclick> x y [x2 y2] [steps]");
            return;
        }

        string cmd = args[0].ToLower();

        if (cmd == "click" && args.Length >= 3) {
            int x = int.Parse(args[1]), y = int.Parse(args[2]);
            Click(x, y);
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("done");
        } else if (cmd == "rclick" && args.Length >= 3) {
            int x = int.Parse(args[1]), y = int.Parse(args[2]);
            RClick(x, y);
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("done");
        } else if (cmd == "dclick" && args.Length >= 3) {
            int x = int.Parse(args[1]), y = int.Parse(args[2]);
            DClick(x, y);
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("done");
        } else if (cmd == "move" && args.Length >= 3) {
            int x = int.Parse(args[1]), y = int.Parse(args[2]);
            SetCursorPos(x, y);
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("done");
        } else if (cmd == "drag" && args.Length >= 5) {
            int x1 = int.Parse(args[1]), y1 = int.Parse(args[2]);
            int x2 = int.Parse(args[3]), y2 = int.Parse(args[4]);
            int steps = args.Length >= 6 ? int.Parse(args[5]) : 30;
            Drag(x1, y1, x2, y2, steps);
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("done");
        } else {
            Console.WriteLine("screen:" + w + "x" + h);
            Console.WriteLine("unknown: " + cmd);
        }
    }
}
