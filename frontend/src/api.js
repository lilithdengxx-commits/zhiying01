// API 服务层
// USE_MOCK=true 时直接使用本地模拟数据，无需启动后端
// USE_MOCK=false 时通过 Vite proxy 请求后端 http://localhost:3001
import * as mock from './mockData'

const USE_MOCK = false

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms))

// ---- 工作台 ----
export const getDashboardStats = async () => {
  if (USE_MOCK) { await delay(); return mock.dashboardStats }
  const r = await fetch('/api/dashboard/stats'); return r.json()
}

export const getTodos = async () => {
  if (USE_MOCK) { await delay(); return mock.todos }
  const r = await fetch('/api/dashboard/todos'); return r.json()
}

// ---- 线索 ----
export const getLeads = async (filters = {}) => {
  if (USE_MOCK) {
    await delay()
    let result = [...mock.leads]
    if (filters.type) result = result.filter(l => l.type === filters.type)
    if (filters.status) result = result.filter(l => l.status === filters.status)
    if (filters.signalSource) result = result.filter(l => {
      const source = l.signalSource || ({
        bidding: '招投标公告',
        policy: '政策文件',
        renewal: '企业新闻',
        subcontract: '行业媒体',
        personnel: '企业新闻',
        budget: '政策文件',
        exhibition: '行业媒体',
      }[l.type] || '其他信源')
      return source === filters.signalSource
    })
    if (filters.minScore) result = result.filter(l => l.score >= Number(filters.minScore))
    if (filters.region) result = result.filter(l => l.region.includes(filters.region))
    if (filters.keyword) result = result.filter(l => l.title.includes(filters.keyword) || l.summary.includes(filters.keyword))
    return { data: result.sort((a, b) => b.score - a.score), total: result.length }
  }
  const params = new URLSearchParams(filters).toString()
  const r = await fetch(`/api/leads?${params}`); return r.json()
}

export const getLeadById = async (id) => {
  if (USE_MOCK) { await delay(); return mock.leads.find(l => l.id === id) }
  const r = await fetch(`/api/leads/${id}`); return r.json()
}

export const updateLeadStatus = async (id, status) => {
  if (USE_MOCK) {
    await delay()
    const lead = mock.leads.find(l => l.id === id)
    if (lead) lead.status = status
    return { success: true }
  }
  const r = await fetch(`/api/leads/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  return r.json()
}

// ---- 政策 ----
export const getPolicies = async (filters = {}) => {
  if (USE_MOCK) {
    await delay()
    let result = [...mock.policies]
    if (filters.level) result = result.filter(p => p.level === filters.level)
    if (filters.keyword) result = result.filter(p => p.title.includes(filters.keyword) || p.summary.includes(filters.keyword))
    return { data: result, total: result.length }
  }
  const params = new URLSearchParams(filters).toString()
  const r = await fetch(`/api/policies?${params}`); return r.json()
}

// ---- 招采 ----
export const getBids = async (filters = {}) => {
  if (USE_MOCK) {
    await delay()
    let result = [...mock.bids]
    if (filters.status) result = result.filter(b => b.statusKey === filters.status)
    if (filters.region) result = result.filter(b => b.region.includes(filters.region))
    return { data: result, total: result.length }
  }
  const params = new URLSearchParams(filters).toString()
  const r = await fetch(`/api/bids?${params}`); return r.json()
}

// ---- 竞品 ----
export const getCompetitors = async () => {
  if (USE_MOCK) { await delay(); return { data: mock.competitors } }
  const r = await fetch('/api/competitors'); return r.json()
}

// ---- 客户管理 ----
export const getCustomers = async () => {
  if (USE_MOCK) { await delay(); return { data: mock.customers } }
  const r = await fetch('/api/graph/customers'); return r.json()
}

// ---- 营销日历 ----
export const getEvents = async () => {
  if (USE_MOCK) { await delay(); return { data: mock.events } }
  const r = await fetch('/api/events'); return r.json()
}

// ---- 线索简报 ----
export const getBriefings = async () => {
  if (USE_MOCK) { await delay(); return { data: mock.briefings } }
  const r = await fetch('/api/briefings'); return r.json()
}

export const getTodayBriefing = async () => {
  if (USE_MOCK) { await delay(); return mock.briefings[0] }
  const r = await fetch('/api/briefings/today'); return r.json()
}
