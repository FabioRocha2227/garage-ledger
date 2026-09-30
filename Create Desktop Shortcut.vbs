' Double-click this once. It creates a "Garage Ledger" shortcut on your
' Desktop, pointing at "Start Garage Ledger.bat" but using assets\icon.ico as its
' picture. Windows shortcuts can have a custom icon; .bat files themselves
' cannot, which is why this extra step exists.
'
' Safe to run more than once - it just recreates the same shortcut.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strFolder = fso.GetParentFolderName(WScript.ScriptFullName)
strDesktop = WshShell.SpecialFolders("Desktop")

Set shortcut = WshShell.CreateShortcut(strDesktop & "\Garage Ledger.lnk")
shortcut.TargetPath = strFolder & "\Start Garage Ledger.bat"
shortcut.WorkingDirectory = strFolder
shortcut.IconLocation = strFolder & "\assets\icon.ico"
shortcut.Description = "Start Garage Ledger"
shortcut.WindowStyle = 1
shortcut.Save

MsgBox "Done! A 'Garage Ledger' shortcut with its own icon has been added to your Desktop." & vbCrLf & vbCrLf & "You can use that from now on instead of this folder.", vbInformation, "Garage Ledger"
