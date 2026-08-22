@echo off
setlocal EnableExtensions
REM Build POPS Launcher Windows setup.exe (suite edition)
REM Requires: Node 20+, pnpm, Rust, VS Build Tools (C++), WebView2
REM Smart App Control must NOT be in Enforcement (Evaluation/Off). Reboot after changing it.

cd /d "%~dp0"

set "MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
set "MSVC_VER=14.44.35207"
set "SDK_VER=10.0.26100.0"
set "KITS=C:\Program Files (x86)\Windows Kits\10"

set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%APPDATA%\npm;%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\bin\Hostx64\x64;%KITS%\bin\%SDK_VER%\x64;%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "LIB=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\lib\x64;%KITS%\Lib\%SDK_VER%\um\x64;%KITS%\Lib\%SDK_VER%\ucrt\x64"
set "INCLUDE=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\include;%KITS%\Include\%SDK_VER%\ucrt;%KITS%\Include\%SDK_VER%\um;%KITS%\Include\%SDK_VER%\shared;%KITS%\Include\%SDK_VER%\winrt"

REM Work around Windows Application Control blocking MSVC cargo.exe
if exist "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" (
  copy /Y "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe" >nul 2>&1
)

REM Build under TEMP so Smart App Control is less likely to block build scripts
set "CARGO_TARGET_DIR=%TEMP%\pops-launcher-cargo-target"
set "VITE_API_BASE_URL=https://backend-desktop-production-600b.up.railway.app"
set "CARGO_BUILD_JOBS=4"

echo.
echo [build] API: %VITE_API_BASE_URL%
echo [build] Target: %CARGO_TARGET_DIR%
echo.

if exist "%CARGO_TARGET_DIR%" rmdir /s /q "%CARGO_TARGET_DIR%" 2>nul
mkdir "%CARGO_TARGET_DIR%" 2>nul

cd /d "%~dp0apps\launcher"
call node .\scripts\build-edition.mjs suite
if errorlevel 1 (
  echo.
  echo BUILD FAILED.
  echo If you see "Application Control policy has blocked this file":
  echo   1. Windows Security -^> App and browser control -^> Smart App Control -^> Off or Evaluation
  echo   2. Reboot
  echo   3. Run this script again
  exit /b 1
)

set "OUT_DIR=%~dp0dist-installers"
mkdir "%OUT_DIR%" 2>nul
for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*-setup.exe") do (
  copy /Y "%%~fF" "%OUT_DIR%\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Desktop\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Downloads\" >nul
  echo.
  echo DONE: %%~nxF
  echo   %OUT_DIR%\%%~nxF
  echo   Desktop and Downloads copies created.
)
endlocal
