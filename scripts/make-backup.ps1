param(
    [string[]] $Include = @(
        'src',
        'overlay.html',
        'overlay.css',
        'index.html',
        'note-panel.html',
        'info-panel.html',
        'pinned-history.html',
        'package.json',
        'scripts',
        'docs'
    ),
    [string[]] $Exclude = @(
        'backups',
        'node_modules',
        '.git',
        '.vscode',
        'dist',
        'out',
        'build',
        '.cache'
    )
)

$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root 'backups'
if (-not (Test-Path $backupDir)) {
    New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destRoot = Join-Path $backupDir $timestamp
New-Item -Path $destRoot -ItemType Directory -Force | Out-Null

function ShouldExclude([string] $path, [string[]] $excludeList) {
    if (-not $path) { return $false }
    $lower = $path.ToLowerInvariant()
    foreach ($ex in $excludeList) {
        if (-not $ex) { continue }
        $exLower = $ex.ToLowerInvariant()
        if ($lower -like "*\\$exLower\\*" -or $lower -like "*/$exLower/*" -or $lower -like "*\\$exLower" -or $lower -like "*/$exLower") {
            return $true
        }
    }
    return $false
}

$files = New-Object System.Collections.Generic.List[System.IO.FileInfo]
foreach ($item in $Include) {
    $target = Join-Path $root $item
    if (-not (Test-Path $target)) {
        Write-Warning "Skipping $item (not found)"
        continue
    }

    $resolved = Get-Item -LiteralPath $target
    if ($resolved -is [System.IO.DirectoryInfo]) {
        Get-ChildItem -LiteralPath $resolved.FullName -Recurse -File | ForEach-Object { $files.Add($_) }
    } else {
        $files.Add($resolved)
    }
}

$manifest = Join-Path $destRoot '_manifest.txt'
$manifestLines = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    $full = $file.FullName
    if (ShouldExclude $full $Exclude) { continue }
    if ($full.StartsWith($backupDir, [System.StringComparison]::OrdinalIgnoreCase)) { continue }

    $rel = $full.Substring($root.Length).TrimStart('\', '/')
    $dest = Join-Path $destRoot $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
        New-Item -Path $destDir -ItemType Directory -Force | Out-Null
    }

    Copy-Item -LiteralPath $full -Destination $dest -Force
    Write-Host "Saved $rel -> $dest"
    $manifestLines.Add($rel) | Out-Null
}

$manifestLines | Set-Content -Path $manifest -Encoding UTF8
Write-Host "Backup complete -> $destRoot"
