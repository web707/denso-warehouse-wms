@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0denso-wms-backend"
echo.
echo =============================================================
echo   MASAN CONSUMER WMS - NAP DU LIEU TEST FEFO
 echo =============================================================
echo.
echo Chi dung tren DATABASE THU NGHIEM. Can backup truoc khi chay.
echo KHONG XOA bang, KHONG RESET kho, KHONG TAO LAI admin.
echo.
if not exist ".env" (
  echo [LOI] Chua co denso-wms-backend\.env. Hay cau hinh DB thu nghiem truoc.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo [LOI] Chua cai dependencies. Hay chay: npm install
  pause
  exit /b 1
)
echo [BUOC 1] Xem truoc du lieu (khong ghi DB):
call npm run seed:masan-demo
if errorlevel 1 (
  echo [LOI] Xem truoc that bai.
  pause
  exit /b 1
)
echo.
set /p VERIFY=Nhap CHAY_TEST de thuc su nap vao DB dang cau hinh: 
if /I not "%VERIFY%"=="CHAY_TEST" (
  echo Da huy. Khong ghi du lieu.
  pause
  exit /b 0
)
set "MASAN_DEMO_SEED=YES"
call npm run seed:masan-demo -- --apply-demo
if errorlevel 1 (
  echo [LOI] Nap test that bai. Chi tiet hien tren man hinh.
  pause
  exit /b 1
)
echo.
echo NAP THANH CONG. Mo web va tai lai trang Hang cu - moi (FEFO).
pause
endlocal
