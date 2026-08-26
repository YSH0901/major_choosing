@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  pause
  exit /b 1
)
node scripts\build-data.mjs
if errorlevel 1 (
  echo.
  echo Data validation failed. Review the messages above.
  pause
  exit /b 1
)
echo.
echo Data bundle updated successfully.
pause
