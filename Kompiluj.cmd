@echo off
setlocal
cd /d "%~dp0"
title Kompilowanie PCC
echo Budowanie PCC z zachowaniem bazy i konfiguracji.
echo Zamknij PCC rowniez przy zegarze. Nie uruchamiaj go podczas kompilacji.
echo.
node scripts\build-portable.mjs
set "BUILD_RESULT=%ERRORLEVEL%"
echo.
if not "%BUILD_RESULT%"=="0" echo Kompilacja lub aktualizacja nie powiodla sie. Sprawdz komunikat powyzej.
pause
exit /b %BUILD_RESULT%
