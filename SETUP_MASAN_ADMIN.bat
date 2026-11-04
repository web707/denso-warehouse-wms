@echo off
chcp 65001 >nul
cd /d "%~dp0denso-wms-backend"
if not exist ".env" (
  echo [ERROR] Missing backend .env. Copy .env.example to .env and update DB/JWT settings before running.
  exit /b 1
)
if not exist "node_modules" (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run setup:admin
if errorlevel 1 exit /b 1
echo Admin setup completed. The warehouse database was not reset.
