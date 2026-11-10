@echo off
chcp 65001 >nul
title Parar DarkPlanner Studio

echo ========================================================
echo        🛑 PARANDO DARKPLANNER STUDIO (Porta 4050)
echo ========================================================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4050 ^| findstr LISTENING') do (
    echo Encerrando processo PID: %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [OK] DarkPlanner Studio foi encerrado.
timeout /t 2 >nul
exit /b 0

