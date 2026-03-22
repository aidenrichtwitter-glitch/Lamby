#define MyAppName "Lamby"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Lamby"
#define MyAppExeName "Lamby.exe"

[Setup]
AppId={{B8F3A1D2-7C4E-4F9A-B6D1-E5A2C8F07B34}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\..\exe
OutputBaseFilename=Lamby-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardImageFile=wizardimage.bmp
WizardSmallImageFile=wizardsmallimage.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\..\exe\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard();
begin
  WizardForm.Color := $181218;
  WizardForm.MainPanel.Color := $181218;
  WizardForm.InnerPage.Color := $181218;
  WizardForm.OuterNotebook.Color := $181218;
  WizardForm.InnerNotebook.Color := $181218;
  WizardForm.WelcomeLabel1.Font.Color := $FFFFFF;
  WizardForm.WelcomeLabel2.Font.Color := $CCCCCC;
  WizardForm.PageNameLabel.Font.Color := $FFFFFF;
  WizardForm.PageDescriptionLabel.Font.Color := $CCCCCC;
  WizardForm.ReadyLabel.Font.Color := $CCCCCC;
  WizardForm.FinishedLabel.Font.Color := $CCCCCC;
  WizardForm.FinishedHeadingLabel.Font.Color := $FFFFFF;
  WizardForm.SelectDirLabel.Font.Color := $CCCCCC;
  WizardForm.SelectDirBrowseLabel.Font.Color := $CCCCCC;
  WizardForm.DirEdit.Color := $282228;
  WizardForm.DirEdit.Font.Color := $FFFFFF;
  WizardForm.TasksList.Color := $282228;
  WizardForm.TasksList.Font.Color := $CCCCCC;
  WizardForm.StatusLabel.Font.Color := $CCCCCC;
  WizardForm.FilenameLabel.Font.Color := $999999;
end;
