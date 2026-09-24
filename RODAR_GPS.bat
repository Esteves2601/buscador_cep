@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GPS Simples com Google Maps
echo ============================================
echo  GPS Simples com Google Maps
echo ============================================
echo=
py --version >nul 2>&1
if not errorlevel 1 goto deps
echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/
echo        Marque a opcao "Add python.exe to PATH" na instalacao.
pause
exit /b 1
:deps
py -c "import PySide6, requests" >nul 2>&1
if not errorlevel 1 goto envcfg
echo Instalando dependencias pela primeira vez, aguarde...
echo Isso pode demorar alguns minutos na primeira vez.
py -m pip install -r requirements.txt
echo=
:envcfg
if exist ".env" goto rodar
if not exist ".env.example" goto rodar
copy ".env.example" ".env" >nul
echo Arquivo .env criado. Coloque sua chave do Google nele - ver README.
echo=
:rodar
echo Abrindo o programa GPS Simples...
echo Para encerrar, feche a janela do programa.
echo=
py gps_desktop.py
pause
