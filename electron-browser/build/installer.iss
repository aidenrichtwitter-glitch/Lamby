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
const
  DarkBg = TColor($181218);
  DarkField = TColor($282228);
  TextWhite = TColor($FFFFFF);
  TextGrey = TColor($CCCCCC);
  TextDim = TColor($999999);

procedure InitializeWizard();
begin
  WizardForm.Color := DarkBg;
  WizardForm.MainPanel.Color := DarkBg;
  WizardForm.InnerPage.Color := DarkBg;
  WizardForm.OuterNotebook.Color := DarkBg;
  WizardForm.InnerNotebook.Color := DarkBg;

  WizardForm.WelcomeLabel1.Font.Color := TextWhite;
  WizardForm.WelcomeLabel2.Font.Color := TextGrey;
  WizardForm.PageNameLabel.Font.Color := TextWhite;
  WizardForm.PageDescriptionLabel.Font.Color := TextGrey;

  WizardForm.ReadyLabel.Font.Color := TextGrey;
  WizardForm.FinishedLabel.Font.Color := TextGrey;
  WizardForm.FinishedHeadingLabel.Font.Color := TextWhite;

  WizardForm.SelectDirLabel.Font.Color := TextGrey;
  WizardForm.SelectDirBrowseLabel.Font.Color := TextGrey;
  WizardForm.DirEdit.Color := DarkField;
  WizardForm.DirEdit.Font.Color := TextWhite;

  WizardForm.TasksList.Color := DarkField;
  WizardForm.TasksList.Font.Color := TextGrey;

  WizardForm.StatusLabel.Font.Color := TextGrey;
  WizardForm.FilenameLabel.Font.Color := TextDim;
end;
