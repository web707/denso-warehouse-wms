@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0denso-wms-backend"
echo MASAN CONSUMER WMS - 1 ZONE TEST / R01 NUOC MAM / R02 MI TOM / R03 NUOC NGOT
echo CHI CHAY DATABASE TEST. Script khong xoa hay reset du lieu.
if not exist ".env" (echo LOI: Chua co file .env & pause & exit /b 1)
if not exist "node_modules" (echo LOI: Hay chay npm install trong backend truoc & pause & exit /b 1)
call npm run seed:masan-three-racks
if errorlevel 1 (pause & exit /b 1)
echo.
echo Kiem tra DB_NAME trong .env: phai co chu test hoac demo.
set /p VERIFY=Nhap CHAY_TEST de nap 60 PART vao 1 Zone test: 
if /I not "%VERIFY%"=="CHAY_TEST" (echo Da huy & pause & exit /b 0)
set MASAN_THREE_RACK_SEED=YES
call npm run seed:masan-three-racks -- --apply-three-racks
if errorlevel 1 (echo LOI: giao dich rollback / khong nhap thanh cong & pause & exit /b 1)
echo NAP THANH CONG. Vao So do kho theo Zone, chon ZONE-TEST-3R.
pause
endlocal
