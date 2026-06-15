@echo off
chcp 65001 >nul
echo ================================================
echo    Image Composer Electron v0.5.2 Launcher
echo ================================================
echo.

REM Set working directory
cd /d "%~dp0"

REM Check Python environment
echo [1/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)
echo [OK] Python is available

REM Check Node.js environment
echo [2/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 16+
    pause
    exit /b 1
)
echo [OK] Node.js is available

REM Check bridge file
echo [3/5] Checking files...
if not exist "bridge\bridge.py" (
    echo [ERROR] bridge\bridge.py not found
    pause
    exit /b 1
)
echo [OK] Bridge file exists

REM Install Node.js dependencies
echo [4/5] Installing Node.js dependencies...
if exist "node_modules" (
    echo [INFO] Removing old node_modules for clean install...
    rmdir /s /q "node_modules" 2>nul
)
echo [INFO] Running npm install (this may take a few minutes)...
call npm install --registry=https://registry.npmmirror.com
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
echo [OK] Node.js dependencies installed

REM Install Python dependencies
echo [5/5] Checking Python dependencies...
if exist "requirements.txt" (
    pip install -q -r requirements.txt 2>nul
    echo [OK] Python dependencies checked
) else (
    echo [WARNING] requirements.txt not found, skipping Python deps
)

echo.
echo ================================================
echo    Starting Image Composer...
echo ================================================
echo.

call npm start

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start app, error code: %errorlevel%
    pause
    exit /b %errorlevel%
)

echo.
echo [OK] App exited
pause
