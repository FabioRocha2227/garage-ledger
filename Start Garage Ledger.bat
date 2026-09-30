@echo off
title Garage Ledger
cd /d "%~dp0backend"

where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo Python was not found on this computer.
    echo.
    echo Please install it from https://python.org
    echo IMPORTANT: on the first setup screen, tick "Add python.exe to PATH".
    echo Then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist ".setup_done" (
    echo Setting up Garage Ledger for the first time...
    echo This only happens once and may take a minute or two.
    echo.
    python -m pip install --quiet --disable-pip-version-check -r requirements.txt
    if errorlevel 1 (
        echo.
        echo Something went wrong installing the required components.
        echo Please check your internet connection, then run this file again.
        echo.
        pause
        exit /b 1
    )
    echo ok > .setup_done
    echo Setup complete.
    echo.
)

cd /d "%~dp0"
python -m backend.launcher
set "LAUNCHER_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%LAUNCHER_EXIT_CODE%"=="0" echo Garage Ledger stopped with exit code %LAUNCHER_EXIT_CODE%.
pause
exit /b %LAUNCHER_EXIT_CODE%
