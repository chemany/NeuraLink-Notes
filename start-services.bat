@echo off
echo 启动 Notebook LM Clone 服务...

echo.
echo 正在启动后端服务 (端口 3001)...
start "Notebook Backend" cmd /k "cd /d C:\code\notebook-lm-clone\backend && npm run start:dev"

echo 等待后端服务启动...
timeout /t 5 /nobreak

echo.
echo 正在启动前端服务 (端口 3000)...
start "Notebook Frontend" cmd /k "cd /d C:\code\notebook-lm-clone\frontend && npm run dev"

echo.
echo 服务启动完成！
echo.
echo 前端服务: http://localhost:3000
echo 后端服务: http://localhost:3001
echo nginx代理访问: http://localhost:8081/notebooks/
echo.
echo 按任意键退出...
pause > nul 