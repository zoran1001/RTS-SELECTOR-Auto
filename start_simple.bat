@echo off
cd /d "%~dp0"
if not exist "node_modules" (
    start "Installing..." cmd /c npm install --registry=https://registry.npmmirror.com && echo Done && pause
)
start "" cmd /c npm start
exit
