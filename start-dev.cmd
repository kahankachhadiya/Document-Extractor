@echo off
title Form Master Pro - Development Server
echo ========================================
echo Form Master Pro - Development Launcher
echo ========================================
echo Starting Backend and Frontend Servers
echo ========================================

cd /d "%~dp0"

echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found - OK
echo.

echo Checking dependencies...
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
) else (
    echo Dependencies found - OK
)

echo.
echo Checking for concurrently...
if not exist node_modules\concurrently (
    echo Installing concurrently...
    npm install -D concurrently
    if errorlevel 1 (
        echo ERROR: Failed to install concurrently
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Checking for existing processes on ports 5173 and 5174...
netstat -ano | findstr :5173 >nul 2>&1
if not errorlevel 1 (
    echo Killing existing process on port 5173...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /PID %%a /F >nul 2>&1
)

netstat -ano | findstr :5174 >nul 2>&1
if not errorlevel 1 (
    echo Killing existing process on port 5174...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174') do taskkill /PID %%a /F >nul 2>&1
)

echo Starting development servers...
echo Backend API: http://localhost:5174
echo Frontend Web: http://localhost:5173
echo Admin Panel: http://localhost:5173/admin
echo.
echo Press Ctrl+C to stop both servers
echo ========================================
echo.

npm run dev:full
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start servers
    echo Check if ports 5173 and 5174 are available
    echo.
)

echo.
echo Development servers stopped.
pause