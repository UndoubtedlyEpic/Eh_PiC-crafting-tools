@echo off
rem Tablet pricing guide launcher: starts its own server on port 8767 and opens the page.
cd /d %~dp0
curl -s -m 2 http://127.0.0.1:8767/api/ping >nul 2>&1
if %errorlevel%==0 (
  start http://127.0.0.1:8767/tablet_sim.html
  exit /b 0
)
start http://127.0.0.1:8767/tablet_sim.html
python server.py
