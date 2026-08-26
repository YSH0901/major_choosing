@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  pause
  exit /b 1
)
start "Explorer local server" /min node scripts\serve.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
