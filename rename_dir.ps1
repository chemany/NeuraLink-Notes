# 重命名 notebooks 目录为 [notebookId]
$sourcePath = "frontend\src\app\notebooks"
$targetPath = "frontend\src\app\[notebookId]"

if (Test-Path $sourcePath) {
    Write-Host "重命名目录: $sourcePath -> $targetPath"
    Move-Item -Path $sourcePath -Destination $targetPath -Force
    Write-Host "重命名完成"
} else {
    Write-Host "源目录不存在: $sourcePath"
} 