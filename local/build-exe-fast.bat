@echo off
setlocal EnableExtensions
REM Fast suite EXE build — keeps Cargo cache (no wipe), more parallel jobs.
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

REM Keep cache for speed (do NOT delete target dir)
set "CARGO_TARGET_DIR=%TEMP%\pops-launcher-cargo-target"
set "CARGO_BUILD_JOBS=%NUMBER_OF_PROCESSORS%"
set "CARGO_INCREMENTAL=1"
REM Built-in fallback URL from Active live server (runtime toggle still works)
set "PLATFORM_EDITION=suite"
set "TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\pops-updater.key"

if exist "%APPDATA%\npm\pnpm.cmd" (
  set "PNPM=%APPDATA%\npm\pnpm.cmd"
) else if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
  set "PNPM=%LOCALAPPDATA%\pnpm\pnpm.exe"
) else (
  where pnpm >nul 2>&1
  if errorlevel 1 (
    set "PNPM=npx --yes pnpm@9.15.4"
  ) else (
    set "PNPM=pnpm"
  )
)

echo.
echo [fast-build] API fallback: %VITE_API_BASE_URL%
echo [fast-build] Cargo target: %CARGO_TARGET_DIR%
echo [fast-build] Jobs: %CARGO_BUILD_JOBS%
echo.

mkdir "%CARGO_TARGET_DIR%" 2>nul

cd /d "%~dp0\..\apps\launcher"
call %PNPM% exec node .\scripts\build-edition.mjs suite
if errorlevel 1 (
  echo.
  echo BUILD FAILED.
  exit /b 1
)

set "OUT_DIR=%~dp0..\dist-installers"
mkdir "%OUT_DIR%" 2>nul
for %%F in ("%CARGO_TARGET_DIR%\release\bundle\nsis\*-setup.exe") do (
  copy /Y "%%~fF" "%OUT_DIR%\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Desktop\" >nul
  copy /Y "%%~fF" "%USERPROFILE%\Downloads\" >nul
  echo.
  echo DONE: %%~nxF
  echo   %OUT_DIR%\%%~nxF
  echo   Desktop + Downloads
)

cd /d "%~dp0\..\apps\launcher"
call %PNPM% exec node .\scripts\write-update-manifest.mjs suite
if errorlevel 1 exit /b 1

endlocal
