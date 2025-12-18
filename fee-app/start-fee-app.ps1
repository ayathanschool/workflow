# Fee App Setup and Start Script

Write-Host "🚀 Setting up Fee Collection App..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$currentDir = Get-Location
if ($currentDir.Path -notlike "*\fee-app") {
    Write-Host "📁 Navigating to fee-app directory..." -ForegroundColor Yellow
    Set-Location -Path "d:\www\wwww\fee-app"
}

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies (this may take a minute)..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
    Write-Host ""
}

Write-Host "🎯 Starting development server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Quick Guide:" -ForegroundColor Yellow
Write-Host "   • Fee app will run on: http://localhost:5174" -ForegroundColor White
Write-Host "   • Make sure workflow app is also running on: http://localhost:5173" -ForegroundColor White
Write-Host "   • Access fee app through workflow app's Fee Collection tab" -ForegroundColor White
Write-Host ""
Write-Host "🔒 Authentication is automatic - no login needed!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the dev server
npm run dev
