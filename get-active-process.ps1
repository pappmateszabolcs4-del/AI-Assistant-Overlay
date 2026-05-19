# Get active window process info (name + path) using Windows API
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Proc {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
'@

try {
    $hwnd = [Win32Proc]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) {
        "{}"
        exit 0
    }

    $pid = 0
    [Win32Proc]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
    if ($pid -le 0) {
        "{}"
        exit 0
    }

    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $proc) {
        "{}"
        exit 0
    }

    $path = $proc.Path
    $name = $proc.ProcessName
    if (-not $path) { $path = "" }
    if (-not $name) { $name = "" }

    @{ pid = $pid; name = $name; path = $path } | ConvertTo-Json -Compress
} catch {
    "{}"
}
