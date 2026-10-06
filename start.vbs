' Windows — serweri arkada (penjiresiz) başladýar: start-loop.bat auto
' start-loop.bat serwer çyksa täzeden açýar we ikinji nusga başlatmaýar
' Synag: start-console.bat
' Duruzmak: stop.vbs ýa-da stop-server.bat

Option Explicit
Dim fso, shell, scriptDir, bat

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
bat = scriptDir & "\start-loop.bat"

If Not fso.FileExists(bat) Then
  WScript.Quit 1
End If

shell.Run "cmd /c """"" & bat & """ auto""", 0, False
WScript.Quit 0
