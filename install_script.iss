[Setup]
AppName=Refait Autoclicker
AppVersion=1.0.1
DefaultDirName={autopf}\Refait Autoclicker
DefaultGroupName=Refait
OutputDir=.\Installer
OutputBaseFilename=Install_RefaitAC_v1.0.1
Compression=lzma2
SolidCompression=yes
SetupIconFile=Refait.ico
UninstallDisplayIcon={app}\Refait Autoclicker.exe

[Files]
Source: "dist\Refait Autoclicker\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\Refait Autoclicker"; Filename: "{app}\Refait Autoclicker.exe"
Name: "{group}\Refait Autoclicker"; Filename: "{app}\Refait Autoclicker.exe"

[Run]
Filename: "{app}\Refait Autoclicker.exe"; Description: "Lancer Refait Autoclicker"; Flags: nowait postinstall skipifsilent
