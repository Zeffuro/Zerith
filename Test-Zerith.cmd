@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Node.js is required. Install it, then run npm ci in this folder.
    pause
    popd
    exit /b 1
)
if not exist "node_modules\" (
    echo Dependencies are missing. Run npm ci in this folder first.
    pause
    popd
    exit /b 1
)

if "%~1"=="" goto editor
if /i "%~1"=="web" goto web
if /i "%~1"=="checks" goto checks
if /i "%~1"=="session" goto session
echo Usage: Test-Zerith.cmd [web^|checks^|session]
set "zerithExit=1"
goto finish

:editor
echo Starting the desktop editor. Frontend changes reload automatically.
echo Keep this window open. Press Ctrl+C to stop development.
call npm.cmd run dev:editor
goto result

:web
echo Starting the browser editor. Press Ctrl+C to stop development.
call npm.cmd run dev:editor:web
goto result

:checks
call npm.cmd test
goto result

:session
call npm.cmd run test:editing

:result
set "zerithExit=%errorlevel%"

:finish
if not "%zerithExit%"=="0" echo Zerith exited with code %zerithExit%.
pause
popd
exit /b %zerithExit%
