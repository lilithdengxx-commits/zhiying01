@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   🦅 智鹰 ToG商机挖掘系统 启动脚本      ║
echo  ╚══════════════════════════════════════════╝
echo.

:: 检查 Node.js
node -v > nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ 未检测到 Node.js，请先安装：
  echo     https://nodejs.org/  （下载LTS版本）
  echo.
  pause
  exit /b 1
)

echo  ✅ Node.js 已安装
echo.

:: 安装前端依赖
echo  📦 检查并安装前端依赖...
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo  正在安装依赖（首次约需1-3分钟）...
  npm install
)

echo.
echo  🚀 启动前端开发服务器...
echo  浏览器将自动打开 http://localhost:5173
echo  按 Ctrl+C 停止服务
echo.
npm run dev
