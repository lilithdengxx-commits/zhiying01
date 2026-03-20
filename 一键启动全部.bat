@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🦅 智鹰系统 - 一键启动全部                ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: 检查 Node.js
node -v > nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ 未检测到 Node.js，请先运行"一键安装依赖.bat"
  pause
  exit /b 1
)

:: 检查依赖是否已安装
if not exist "%~dp0backend\node_modules" (
  echo  ❌ 后端依赖未安装，请先运行"一键安装依赖.bat"
  pause
  exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
  echo  ❌ 前端依赖未安装，请先运行"一键安装依赖.bat"
  pause
  exit /b 1
)

echo  ✅ 依赖检查通过
echo.
echo  🚀 正在启动后端服务（端口 3001）...
start "智鹰-后端API" cmd /k "chcp 65001 > nul && cd /d %~dp0backend && echo  后端启动中... && npm start"

echo  ⏳ 等待后端就绪（3秒）...
timeout /t 3 /nobreak > nul

echo  🚀 正在启动前端服务（端口 5173）...
start "智鹰-前端" cmd /k "chcp 65001 > nul && cd /d %~dp0frontend && echo  前端启动中... && npm run dev"

echo.
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  🎉 系统启动中，请稍候...
echo.
echo  前端地址：http://localhost:5173
echo  后端地址：http://localhost:3001
echo.
echo  ⚠️  关闭系统请关闭"智鹰-后端API"和"智鹰-前端"两个窗口
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

timeout /t 5 /nobreak > nul
start "" "http://localhost:5173"
