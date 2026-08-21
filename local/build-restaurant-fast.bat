@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

call "%~dp0set-build-live-api.bat"

set "MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
set "MSVC_VER=14.44.35207"
set "SDK_VER=10.0.26100.0"
set "KITS=C:\Program Files (x86)\Windows Kits\10"

set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%APPDATA%\npm;%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\bin\Hostx64\x64;%KITS%\bin\%SDK_VER%\x64;%SystemRoot%\System32;%SystemRoot%;%PATH%"
set "LIB=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\lib\x64;%KITS%\Lib\%SDK_VER%\um\x64;%KITS%\Lib\%SDK_VER%\ucrt\x64"
set "INCLUDE=%MSVC_ROOT%\VC\Tools\MSVC\%MSVC_VER%\include;%KITS%\Include\%SDK_VER%\ucrt;%KITS%\Include\%SDK_VER%\um;%KITS%\Include\%SDK_VER%\shared;%KITS%\Include\%SDK_VER%\winrt"

set "CARGO_TARGET_DIR=%TEMP%\pops-launcher-cargo-target"
set "CARGO_BUILD_JOBS=%NUMBER_OF_PROCESSORS%"
set "CARGO_INCREMENTAL=1"
set "PLATFORM_EDITION=restaurant"
set "TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\pops-updater.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD="

if exist "%APPDATA%\npm\pnpm.cmd" (set "PNPM=%APPDATA%\npm\pnpm.cmd") else (set "PNPM=pnpm")

set "OUT_DIR=%~dp0..\dist-installers"
mkdir "%CARGO_TARGET_DIR%" 2>nul
mkdir "%OUT_DIR%" 2>nul

cd /d "%~dp0\..\apps\launcher"
echo === BUILD Restaurant ===
call %PNPM% exec node .\scripts\build-edition.mjs restaurant
if errorlevel 1 exit /b 1

for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*Restaurant*-setup.exe") do (
  copy /Y "%%~fF" "%OUT_DIR%\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Desktop\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Downloads\" >nul
  if exist "%%~fF.sig" copy /Y "%%~fF.sig" "%OUT_DIR%\" >nul
  echo DONE: %%~nxF
)

call %PNPM% exec node .\scripts\write-update-manifest.mjs restaurant
if errorlevel 1 exit /b 1
echo RESTAURANT_BUILD_OK
exit /b 0
