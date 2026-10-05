@echo off
REM Lanzador para Windows: doble clic y listo.
cd /d "%~dp0"
chcp 65001 >nul
where py >nul 2>nul && (py -3 escuchar_claude.py %*) || (python escuchar_claude.py %*)
if errorlevel 1 (
  echo.
  echo Algo fallo. Si es la primera vez, instala las librerias con:
  echo     pip install -r requirements.txt
)
pause
