@echo off
echo Checking Local API http://127.0.0.1:3000/health ...
curl -s -o NUL -w "HTTP %%{http_code}\n" http://127.0.0.1:3000/health
if errorlevel 1 (
  echo FAIL — API not running. Double-click local\start-local.bat
) else (
  curl -s http://127.0.0.1:3000/health
  echo.
)
pause
