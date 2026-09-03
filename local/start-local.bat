@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ============================================
echo  POPS Local API  -  for desktop EXE
echo  URL: http://127.0.0.1:3000
echo ============================================
echo.

REM Prefer local\.env for this machine
if exist "local\.env" (
  copy /Y "local\.env" ".env" >nul
  echo [OK] Copied local\.env -^> .env
) else (
  echo [WARN] local\.env missing — using existing root .env
)

set "USE_DOCKER_PG=0"
where docker >nul 2>&1
if not errorlevel 1 set "USE_DOCKER_PG=1"

if "%USE_DOCKER_PG%"=="1" (
  echo.
  echo [1/3] Starting Postgres ^(docker compose^)...
  docker compose up -d
  if errorlevel 1 (
    echo [ERROR] docker compose failed.
    pause
    exit /b 1
  )
  echo.
  echo [2/3] Waiting for Postgres...
  timeout /t 5 /nobreak >nul
) else (
  echo.
  echo [1/3] Docker not found — using local Postgres from local\.env DATABASE_URL
  echo [2/3] Skipping docker wait...
  if not exist "local\.env" (
    echo [ERROR] local\.env missing. Create it with DATABASE_URL for your local Postgres.
    pause
    exit /b 1
  )
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] pnpm not found. Run: npm install -g pnpm
    pause
    exit /b 1
  )
  set "PNPM=corepack pnpm"
) else (
  set "PNPM=pnpm"
)

echo.
echo [3/3] Schema push + auth tables + starting API on :3000 ...
call %PNPM% db:push
if errorlevel 1 (
  echo [WARN] db:push failed — trying ensure-schema fallback...
)
node backend-desktop\api\scripts\ensure-schema.mjs auth
if errorlevel 1 (
  echo [WARN] ensure-schema auth patch failed — check DATABASE_URL / Postgres.
)

echo.
echo API starting... Keep this window OPEN.
echo In the EXE login screen: select  Local API
echo Then sign in (see local\README.md for passwords).
echo.
call %PNPM% dev:api

pause
