param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string]$OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ("Zerith-smoke-" + [guid]::NewGuid()))
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-test-profiles.ps1')
$repoRoot = Split-Path $PSScriptRoot -Parent
$binary = (Resolve-Path -LiteralPath $Executable).Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$runRoot = [IO.Path]::GetFullPath($OutputRoot)
if (Test-Path -LiteralPath $runRoot) { throw "Smoke output already exists: $runRoot" }
New-Item -ItemType Directory -Path $runRoot | Out-Null
$appRoot = Join-Path $runRoot 'app'
New-Item -ItemType Directory -Path $appRoot | Out-Null
$isolatedBinary = Join-Path $appRoot 'editor.exe'
Copy-Item -LiteralPath $binary -Destination $isolatedBinary

function Copy-PublicFixture([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Path $Destination | Out-Null
    foreach ($entry in Get-ChildItem -LiteralPath $Source -Force) {
        if ($entry.Name -in @('.dev_docs', '.git')) { continue }
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Fixture contains a link: $($entry.FullName)" }
        $target = Join-Path $Destination $entry.Name
        if ($entry.PSIsContainer) { Copy-PublicFixture $entry.FullName $target }
        else { Copy-Item -LiteralPath $entry.FullName -Destination $target }
    }
}

$receipts = @()
foreach ($fixture in @('classic-vn-starter', 'example-game')) {
    $caseRoot = Join-Path $runRoot $fixture
    New-Item -ItemType Directory -Path $caseRoot | Out-Null
    $config = @{
        parentPath = $caseRoot
        projectName = $fixture
        outDir = Join-Path $caseRoot 'export'
        zipFile = Join-Path $caseRoot 'export.zip'
        receiptPath = Join-Path $caseRoot 'receipt.json'
    }
    if ($fixture -eq 'example-game') {
        $config.existingProjectPath = Join-Path $caseRoot 'project'
        Copy-PublicFixture (Join-Path $repoRoot 'games/example-game') $config.existingProjectPath
    }
    $configPath = Join-Path $caseRoot 'config.json'
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8NoBOM
    $process = $null
    $profiles = @()
    try {
        $profiles += New-NativeTestProfile $runRoot (Join-Path $caseRoot 'webview')
        $previousPath = $env:PATH
        $previousWebviewFolder = $env:WEBVIEW2_USER_DATA_FOLDER
        try {
            $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
            $env:WEBVIEW2_USER_DATA_FOLDER = $profiles[0].Path
            $process = Start-Process -FilePath $isolatedBinary -ArgumentList @('--smoke-project', ('"' + $configPath + '"')) `
                -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru
            $null = $process.Handle
        } finally {
            $env:PATH = $previousPath
            $env:WEBVIEW2_USER_DATA_FOLDER = $previousWebviewFolder
        }
        $deadline = [DateTime]::UtcNow.AddMinutes(2)
        while (!$process.WaitForExit(1000)) {
            if ([DateTime]::UtcNow -gt $deadline) {
                throw "Installed smoke timed out for $fixture. Outputs preserved at $caseRoot"
            }
        }
        if (!(Test-Path -LiteralPath $config.receiptPath)) { throw "Editor exited without a receipt for $fixture (exit $($process.ExitCode))." }
        $receipt = Get-Content -LiteralPath $config.receiptPath -Raw | ConvertFrom-Json
        if ($process.ExitCode -ne 0 -or $receipt.status -ne 'passed') { throw ($receipt | ConvertTo-Json -Depth 10) }
        if ($receipt.runtime.nodeOnPath -ne $false -or $receipt.runtime.workingDirectory -ne $appRoot) { throw 'Editor did not run in the isolated environment.' }
        $extracted = Join-Path $caseRoot 'extracted'
        Expand-Archive -LiteralPath $config.zipFile -DestinationPath $extracted
        $exportFiles = @(Get-ChildItem -LiteralPath $config.outDir -Recurse -File)
        $zipFiles = @(Get-ChildItem -LiteralPath $extracted -Recurse -File)
        if ($exportFiles.Count -ne $zipFiles.Count) { throw "ZIP file count differs for $fixture" }
        foreach ($file in $exportFiles) {
            $relative = [IO.Path]::GetRelativePath($config.outDir, $file.FullName)
            $zipPath = Join-Path $extracted $relative
            if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $zipPath).Hash) {
                throw "ZIP bytes differ for $relative"
            }
        }
        $runtimeArgs = @((Join-Path $repoRoot 'packages/player/scripts/exported-runtime-smoke.mjs'), '--game', $receipt.projectPath, '--outDir', $extracted, '--skipBuild')
        if ($fixture -eq 'example-game') {
            $runtimeArgs += @('--expect', 'Rain on the glass, two case files on the desk, and one very patient renderer.', '--expect', 'I moved everything clean into this folder.')
        }
        & $nodePath @runtimeArgs
        if ($LASTEXITCODE -ne 0) { throw "Exported runtime failed for $fixture" }
        $receipts += @{ fixture = $fixture; receipt = $config.receiptPath; zipFiles = $zipFiles.Count; runtime = 'passed' }
        Write-Output "Installed editor and exported ZIP runtime passed: $fixture"
    } finally {
        Complete-NativeTestProfiles $process $profiles
    }
}
$receipts | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runRoot 'summary.json') -Encoding utf8NoBOM
Write-Output "Smoke receipts preserved at $runRoot"
