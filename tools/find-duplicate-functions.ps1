$ErrorActionPreference = 'Stop'

$files = Get-ChildItem -Path (Join-Path $PSScriptRoot '..\Appscript') -Filter '*.gs'

$regex = [regex]'(?m)^\s*function\s+([A-Za-z0-9_]+)\s*\('

$funcs = foreach ($f in $files) {
  $content = Get-Content -Raw $f.FullName
  foreach ($m in $regex.Matches($content)) {
    [pscustomobject]@{ Name = $m.Groups[1].Value; File = $f.Name }
  }
}

$dups = $funcs |
  Group-Object Name |
  Where-Object { $_.Count -gt 1 } |
  Sort-Object Count -Descending

if (-not $dups) {
  Write-Host 'No duplicate function names found.'
  exit 0
}

$dups |
  ForEach-Object {
    [pscustomobject]@{
      Name  = $_.Name
      Count = $_.Count
      Files = (($_.Group | Select-Object -ExpandProperty File | Sort-Object -Unique) -join ', ')
    }
  } |
  Format-Table -AutoSize
