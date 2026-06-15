Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strPath = FSO.GetParentFolderName(WScript.ScriptFullName)

If Not FSO.FileExists(strPath & "\main.js") Then
    MsgBox "Error: main.js not found", vbCritical, "Image Composer"
    WScript.Quit 1
End If

If Not FSO.FolderExists(strPath & "\node_modules") Then
    intResult = MsgBox("First run - install dependencies (1-2 min). Continue?", vbQuestion + vbYesNo, "Image Composer")
    If intResult <> vbYes Then
        WScript.Quit 0
    End If
    Set objExec = WshShell.Run("cmd /c npm install --registry=https://registry.npmmirror.com", 1, True)
End If

WshShell.Run "cmd /c npm start", 1, False

WScript.Sleep 5000

MsgBox "Image Composer is starting!", vbInformation, "Image Composer"
