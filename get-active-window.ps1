# Get active window title using Windows API
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    
    public static string GetActiveWindowTitle() {
        IntPtr handle = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        if (GetWindowText(handle, sb, 256) > 0) {
            return sb.ToString();
        }
        return string.Empty;
    }
}
'@

[Win32]::GetActiveWindowTitle()
