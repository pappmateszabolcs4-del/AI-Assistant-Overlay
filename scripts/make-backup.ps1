param(
    [string[]] $Files = @(
        'main.js',
        'overlay.html',
        'index.html',
        'note-panel.html',
        'info-panel.html',
        'pinned-history.html'
    )
)

$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root 'backups'
if (-not (Test-Path $backupDir)) {
    throw "Backup directory not found: $backupDir"
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

foreach ($file in $Files) {
    $src = Join-Path $root $file
    if (-not (Test-Path $src)) {
        Write-Warning "Skipping $file (not found)"
        continue
    }

    $targetName = "{0}.backup.{1}" -f $file, $timestamp
    $dest = Join-Path $backupDir $targetName
    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "Saved $file -> $dest"
}
