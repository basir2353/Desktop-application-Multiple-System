@echo off
cd /d "%~dp0\.."
echo Stopping local Postgres...
docker compose down
echo Done. (Close the start-local.bat window to stop the API too.)
pause
