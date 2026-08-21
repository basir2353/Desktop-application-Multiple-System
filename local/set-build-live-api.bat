@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
for /f "delims=" %%U in ('node "local\read-live-api-url.mjs"') do set "VITE_API_BASE_URL=%%U"
for /f "delims=" %%U in ('node "local\read-live-api-url.mjs"') do set "EXPO_PUBLIC_API_BASE_URL=%%U"
echo [live-api] Active server baked into build: %VITE_API_BASE_URL%
exit /b 0
