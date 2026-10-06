' Windows — serweri node bilen arkada başladýar, çyksa täzeden açýar
' Synag: start-console.bat
' Duruzmak: stop.vbs ýa-da stop-server.bat

Option Explicit
Dim fso, shell, scriptDir, stopFlag, logPath, errLog, already
Dim wmi, procs, proc, exitWait, tries, cmdLine, nodeCmd, serverJs

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir

stopFlag = scriptDir & "\server.stop"
logPath = scriptDir & "\server.log"
errLog = scriptDir & "\server-error.log"
serverJs = scriptDir & "\src\cmd\server.js"

If Not fso.FileExists(serverJs) Then
  AppendLog "ERROR src\cmd\server.js ýok"
  WScript.Quit 1
End If

nodeCmd = ResolveNode(shell)
If nodeCmd = "" Then
  AppendLog "ERROR node.exe tapylmady — Node.js gurnalyň"
  WScript.Quit 1
End If

Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='wscript.exe' OR Name='cscript.exe'")
already = 0
For Each proc In procs
  If InStr(1, LCase("" & proc.CommandLine), "start.vbs", 1) > 0 Then
    already = already + 1
  End If
Next
If already > 1 Then
  WScript.Quit 0
End If

If fso.FileExists(stopFlag) Then
  On Error Resume Next
  fso.DeleteFile stopFlag, True
  On Error GoTo 0
End If

AppendLog "BOOT  " & Now & " dir=" & scriptDir & " mode=node"

On Error Resume Next
shell.Run "powershell -NoProfile -Command ""Get-Service *postgres* -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Running' } | Start-Service -ErrorAction SilentlyContinue""", 0, True
On Error GoTo 0

WScript.Sleep 20000

tries = 0
Do While True
  If fso.FileExists(stopFlag) Then Exit Do

  tries = tries + 1
  AppendLog "START #" & tries & " " & Now & " node " & serverJs

  cmdLine = "cmd /c """ & nodeCmd & """ """ & serverJs & """ >> """ & errLog & """ 2>&1"
  shell.Run cmdLine, 0, True

  If fso.FileExists(stopFlag) Then Exit Do

  exitWait = 3000
  If tries <= 10 Then exitWait = 8000
  AppendLog "EXIT  " & Now & " — " & (exitWait \ 1000) & "s soň täzeden"
  WScript.Sleep exitWait
Loop

AppendLog "STOP  " & Now
WScript.Quit 0

Function ResolveNode(sh)
  Dim p
  On Error Resume Next
  p = sh.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe")
  If fso.FileExists(p) Then
    ResolveNode = p
    Exit Function
  End If
  p = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe")
  If fso.FileExists(p) Then
    ResolveNode = p
    Exit Function
  End If
  ' PATH-daky node
  ResolveNode = "node"
  On Error GoTo 0
End Function

Sub AppendLog(msg)
  On Error Resume Next
  Dim ts
  Set ts = fso.OpenTextFile(logPath, 8, True)
  ts.WriteLine msg
  ts.Close
  On Error GoTo 0
End Sub
