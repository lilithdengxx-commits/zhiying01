@echo off
chcp 65001 > nul
echo.
echo  🦅 智鹰后端API服务 启动
echo.

node -v > nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ 未检测到 Node.js，请先安装后重试
  pause
  exit /b 1
)

cd /d "%~dp0backend"
if not exist "node_modules" (
  echo  📦 安装后端依赖...
  npm install
)

echo  ✅ 后端启动中，监听 http://localhost:3001
echo  按 Ctrl+C 停止服务
echo.
npm start
