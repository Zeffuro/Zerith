$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'native-test-profiles.ps1')

$root = Join-Path ([IO.Path]::GetTempPath()) ('Zerith-native-profile-contract-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $root | Out-Null
$rootIdentity = [ZerithNativeProfileIdentity]::Read($root)
$previousKeep = $env:ZERITH_KEEP_TEST_PROFILES
$script:webviews = @()
$script:inspectionFailure = $false
$script:checks = 0
$script:swapAncestor = $null

function Get-ChildItem {
    [CmdletBinding()]
    param([string]$LiteralPath, [switch]$Force, [switch]$Recurse)
    $entries = @(Microsoft.PowerShell.Management\Get-ChildItem @PSBoundParameters)
    if ($script:swapAncestor -and $LiteralPath -eq $script:swapAncestor) {
        $script:swapAncestor = $null
        $parent = Split-Path -Parent $LiteralPath
        $moved = $parent + '-original'
        Rename-Item -LiteralPath $parent -NewName (Split-Path -Leaf $moved)
        New-Item -ItemType Directory -Path $parent | Out-Null
        Move-Item -LiteralPath (Join-Path $moved 'profile') -Destination $LiteralPath
    }
    $entries
}

function Get-CimInstance {
    param($ClassName, $Filter, $ErrorAction)
    if ($script:inspectionFailure) { throw 'Synthetic process inspection failure' }
    $script:webviews
}

function Assert-Contract([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
    $script:checks++
}

function New-ContractProcess([bool]$FailsClose = $false) {
    $process = [pscustomobject]@{ Id = 12345; HasExited = $false; Disposed = $false; Killed = $false; FailsClose = $FailsClose }
    $process | Add-Member ScriptMethod CloseMainWindow { return $false }
    $process | Add-Member ScriptMethod WaitForExit { param($Milliseconds) return $this.HasExited }
    $process | Add-Member ScriptMethod Kill {
        if ($this.FailsClose) { throw 'Synthetic owned process closure failure' }
        $this.Killed = $true
        $this.HasExited = $true
    }
    $process | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
    $process
}

try {
    $env:ZERITH_KEEP_TEST_PROFILES = $null
    $profile = New-NativeTestProfile $root (Join-Path $root 'fresh')
    Set-Content -LiteralPath (Join-Path $profile.Path 'cache.txt') -Value 'scratch'
    $receipt = Join-Path $root 'receipt.json'
    Set-Content -LiteralPath $receipt -Value '{}'
    Complete-NativeTestProfiles $null @($profile)
    Assert-Contract (!(Test-Path -LiteralPath $profile.Path)) 'Fresh profile was not removed'
    Assert-Contract (Test-Path -LiteralPath $receipt) 'Receipt was removed'

    $retained = New-NativeTestProfile $root (Join-Path $root 'keep')
    $env:ZERITH_KEEP_TEST_PROFILES = '1'
    $warnings = @(Complete-NativeTestProfiles $null @($retained) 3>&1)
    Assert-Contract ((Test-Path -LiteralPath $retained.Path) -and $warnings.Count -gt 0) 'Debug retention was not reported'
    $env:ZERITH_KEEP_TEST_PROFILES = $null

    $replaced = New-NativeTestProfile $root (Join-Path $root 'replaced')
    Rename-Item -LiteralPath $replaced.Path -NewName 'original'
    New-Item -ItemType Directory -Path $replaced.Path | Out-Null
    Complete-NativeTestProfiles $null @($replaced)
    Assert-Contract (Test-Path -LiteralPath $replaced.Path) 'Replacement directory was removed'
    Assert-Contract (Test-Path -LiteralPath (Join-Path $root 'original')) 'Moved original was removed'

    $existingRefused = $false
    try { $null = New-NativeTestProfile $root $retained.Path } catch { $existingRefused = $true }
    Assert-Contract $existingRefused 'Existing directory was accepted as freshly owned'
    $outsideRefused = $false
    try { $null = New-NativeTestProfile $root ($root + '-sibling\webview') } catch { $outsideRefused = $true }
    Assert-Contract $outsideRefused 'Sibling directory was accepted inside output root'

    $nested = New-NativeTestProfile $root (Join-Path $root 'player-data')
    $script:webviews = @(
        [pscustomobject]@{ ProcessId = 7; ParentProcessId = 1; CommandLine = ('msedgewebview2 --user-data-dir="' + $nested.Path + '\game-id\webview\EBWebView"') },
        [pscustomobject]@{ ProcessId = 8; ParentProcessId = 7; CommandLine = 'msedgewebview2 --type=renderer' },
        [pscustomobject]@{ ProcessId = 9; ParentProcessId = 1; CommandLine = ('msedgewebview2 --user-data-dir="' + $nested.Path + '-sibling"') },
        [pscustomobject]@{ ProcessId = 10; ParentProcessId = 1; CommandLine = ('msedgewebview2 "--user-data-dir=' + $nested.Path + '\quoted\EBWebView"') }
    )
    $owned = @(Get-NativeProfileProcesses @($nested))
    Assert-Contract ($owned.Count -eq 3 -and 7 -in $owned.ProcessId -and 8 -in $owned.ProcessId -and 10 -in $owned.ProcessId) 'Nested profile process, quoted argument or child was missed'
    Assert-Contract (9 -notin $owned.ProcessId) 'Sibling process was counted as owned'
    $script:webviews = @([pscustomobject]@{ ProcessId = 8; ParentProcessId = 7; CommandLine = 'msedgewebview2 --type=renderer' })
    Assert-Contract (@(Get-NativeProfileProcesses @($nested) 0 @(8)).Count -eq 1) 'Surviving captured WebView child was missed'
    $script:webviews = @()

    $ancestor = Join-Path $root 'ancestor'
    New-Item -ItemType Directory -Path $ancestor | Out-Null
    $changedAncestor = New-NativeTestProfile $root (Join-Path $ancestor 'profile')
    Rename-Item -LiteralPath $ancestor -NewName 'ancestor-original'
    New-Item -ItemType Directory -Path $ancestor | Out-Null
    New-Item -ItemType Directory -Path $changedAncestor.Path | Out-Null
    Complete-NativeTestProfiles $null @($changedAncestor)
    Assert-Contract (Test-Path -LiteralPath $changedAncestor.Path) 'Replacement ancestor was accepted'

    $duringTraversal = Join-Path $root 'during-traversal'
    New-Item -ItemType Directory -Path $duringTraversal | Out-Null
    $traversed = New-NativeTestProfile $root (Join-Path $duringTraversal 'profile')
    $script:swapAncestor = $traversed.Path
    Complete-NativeTestProfiles $null @($traversed)
    Assert-Contract (Test-Path -LiteralPath $traversed.Path) 'Ancestor replacement during traversal was accepted'
    Assert-Contract ([ZerithNativeProfileIdentity]::Read($traversed.Path) -eq $traversed.Identity) 'Traversal contract did not preserve profile identity'

    $linked = New-NativeTestProfile $root (Join-Path $root 'linked')
    $linkTarget = Join-Path $root 'link-target'
    New-Item -ItemType Directory -Path $linkTarget | Out-Null
    Set-Content -LiteralPath (Join-Path $linkTarget 'original.txt') -Value 'preserve'
    $junction = Join-Path $linked.Path 'junction'
    New-Item -ItemType Junction -Path $junction -Target $linkTarget | Out-Null
    try {
        Complete-NativeTestProfiles $null @($linked)
        Assert-Contract (Test-Path -LiteralPath $linked.Path) 'Linked profile was removed'
        Assert-Contract (Test-Path -LiteralPath (Join-Path $linkTarget 'original.txt')) 'Junction target data was removed'
        $linkRefused = $false
        try { $null = New-NativeTestProfile $root (Join-Path $junction 'fresh') } catch { $linkRefused = $true }
        Assert-Contract $linkRefused 'Reparse ancestor was accepted'
    } finally { [IO.Directory]::Delete($junction) }

    $closed = New-NativeTestProfile $root (Join-Path $root 'closed')
    $process = New-ContractProcess
    Complete-NativeTestProfiles $process @($closed)
    Assert-Contract ($process.Killed -and $process.Disposed -and !(Test-Path -LiteralPath $closed.Path)) 'Owned process did not close before cleanup'

    $failed = New-NativeTestProfile $root (Join-Path $root 'close-failed')
    $process = New-ContractProcess $true
    Complete-NativeTestProfiles $process @($failed)
    Assert-Contract ($process.Disposed -and (Test-Path -LiteralPath $failed.Path)) 'Closure failure did not retain profile'

    $uninspected = New-NativeTestProfile $root (Join-Path $root 'inspection-failed')
    $script:inspectionFailure = $true
    Complete-NativeTestProfiles $null @($uninspected)
    Assert-Contract (Test-Path -LiteralPath $uninspected.Path) 'Inspection failure did not retain profile'
    $script:inspectionFailure = $false

    $errorPreserved = $false
    try {
        try { throw 'Original smoke failure' }
        finally { Complete-NativeTestProfiles (New-ContractProcess $true) @($failed) }
    } catch { $errorPreserved = $_.Exception.Message -eq 'Original smoke failure' }
    Assert-Contract $errorPreserved 'Cleanup masked the original smoke failure'

    $activeProfile = New-NativeTestProfile $root (Join-Path $root 'active')
    $script:webviews = @([pscustomobject]@{
        ProcessId = 77
        ParentProcessId = 1
        CommandLine = 'msedgewebview2 --user-data-dir="' + $activeProfile.Path + '\EBWebView"'
    })
    Complete-NativeTestProfiles $null @($activeProfile)
    Assert-Contract (Test-Path -LiteralPath $activeProfile.Path) 'Active WebView profile was removed'
    $script:webviews = @()

    $locked = New-NativeTestProfile $root (Join-Path $root 'locked')
    $lockPath = Join-Path $locked.Path 'lock.txt'
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        Complete-NativeTestProfiles $null @($locked)
        Assert-Contract (Test-Path -LiteralPath $locked.Path) 'Locked directory was removed'
    } finally { $lock.Dispose() }

    Write-Output "Native profile contracts passed: $script:checks"
} finally {
    $env:ZERITH_KEEP_TEST_PROFILES = $previousKeep
    if ([ZerithNativeProfileIdentity]::Read($root) -ne $rootIdentity) { throw "Contract scratch identity changed: $root" }
    $entries = @(Get-ChildItem -LiteralPath $root -Force -Recurse)
    if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
        throw "Contract scratch contains a link: $root"
    }
    Remove-Item -LiteralPath $root -Recurse -Force
    Write-Output "Contract scratch removed: $root"
}
