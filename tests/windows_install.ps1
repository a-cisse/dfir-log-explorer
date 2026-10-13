param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$setup = (Get-Item $Installer).FullName
$appName = 'DFIR Log Explorer'
$defaultPath = Join-Path $env:LOCALAPPDATA "Programs\$appName"
$customPath = Join-Path $env:LOCALAPPDATA $appName
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName"
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) "$appName.lnk"

# Check the real setup executable's embedded elevation declaration.
$setupText = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($setup))
if ($setupText -notmatch 'requestedExecutionLevel\s+level="asInvoker"') {
    throw 'The installer must request the current user token.'
}
if (Test-Path $registryPath) { throw 'Installer smoke requires a fresh CI profile.' }
foreach ($path in @($defaultPath, $customPath)) {
    if (Test-Path $path) { throw "Refusing to overwrite an existing directory: $path" }
}

function Install-App([string]$arguments, [string]$expectedPath) {
    $process = Start-Process $setup -ArgumentList $arguments -PassThru
    if (-not $process.WaitForExit(120000)) { throw 'Installer timed out.' }
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
    if (-not (Test-Path (Join-Path $expectedPath 'dfir-log-explorer.exe'))) {
        throw "Application missing from $expectedPath"
    }
    $location = (Get-ItemProperty $registryPath).InstallLocation.Trim('"')
    if ($location -ne $expectedPath) { throw "Wrong install location: $location" }
    $link = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
    if ($link.TargetPath -ne (Join-Path $expectedPath 'dfir-log-explorer.exe')) {
        throw 'Current-user Start menu shortcut points to the wrong executable.'
    }
    Write-Host "Passed installation/reinstallation: $expectedPath"
}

function Uninstall-App([string]$path) {
    $uninstaller = Join-Path $path 'uninstall.exe'
    # _?= runs this generated uninstaller in place, without a detached temp copy.
    $process = Start-Process $uninstaller -ArgumentList "/S _?=$path" -PassThru
    if (-not $process.WaitForExit(60000)) { throw 'Uninstaller timed out.' }
    if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
    if (Test-Path $registryPath) { throw 'Current-user uninstall registration remains.' }
    if (Test-Path (Join-Path $path 'dfir-log-explorer.exe')) { throw 'Application remains after uninstall.' }
    if (Test-Path $shortcut) { throw 'Start menu shortcut remains after uninstall.' }
    # _?= deliberately leaves the running uninstaller file behind.
    Remove-Item $uninstaller
    Remove-Item $path
}

Install-App '/S' $defaultPath
Install-App '/S' $defaultPath
Uninstall-App $defaultPath
# Explicitly choosing the old default must not be redirected to Programs.
Install-App "/S /D=$customPath" $customPath
Install-App '/S' $customPath
Uninstall-App $customPath
Write-Host 'Passed: asInvoker manifest, fresh default, explicit path, reinstallation, user shortcuts/registry and uninstall.'
Write-Host 'CI uses its existing runner account; interactive standard-user Windows acceptance remains required.'
