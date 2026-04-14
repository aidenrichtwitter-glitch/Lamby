
Start-Sleep -Seconds 2
# Find and kill the cmd.exe window that is hosting Lamby (has electron:dev or lamby in its command line)
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $PID").ParentProcessId
$lambyNodes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'electron|lamby|bridge-relay' }
foreach ($proc in $lambyNodes) {
  $cmdParent = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)" -ErrorAction SilentlyContinue
  if ($cmdParent -and $cmdParent.Name -eq 'cmd.exe') {
    Stop-Process -Id $cmdParent.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
$lambyElectrons = Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" | Where-Object { $_.CommandLine -match 'lamby' }
foreach ($proc in $lambyElectrons) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3
Start-Process cmd -ArgumentList '/k','cd /d C:\\Users\\Aiden\\Desktop\\Lamby && npm run electron:dev' -WorkingDirectory 'C:\\Users\\Aiden\\Desktop\\Lamby'
