# Get active window class name using Windows API
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Class {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public static string GetActiveWindowClass() {
        IntPtr handle = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        if (GetClassName(handle, sb, sb.Capacity) > 0) {
            return sb.ToString();
        }
        return string.Empty;
    }
}
'@

[Win32Class]::GetActiveWindowClass()
