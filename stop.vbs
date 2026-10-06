' Serweri we watchdog-y duruzýar (node + köne exe)

Option Explicit
Dim fso, shell, scriptDir, stopFlag, wmi, procs, proc

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
stopFlag = scriptDir & "\server.stop"

On Error Resume Next
Dim ts
Set ts = fso.OpenTextFile(stopFlag, 2, True)
ts.WriteLine "stop " & Now
ts.Close
On Error GoTo 0

' Node serwer (src\cmd\server.js)
shell.Run "cmd /c wmic process where ""CommandLine like '%src\\cmd\\server.js%'"" call terminate >nul 2>&1", 0, True
shell.Run "cmd /c taskkill /F /IM node.exe /FI ""WINDOWTITLE eq YedidoganPOS*"" /T >nul 2>&1", 0, True

' Köne exe (eger bar bolsa)
shell.Run "cmd /c taskkill /F /IM yedidogan-zawod.exe /T >nul 2>&1", 0, True
shell.Run "cmd /c taskkill /F /IM yedidogan-zawod-new.exe /T >nul 2>&1", 0, True
shell.Run "cmd /c taskkill /F /FI ""WINDOWTITLE eq YedidoganPOS"" /T >nul 2>&1", 0, True

WScript.Sleep 500
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='wscript.exe' OR Name='cscript.exe' OR Name='cmd.exe'")
For Each proc In procs
  If InStr(1, LCase("" & proc.CommandLine), "start.vbs", 1) > 0 _
     Or InStr(1, LCase("" & proc.CommandLine), "start-loop.bat", 1) > 0 Then
    On Error Resume Next
    shell.Run "cmd /c taskkill /F /PID " & proc.ProcessId & " /T >nul 2>&1", 0, True
    On Error GoTo 0
  End If
Next

WScript.Quit 0
