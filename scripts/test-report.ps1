<#
.SYNOPSIS
  Lefuttatja a backend (PHPUnit) és a frontend (Vitest) automata teszteket,
  majd egy szép, statikus HTML riportot generál az eredményekről.

.DESCRIPTION
  Ez a script SZÁNDÉKOSAN a repo gyökeréből, egy friss PowerShell-folyamatból
  indítja közvetlenül a "vendor/bin/phpunit"-et (nem "php artisan test"-en
  vagy egy másik Artisan parancson keresztül) — egy korábbi hiba miatt
  tudjuk, hogy ha egy már bootstrapolt Laravel-folyamat indítaná gyermek-
  folyamatként a tesztfutást, a gyermek örökölhetné a szülő VALÓDI .env-jét
  (éles MySQL-kapcsolat), és a phpunit.xml teszt-környezeti felülírása ezt
  nem garantáltan írja felül. Innen, egy sima terminálparancsként indítva ez
  a kockázat nem áll fenn.

.EXAMPLE
  .\scripts\test-report.ps1
  .\scripts\test-report.ps1 -Suite backend
#>
param(
    [ValidateSet('all', 'backend', 'frontend')]
    [string]$Suite = 'all'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$reportsDir = Join-Path $root 'reports'

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

if ($Suite -eq 'all' -or $Suite -eq 'backend') {
    Write-Host "Backend tesztek futtatása (PHPUnit)..." -ForegroundColor Cyan
    Push-Location (Join-Path $root 'backend')
    php artisan config:clear --ansi | Out-Null
    php vendor/bin/phpunit --log-junit ../reports/backend-junit.xml
    Pop-Location
}

if ($Suite -eq 'all' -or $Suite -eq 'frontend') {
    Write-Host "Frontend tesztek futtatása (Vitest)..." -ForegroundColor Cyan
    Push-Location (Join-Path $root 'frontend')
    npx vitest run --reporter=json --outputFile=../reports/frontend-results.json
    Pop-Location
}

Write-Host "Riport összeállítása..." -ForegroundColor Cyan
php (Join-Path $root 'scripts/build-test-report.php')

$reportPath = Join-Path $reportsDir 'test-report.html'
Write-Host "Megnyitás böngészőben: $reportPath" -ForegroundColor Green
Start-Process $reportPath
