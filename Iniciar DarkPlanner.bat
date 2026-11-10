@echo off
chcp 65001 >nul
title DarkPlanner Studio — Canais Dark & SRT Sync

echo ========================================================
echo          ⚡ INICIANDO DARKPLANNER STUDIO ⚡
echo                (100%% Local e Offline)
echo ========================================================
echo.

cd /d "%~dp004-build"

:: Verificar se já está rodando na porta 4050
netstat -ano | findstr :4050 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] O DarkPlanner Studio já está em execução na porta 4050!
    echo Abrindo o painel no navegador...
    start http://localhost:4050
    exit /b 0
)

:: Iniciar servidor em segundo plano
echo Iniciando servidor local na porta 4050...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp004-build' -WindowStyle Hidden"

:: Aguardar 2 segundos para o servidor subir
timeout /t 2 /nobreak >nul

echo Abrindo interface do DarkPlanner Studio...
start http://localhost:4050

echo.
echo ========================================================
echo   ✅ Tudo pronto! O DarkPlanner Studio está aberto.
echo ========================================================
timeout /t 3 >nul
exit /b 0

