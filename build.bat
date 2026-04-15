@echo off
echo ===========================================
echo       COMPILATEUR REFAIT AUTOCLICKER       
echo ===========================================

echo.
echo [1/3] Construction de l'interface (React)...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo [2/3] Empaquetage de l'excutable (PyInstaller)...
call uv run pyinstaller refait_ac.spec --clean --noconfirm

echo.
echo [3/3] Installeur Inno Setup...
echo Verifiez si Inno Setup est installe dans le repertoire par defaut.
IF EXIST "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" install_script.iss
    echo Installeur cree avec succes dans le dossier "Installer/" !
) ELSE (
    echo Note : Inno Setup n'est pas installe. Le dossier dist/ contient l'application finale que vous pouvez compresser ou utiliser Inno Setup manuellement.
)

echo.
echo Compilation terminee !
pause
