# CDF · Claude Developer Framework — instalador para Windows
# Uso:  Unblock-File .\install-cdf.ps1 ; powershell -ExecutionPolicy Bypass -File .\install-cdf.ps1
$ErrorActionPreference = 'Stop'
Write-Host "`nInstalando CDF (Claude Developer Framework)..." -ForegroundColor Cyan

function Test-Tool($name, $cmd, $hint) {
    try {
        $v = & cmd /c "$cmd 2>nul"
        if (-not $v) { throw }
        Write-Host ("  OK  {0,-8} {1}" -f $name, ($v | Select-Object -First 1)) -ForegroundColor Green
        return $true
    } catch {
        Write-Host ("  X   {0,-8} no encontrado. {1}" -f $name, $hint) -ForegroundColor Red
        return $false
    }
}

$ok = $true
$ok = (Test-Tool 'node' 'node --version' 'Instala Node.js 18+ desde https://nodejs.org') -and $ok
$ok = (Test-Tool 'npm' 'npm --version' 'Se instala con Node.js') -and $ok
$ok = (Test-Tool 'git' 'git --version' 'Instala Git desde https://git-scm.com') -and $ok
$claude = Test-Tool 'claude' 'claude --version' 'Instala Claude Code: npm install -g @anthropic-ai/claude-code'
if (-not $ok) { Write-Host "`nCorrige los requisitos y vuelve a ejecutar el instalador." -ForegroundColor Red; exit 1 }

Push-Location $PSScriptRoot
try {
    npm install -g . --no-fund --no-audit | Out-Null
} finally { Pop-Location }

$v = & cmd /c "cdf --version 2>nul"
if (-not $v) { Write-Host "La instalación terminó pero 'cdf' no está en el PATH. Abre una terminal nueva." -ForegroundColor Yellow; exit 1 }
Write-Host "`nCDF $v instalado correctamente." -ForegroundColor Green
if (-not $claude) { Write-Host "Recuerda instalar Claude Code antes de usar los comandos /sdd-*." -ForegroundColor Yellow }
Write-Host "Abre una terminal nueva y ejecuta: cdf --help`n"
