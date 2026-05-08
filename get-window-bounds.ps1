param(
  [Parameter(Mandatory=$true)]
  [string]$TitleContains
)

# PS 5.1 compatible helper: returns bounds for the first visible window whose title contains the given text.

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }
}
"@

$needle = ("{0}" -f $TitleContains).Trim()
if (-not $needle) {
  Write-Output "{}"
  exit 0
}

$found = $null

$callback = [Win32+EnumWindowsProc]{
  param([IntPtr]$hWnd, [IntPtr]$lParam)

  if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }

  $sb = New-Object System.Text.StringBuilder 512
  [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
  $title = $sb.ToString()
  if ([string]::IsNullOrWhiteSpace($title)) { return $true }

  if ($title.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    $rect = New-Object Win32+RECT
    if ([Win32]::GetWindowRect($hWnd, [ref]$rect)) {
      $script:found = [pscustomobject]@{
        title = $title
        left = $rect.Left
        top = $rect.Top
        right = $rect.Right
        bottom = $rect.Bottom
      }
      return $false
    }
  }

  return $true
}

[void][Win32]::EnumWindows($callback, [IntPtr]::Zero)

if ($null -eq $found) {
  Write-Output "{}"
  exit 0
}

$found | ConvertTo-Json -Compress
