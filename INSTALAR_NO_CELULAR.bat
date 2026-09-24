@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Instalar Buscador de CEP no celular
echo ============================================
echo  Buscador de CEP - instalar no celular
echo  (celular e PC no mesmo Wi-Fi)
echo ============================================
echo=
py --version >nul 2>&1
if not errorlevel 1 goto run
echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/
pause
exit /b 1
:run
py instalar_celular.py
pause
