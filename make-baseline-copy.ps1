param(
  [string]$OutDir = "d:\www\wwww\baseline-" + (Get-Date -Format "yyyyMMdd-HHmmss")
)

$ErrorActionPreference = 'Stop'

Write-Host "Creating baseline snapshot at: $OutDir" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Copy Apps Script sources
Copy-Item -Recurse -Force -Path "d:\www\wwww\Appscript" -Destination (Join-Path $OutDir 'Appscript')

# Copy key project docs/config
$rootFiles = @(
  'README.md',
  'WORKSPACE_SETUP.md',
  'deploy-appscript.ps1',
  'vercel.json'
)
foreach ($f in $rootFiles) {
  $p = Join-Path 'd:\www\wwww' $f
  if (Test-Path $p) {
    Copy-Item -Force $p -Destination (Join-Path $OutDir $f)
  }
}

# Copy frontend env files (so URL/version is preserved)
$frontendDir = 'd:\www\wwww\frontend'
if (Test-Path $frontendDir) {
  New-Item -ItemType Directory -Force -Path (Join-Path $OutDir 'frontend') | Out-Null

  foreach ($envFile in @('.env', '.env.local')) {
    $p = Join-Path $frontendDir $envFile
    if (Test-Path $p) {
      Copy-Item -Force $p -Destination (Join-Path (Join-Path $OutDir 'frontend') $envFile)
    }
  }

  # Copy built dist (if present)
  $dist = Join-Path $frontendDir 'dist'
  if (Test-Path $dist) {
    Copy-Item -Recurse -Force -Path $dist -Destination (Join-Path (Join-Path $OutDir 'frontend') 'dist')
  }
}

# Write a small manifest
$manifest = @{
  createdAt = (Get-Date).ToString('o')
  sourceRoot = 'd:\www\wwww'
  notes = 'Baseline snapshot before further enhancements.'
} | ConvertTo-Json -Depth 5

Set-Content -Path (Join-Path $OutDir 'BASELINE_MANIFEST.json') -Value $manifest -Encoding UTF8

Write-Host "Done. Baseline created." -ForegroundColor Green
Write-Host "OutDir: $OutDir" -ForegroundColor Gray
