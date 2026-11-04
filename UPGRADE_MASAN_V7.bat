@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0denso-wms-backend"
if not exist ".env" (
  echo [ERROR] Chua co denso-wms-backend\.env
  echo Copy .env.example thanh .env va nhap thong tin DB + JWT cua ban.
  exit /b 1
)
if not exist "node_modules" (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo [1/2] Chay migration phan quyen -- KHONG reset data kho
call npm run migration:run
if errorlevel 1 exit /b 1
echo [2/2] Migration xong. Hay deploy lai backend + frontend.
echo Khong tu dong thay mat khau admin hoac xoa du lieu.
endlocal
