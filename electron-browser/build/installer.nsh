!macro customHeader
  !system "echo 'Custom NSIS header loaded'"
!macroend

!macro preInit
  SetSilent silent
!macroend

!macro customInstall
  DetailPrint "Installing Lamby..."
!macroend
