; Keep Tauri's current-user installer; customize only its fresh-install default.
!include LogicLib.nsh
!include FileFunc.nsh
!define DFIR_APPLICATION_NAME "DFIR Log Explorer"
!define MUI_CUSTOMFUNCTION_GUIINIT DfirUserInstallDirectory

Function DfirUserInstallDirectory
  Push $0
  Push $1
  ; Tauri restores existing installations before initializing the UI.
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${DFIR_APPLICATION_NAME}" "UninstallString"
  ${If} $0 == ""
  ${AndIf} $INSTDIR == "$LOCALAPPDATA\${DFIR_APPLICATION_NAME}"
    ClearErrors
    ; NSIS removes /D= from $CMDLINE; inspect the original Windows command line.
    System::Call 'kernel32::GetCommandLineW() w.r0'
    ${GetOptions} $0 "/D=" $1
    ${If} ${Errors}
      ; Update invocations must retain their existing installation directory.
      ClearErrors
      ${GetOptions} $CMDLINE "/UPDATE" $1
      ${If} ${Errors}
        StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${DFIR_APPLICATION_NAME}"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ClearErrors
  Pop $1
  Pop $0
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ; Silent installers have no GUI initialization callback.
  ${If} ${Silent}
    Call DfirUserInstallDirectory
    ; Tauri selected its output directory before this hook.
    SetOutPath $INSTDIR
  ${EndIf}
!macroend
