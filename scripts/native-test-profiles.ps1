if (-not ('ZerithNativeProfileIdentity' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class ZerithNativeProfileIdentity {
    [StructLayout(LayoutKind.Sequential)]
    private struct Info {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string path, uint access, uint share,
        IntPtr security, uint mode, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Info info);
    public static string Read(string path) {
        using (var handle = CreateFile(path, 0, 7, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero)) {
            if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            Info info;
            if (!GetFileInformationByHandle(handle, out info))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            if ((info.Attributes & 0x400) != 0 || (info.Attributes & 0x10) == 0)
                throw new InvalidOperationException("Profile path is not an ordinary directory: " + path);
            return String.Join(":", info.Volume, info.IndexHigh, info.IndexLow,
                info.Created.dwHighDateTime, info.Created.dwLowDateTime);
        }
    }
}
'@
}

function Get-NativeProfileAncestors([string]$Path) {
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        [pscustomobject]@{ Path = $current; Identity = [ZerithNativeProfileIdentity]::Read($current) }
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

function New-NativeTestProfile([string]$RunRoot, [string]$Path) {
    $root = [IO.Path]::GetFullPath($RunRoot).TrimEnd('\', '/')
    $target = [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    if (!$target.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Profile is outside the smoke output: $target"
    }
    $ancestors = @(Get-NativeProfileAncestors (Split-Path -Parent $target))
    if (Test-Path -LiteralPath $target) { throw "Smoke profile already exists: $target" }
    New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
    [pscustomobject]@{
        Root = $root
        Path = $target
        Identity = [ZerithNativeProfileIdentity]::Read($target)
        Ancestors = $ancestors
    }
}

function Get-NativeProfileProcesses($Profiles, [int]$RootProcessId = 0, $KnownProcessIds = @()) {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" -ErrorAction Stop)
    $ownedIds = [Collections.Generic.HashSet[int]]::new()
    if ($RootProcessId) { $null = $ownedIds.Add($RootProcessId) }
    foreach ($knownId in $KnownProcessIds) { $null = $ownedIds.Add([int]$knownId) }
    foreach ($entry in $processes) {
        if (!$entry.CommandLine) { throw "Cannot inspect WebView process $($entry.ProcessId)" }
        $match = [regex]::Match($entry.CommandLine, '(?i)(?:"--user-data-dir=([^"]+)"|--user-data-dir=(?:"([^"]+)"|([^\s"]+)))')
        if (!$match.Success) { continue }
        $dataPath = @($match.Groups | Select-Object -Skip 1 | Where-Object Success)[0].Value
        $dataPath = [IO.Path]::GetFullPath($dataPath).TrimEnd('\', '/')
        foreach ($profile in $Profiles) {
            if ($dataPath.Equals($profile.Path, [StringComparison]::OrdinalIgnoreCase) -or
                $dataPath.StartsWith($profile.Path + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                $null = $ownedIds.Add([int]$entry.ProcessId)
                break
            }
        }
    }
    do {
        $added = $false
        foreach ($entry in $processes) {
            if ($ownedIds.Contains([int]$entry.ParentProcessId) -and $ownedIds.Add([int]$entry.ProcessId)) { $added = $true }
        }
    } while ($added)
    foreach ($entry in $processes) {
        if ($ownedIds.Contains([int]$entry.ProcessId)) { $entry }
    }
}

function Complete-NativeTestProfiles($Process, $Profiles) {
    try {
        $rootProcessId = if ($Process) { $Process.Id } else { 0 }
        $inspectionError = $null
        $knownIds = @()
        try { $knownIds = @(Get-NativeProfileProcesses $Profiles $rootProcessId | ForEach-Object ProcessId) }
        catch { $inspectionError = $_ }
        if ($Process) {
            # Keep the process handle so PID reuse cannot target another application.
            if (!$Process.HasExited) {
                $null = $Process.CloseMainWindow()
                if (!$Process.WaitForExit(5000)) {
                    $Process.Kill()
                    if (!$Process.WaitForExit(10000)) { throw 'Owned smoke process did not exit' }
                }
            }
        }
        if ($inspectionError) { throw $inspectionError }
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        while ($true) {
            $active = @(Get-NativeProfileProcesses $Profiles $rootProcessId $knownIds)
            if (!$active.Count) { break }
            $knownIds = @($active | ForEach-Object ProcessId)
            if ([DateTime]::UtcNow -ge $deadline) { throw 'WebView processes still hold the smoke profile' }
            Start-Sleep -Milliseconds 250
        }
        if ($env:ZERITH_KEEP_TEST_PROFILES -eq '1') {
            foreach ($profile in $Profiles) { Write-Warning "Smoke profile retained: $($profile.Path)" -WarningAction Continue }
            return
        }
        foreach ($profile in $Profiles) {
            try {
                $target = [IO.Path]::GetFullPath($profile.Path).TrimEnd('\', '/')
                if (!$target.Equals($profile.Path, [StringComparison]::OrdinalIgnoreCase) -or
                    !$target.StartsWith($profile.Root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                    throw 'Smoke profile path changed'
                }
                foreach ($ancestor in $profile.Ancestors) {
                    if ([ZerithNativeProfileIdentity]::Read($ancestor.Path) -ne $ancestor.Identity) {
                        throw "Smoke profile ancestor changed: $($ancestor.Path)"
                    }
                }
                if ([ZerithNativeProfileIdentity]::Read($target) -ne $profile.Identity) { throw 'Smoke profile was replaced' }
                $pending = [Collections.Generic.Stack[string]]::new()
                $pending.Push($target)
                while ($pending.Count) {
                    foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop) {
                        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Smoke profile contains a link: $($entry.FullName)" }
                        if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
                    }
                }
                foreach ($ancestor in $profile.Ancestors) {
                    if ([ZerithNativeProfileIdentity]::Read($ancestor.Path) -ne $ancestor.Identity) {
                        throw "Smoke profile ancestor changed: $($ancestor.Path)"
                    }
                }
                if ([ZerithNativeProfileIdentity]::Read($target) -ne $profile.Identity) { throw 'Smoke profile was replaced' }
                Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
            } catch {
                Write-Warning "Smoke profile retained at $($profile.Path): $($_.Exception.Message)" -WarningAction Continue
            }
        }
    } catch {
        foreach ($profile in $Profiles) {
            Write-Warning "Smoke profile retained at $($profile.Path): $($_.Exception.Message)" -WarningAction Continue
        }
    } finally {
        if ($Process) {
            try { $Process.Dispose() } catch { Write-Warning $_.Exception.Message -WarningAction Continue }
        }
    }
}
