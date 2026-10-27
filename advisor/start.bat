@echo off
cd /d %~dp0
rem Reuse a server that is already running; otherwise start one. Either way open the hub.
curl -s -m 2 http://127.0.0.1:8765/api/ping >nul 2>&1
if %errorlevel%==0 (
  start http://127.0.0.1:8765/hub.html
  exit /b 0
)
start http://127.0.0.1:8765/hub.html
python server.py
