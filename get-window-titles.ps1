# List all window titles (non-empty)
Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | ForEach-Object { $_.MainWindowTitle }
