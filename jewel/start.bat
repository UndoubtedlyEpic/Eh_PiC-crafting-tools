@echo off
rem Jewel simulator launcher: starts its own server on port 8766 (the crafting advisor and the hub use 8765) and opens the page.
cd /d %~dp0
curl -s -m 2 http://127.0.0.1:8766/api/ping >nul 2>&1
if %errorlevel%==0 (
  start http://127.0.0.1:8766/jewel_sim.html
  exit /b 0
)
start http://127.0.0.1:8766/jewel_sim.html
python server.py
