# Quick Deploy Script for AppScript Files
# This script helps you copy the files you need to deploy

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AppScript Deployment Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$files = @(
    "MainApp.gs",
    "ExamManager.gs",
    "CacheService.gs",
    "Config.gs",
    "SheetHelpers.gs",
    "SchemeLessonManager.gs",
    "TimetableManager.gs",
    "SubstitutionManager.gs"
)

Write-Host "Files to deploy:" -ForegroundColor Yellow
foreach ($file in $files) {
    $path = Join-Path "D:\Backup app\enhanceflow\Appscript" $file
    if (Test-Path $path) {
        $lines = (Get-Content $path | Measure-Object -Line).Lines
        Write-Host "  ✓ $file ($lines lines)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (NOT FOUND)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT STEPS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open: https://script.google.com" -ForegroundColor White
Write-Host ""
Write-Host "2. For EACH file above:" -ForegroundColor White
Write-Host "   a) Find the file in left panel" -ForegroundColor Gray
Write-Host "   b) Select ALL content (Ctrl+A)" -ForegroundColor Gray
Write-Host "   c) Delete it" -ForegroundColor Gray
Write-Host "   d) Open local file from: D:\Backup app\enhanceflow\Appscript\" -ForegroundColor Gray
Write-Host "   e) Copy ALL content (Ctrl+A, Ctrl+C)" -ForegroundColor Gray
Write-Host "   f) Paste into Apps Script editor (Ctrl+V)" -ForegroundColor Gray
Write-Host "   g) Save (Ctrl+S)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Deploy NEW version:" -ForegroundColor White
Write-Host "   - Click 'Deploy' → 'New deployment'" -ForegroundColor Gray
Write-Host "   - Type: Web app" -ForegroundColor Gray
Write-Host "   - Description: 'Fixed period filtering + debug logs'" -ForegroundColor Gray
Write-Host "   - Execute as: Me" -ForegroundColor Gray
Write-Host "   - Access: Anyone" -ForegroundColor Gray
Write-Host "   - Click 'Deploy'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Copy the NEW deployment URL" -ForegroundColor White
Write-Host ""
Write-Host "5. Update .env file:" -ForegroundColor White
Write-Host "   File: D:\Backup app\enhanceflow\frontend\.env" -ForegroundColor Gray
Write-Host "   Replace VITE_API_BASE_URL with new URL" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Offer to open files for easy copying
$response = Read-Host "Open these files in Notepad for easy copying? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    foreach ($file in $files) {
        $path = Join-Path "D:\Backup app\enhanceflow\Appscript" $file
        if (Test-Path $path) {
            Start-Process notepad.exe $path
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Host ""
    Write-Host "✓ Files opened in Notepad" -ForegroundColor Green
    Write-Host "  Copy each file's content to Apps Script editor" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to open Apps Script in browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
Start-Process "https://script.google.com"

Write-Host ""
Write-Host "Good luck! 🚀" -ForegroundColor Green
