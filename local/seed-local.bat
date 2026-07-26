@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if exist "local\.env" copy /Y "local\.env" ".env" >nul

echo Seeding LOCAL database (Docker Postgres on :15432)...
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  set "PNPM=corepack pnpm"
) else (
  set "PNPM=pnpm"
)

call %PNPM% db:push
if errorlevel 1 (
  echo [ERROR] db:push failed. Is Postgres up? Run local\start-local.bat first.
  pause
  exit /b 1
)

REM Boot API briefly so Nest onModuleInit seeds run, or use seed script if present.
if exist "scripts\seed-live-platform.mjs" (
  echo Running scripts\seed-live-platform.mjs against local DATABASE_URL...
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "DATABASE_URL=" local\.env`) do set "DATABASE_URL=%%B"
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "SEED_USER_PASSWORD=" local\.env`) do set "SEED_USER_PASSWORD=%%B"
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "SEED_SUPER_ADMIN_PASSWORD=" local\.env`) do set "SEED_SUPER_ADMIN_PASSWORD=%%B"
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "SEED_SUPER_ADMIN_EMAIL=" local\.env`) do set "SEED_SUPER_ADMIN_EMAIL=%%B"
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "SEED_SUPER_ADMIN_EMAIL_2=" local\.env`) do set "SEED_SUPER_ADMIN_EMAIL_2=%%B"
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "SEED_USER_EMAIL=" local\.env`) do set "SEED_USER_EMAIL=%%B"
  node scripts\seed-live-platform.mjs
) else (
  echo [INFO] Start API once with local\start-local.bat — Nest will auto-seed on boot.
)

echo.
echo Done. Logins:
echo   Super Admin : superadmin@pops.platform / SuperAdmin@123
echo   Owner       : admin.restaurant@pops.demo / Owner@12345
echo   Staff       : cashier1@platform.local / Staff@12345
pause
