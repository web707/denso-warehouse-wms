@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo === MASAN CONSUMER WMS V8 - CHECKLIST TRIỂN KHAI ===
echo 1. Sao luu PostgreSQL va sao luu .env hien tai truoc khi nang cap.
echo 2. Chay cac lenh ben duoi THU CONG tai terminal:
echo.
echo cd denso-wms-backend
 echo npm ci
 echo npm run migration:run
 echo npm run build
 echo.
echo cd ..\denso-wms-frontend
 echo npm ci
 echo npm run build
 echo.
echo Khong co lenh nao tu dong xoa database hay chay seed demo.
pause
