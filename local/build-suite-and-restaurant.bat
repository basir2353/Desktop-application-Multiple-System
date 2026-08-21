@echo off
setlocal EnableExtensions
REM Fast Universal (suite) + Restaurant EXE builds with signed auto-update artifacts.
cd /d "%~dp0\.."

call "%~dp0set-build-live-api.bat"

set "MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
set "MSVC_VER=14.44.35207"
set "SDK_VER=10.0.26100.0"
set "KITS=C:\Program Files (x86)\Windows Kits\10"

set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%APPDATA%\npm;%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\bin\Hostx64\x64;%KITS%\bin\%SDK_VER%\x64;%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "LIB=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\lib\x64;%KITS%\Lib\%SDK_VER%\um\x64;%KITS%\Lib\%SDK_VER%\ucrt\x64"
set "INCLUDE=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\include;%KITS%\Include\%SDK_VER%\ucrt;%KITS%\Include\%SDK_VER%\um;%KITS%\Include\%SDK_VER%\shared;%KITS%\Include\%SDK_VER%\winrt"

if exist "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" (
  copy /Y "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe" "%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe" >nul 2>&1
)

set "CARGO_TARGET_DIR=%TEMP%\pops-launcher-cargo-target"
set "CARGO_BUILD_JOBS=%NUMBER_OF_PROCESSORS%"
set "CARGO_INCREMENTAL=1"
REM Live API from Super Admin Active server (local/live-env.json)

REM Required for updater .sig artifacts (empty-password CI key)
set "TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\pops-updater.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="
if not exist "%TAURI_SIGNING_PRIVATE_KEY_PATH%" (
  echo Missing updater private key: %TAURI_SIGNING_PRIVATE_KEY_PATH%
  echo Run: cd apps\launcher ^& pnpm exec tauri signer generate -w "%USERPROFILE%\.tauri\pops-updater.key" --ci
  exit /b 1
)

if exist "%APPDATA%\npm\pnpm.cmd" (
  set "PNPM=%APPDATA%\npm\pnpm.cmd"
) else if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
  set "PNPM=%LOCALAPPDATA%\pnpm\pnpm.exe"
) else (
  set "PNPM=pnpm"
)

set "OUT_DIR=%~dp0..\dist-installers"
mkdir "%CARGO_TARGET_DIR%" 2>nul
mkdir "%OUT_DIR%" 2>nul

cd /d "%~dp0\..\apps\launcher"

echo.
echo === BUILD 1/2: Universal (suite) + updater sig ===
set "PLATFORM_EDITION=suite"
call %PNPM% exec node .\scripts\build-edition.mjs suite
if errorlevel 1 (
  echo BUILD FAILED: suite
  exit /b 1
)
call :COPY_INSTALLERS SUITE
call %PNPM% exec node .\scripts\write-update-manifest.mjs suite
if errorlevel 1 exit /b 1

echo.
echo === BUILD 2/2: Restaurant + updater sig ===
set "PLATFORM_EDITION=restaurant"
call %PNPM% exec node .\scripts\build-edition.mjs restaurant
if errorlevel 1 (
  echo BUILD FAILED: restaurant
  exit /b 1
)
call :COPY_INSTALLERS RESTAURANT
call %PNPM% exec node .\scripts\write-update-manifest.mjs restaurant
if errorlevel 1 exit /b 1

echo.
echo === BOTH BUILDS COMPLETE ===
echo Update manifests: %OUT_DIR%\updates\
echo Next: publish with local\publish-desktop-release.bat 0.3.10
exit /b 0

:COPY_INSTALLERS
if /I "%~1"=="SUITE" (
  for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*Universal*-setup.exe") do call :COPY_ONE %%~1 "%%~fF"
) else (
  for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*Restaurant*-setup.exe") do call :COPY_ONE %%~1 "%%~fF"
)
goto :eof

:COPY_ONE
set "SRC=%~2"
if not exist "%SRC%" exit /b 0
copy /Y "%SRC%" "%OUT_DIR%\" >nul
copy /Y "%SRC%" "%USERPROFILE%\Desktop\" >nul
copy /Y "%SRC%" "%USERPROFILE%\Downloads\" >nul
if exist "%SRC%.sig" copy /Y "%SRC%.sig" "%OUT_DIR%\" >nul
echo DONE_%~1: %~nx2
echo   %OUT_DIR%\%~nx2
echo   Desktop + Downloads
exit /b 0
