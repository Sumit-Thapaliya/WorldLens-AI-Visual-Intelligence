@echo off
REM Double-click launcher.
REM   no arguments  -> applies fixes, rebuilds, verifies the APK, installs on the device
REM   with arguments -> passed straight through, e.g.  dev.bat -SkipTypecheck
setlocal
set ARGS=%*
if "%ARGS%"=="" set ARGS=-Build
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-fixes.ps1" %ARGS%
echo.
pause
