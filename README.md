# 🦅 智鹰 · ToG政企大客户AI商机挖掘系统

## 项目简介
基于 React + Ant Design 构建的 ToG 政企大客户 AI 商机挖掘前端系统，涵盖 7 大核心模块，内置仿真数据可直接运行体验。

---

## 环境要求
- **Node.js** >= 18.x（[点击下载](https://nodejs.org/)，建议选 LTS 版本）
- **npm** >= 9.x（随 Node.js 一起安装）

---

## 快速启动（3分钟）

### 第一步：安装 Node.js
1. 访问 https://nodejs.org/ 下载 LTS 版本（如 20.x.x）
2. 运行安装程序，全部默认Next，安装完成
3. 打开新的命令行窗口，验证：
   ```
   node -v   # 应显示 v20.x.x
   npm -v    # 应显示 10.x.x
   ```

### 第二步：启动前端（仅需前端即可完整体验）

```bash
# 进入前端目录
cd C:\zhiying\frontend

# 安装依赖（首次运行，约1-3分钟）
npm install

# 启动开发服务器
npm run dev
```

浏览器访问 **http://localhost:5173** 即可看到系统界面。

> ✅ 前端已内置完整的仿真数据（`src/mockData.js`），无需启动后端即可完整体验所有功能。

---

### 第三步：启动后端（可选，正式对接数据源时需要）

```bash
# 新开一个命令行窗口
cd C:\zhiying\backend

npm install
npm start
# 后端运行于 http://localhost:3001
```

切换为真实API模式：编辑 `frontend/src/api.js`，将第 6 行：
```js
const USE_MOCK = true
```
改为：
```js
const USE_MOCK = false
```

---

## 系统架构

```
zhiying/
├── frontend/                  # React 前端
│   └── src/
│       ├── App.jsx            # 主布局与路由
│       ├── mockData.js        # 内置仿真数据（15条线索+政策+招采+客户等）
│       ├── api.js             # API服务层（支持Mock/真实API切换）
│       └── pages/
│           ├── Dashboard.jsx         # 工作台
│           ├── LeadPool.jsx          # 智能线索池
│           ├── PolicyRadar.jsx       # 政策雷达
│           ├── BidRadar.jsx          # 标讯雷达
│           ├── GovGraph.jsx          # 政企图谱
│           ├── MarketingCalendar.jsx # 营销日历
│           └── DailyBriefing.jsx     # 每日线索简报
└── backend/                   # Express 后端API
    └── server.js              # 所有API路由 + 模拟数据
```

---

## 功能模块说明

| 模块 | 路径 | 核心功能 |
|------|------|----------|
| 🏠 工作台 | `/` | 今日简报概览、待办提醒、商机漏斗、日程 |
| 🧠 智能线索池 | `/leads` | AI评分(0-100)、8种线索类型、状态流转、详情抽屉 |
| 📡 政策雷达 | `/policy` | 政策解析引擎、商机任务提取、预算/专项债监控 |
| 🔍 标讯雷达 | `/bidding` | 招采监控、友商透视、分包商机预警 |
| 🗺️ 政企图谱 | `/graph` | 存量客户档案、二次商机预测、人事异动监控 |
| 📅 营销日历 | `/calendar` | 全网展会抓取、日历视图、线索录入 |
| 📰 每日简报 | `/briefing` | 简报自动生成、历史档案、转化效能看板 |

---

## 数据来源矩阵（接口扩展点）

在 `backend/server.js` 中各API路由预留了真实数据源接入注释：

| 数据源 | 接入方式 | 对应模块 |
|--------|----------|----------|
| 各级政府门户/大数据局官网 | 爬虫抓取 | 政策雷达 |
| 中国政府采购网 / 各省公共资源交易平台 | 爬虫抓取 + RSS | 标讯雷达 |
| 企查查 / 天眼查 API | HTTP REST API | 友商透视 |
| 财政部/发改委专项债公告 | 爬虫抓取 | 预算监控 |
| 政府官网人事任免公告 | 定时爬取 | 政企图谱 |
| 内部CRM系统 | CRM API集成 | 二次商机 |
| 飞书 / 企业微信 / 钉钉 | Webhook / Bot API | 简报推送 |

---

## 技术栈

- **前端**：React 18 · Vite 5 · Ant Design 5 · React Router 6 · Recharts · Day.js
- **后端**：Node.js · Express 4 · CORS
- **接入层**：所有外部数据源通过 `backend/server.js` 统一接入，前端通过 `api.js` 统一调用

---

## 一期上线路径（参考方案）

1. **现在可用**：前端 mock 模式，完整演示所有功能
2. **接入后端**：`npm start` 启动 server.js，切换 `USE_MOCK=false`
3. **接入真实数据**：在 `server.js` 对应路由中替换 mock 数据为真实爬虫/API调用
4. **接入推送**：在 `/api/briefings/send` 路由中集成飞书/企微 Webhook
