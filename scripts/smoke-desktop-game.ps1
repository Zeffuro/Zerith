param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [ValidateSet('classic-vn-starter', 'example-game')][string]$Fixture = 'classic-vn-starter',
    [string]$OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ("Zerith-desktop-game-" + [guid]::NewGuid()))
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-test-profiles.ps1')
$binary = (Resolve-Path -LiteralPath $Executable).Path
$archive = Join-Path (Split-Path -Parent $binary) 'game.zpack'
if (!(Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Desktop smoke requires game.zpack beside the executable' }
$nodePath = (Get-Command node -ErrorAction Stop).Source
$runRoot = [IO.Path]::GetFullPath($OutputRoot)
if (Test-Path -LiteralPath $runRoot) { throw "Desktop smoke output already exists: $runRoot" }
New-Item -ItemType Directory -Path $runRoot | Out-Null
$isolatedBinary = Join-Path $runRoot 'game-player.exe'
Copy-Item -LiteralPath $binary -Destination $isolatedBinary
Copy-Item -LiteralPath $archive -Destination (Join-Path $runRoot 'game.zpack')
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$gameProcess = $null
$profiles = @()
try {
    $profiles += New-NativeTestProfile $runRoot (Join-Path $runRoot 'webview')
    $profiles += New-NativeTestProfile $runRoot (Join-Path $runRoot 'player-data')
    $previousPath = $env:PATH
    $previousArguments = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
    $previousData = $env:WEBVIEW2_USER_DATA_FOLDER
    $previousPlayerData = $env:ZERITH_PLAYER_DATA_DIR
    try {
        $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
        $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$port"
        $env:WEBVIEW2_USER_DATA_FOLDER = $profiles[0].Path
        $env:ZERITH_PLAYER_DATA_DIR = $profiles[1].Path
        $gameProcess = Start-Process -FilePath $isolatedBinary -WorkingDirectory $runRoot -WindowStyle Hidden -PassThru
        $null = $gameProcess.Handle
    } finally {
        $env:PATH = $previousPath
        $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArguments
        $env:WEBVIEW2_USER_DATA_FOLDER = $previousData
        $env:ZERITH_PLAYER_DATA_DIR = $previousPlayerData
    }
    $endpoint = "http://127.0.0.1:$port"
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try { $null = Invoke-RestMethod "$endpoint/json/version" -TimeoutSec 1; break }
        catch { if ([DateTime]::UtcNow -ge $deadline) { throw 'Desktop player did not expose its smoke connection' } }
        Start-Sleep -Milliseconds 300
    } while ($true)
    $receiptRoot = Join-Path $runRoot 'runtime'
    & $nodePath (Join-Path $PSScriptRoot '../packages/player/scripts/desktop-runtime-smoke.mjs') $endpoint $receiptRoot $Fixture
    if ($LASTEXITCODE -ne 0) { throw 'Standalone desktop playback failed' }
    $gameProcess.Refresh()
    $metadata = @{
        executable = $isolatedBinary
        workingDirectory = $runRoot
        nodeOnPath = $false
        windowTitle = $gameProcess.MainWindowTitle
        sha256 = (Get-FileHash -LiteralPath $isolatedBinary).Hash
    }
    $expectedTitle = if ($Fixture -eq 'classic-vn-starter') { 'Classic VN Starter' } else { (Get-Content (Join-Path $PSScriptRoot '../games/example-game/game.json') -Raw | ConvertFrom-Json).title }
    if ($metadata.windowTitle -ne $expectedTitle) { throw "Unexpected desktop game title: $($metadata.windowTitle)" }
    $metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'environment.json') -Encoding utf8NoBOM
    Write-Output "Standalone desktop game passed. Evidence: $runRoot"
} finally {
    Complete-NativeTestProfiles $gameProcess $profiles
}
