@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🦅 智鹰系统 - 一键安装依赖                ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: 检查 Node.js
node -v > nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ 未检测到 Node.js，请先安装：
  echo     https://nodejs.org/  （下载 LTS 版本，点击安装全部默认即可）
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo  ✅ Node.js 已安装：%NODEVER%
echo.

:: 安装后端依赖
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  📦 安装后端依赖...
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /d "%~dp0backend"
npm install
if %errorlevel% neq 0 (
  echo  ❌ 后端依赖安装失败，请检查网络连接后重试。
  pause
  exit /b 1
)
echo  ✅ 后端依赖安装完成
echo.

:: 安装前端依赖
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  📦 安装前端依赖（约1-3分钟）...
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /d "%~dp0frontend"
npm install
if %errorlevel% neq 0 (
  echo  ❌ 前端依赖安装失败，请检查网络连接后重试。
  pause
  exit /b 1
)
echo  ✅ 前端依赖安装完成
echo.

echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  🎉 全部依赖安装完成！
echo.
echo  下一步：双击"一键启动全部.bat"启动系统
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
