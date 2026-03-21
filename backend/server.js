const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const { scrapeLatest } = require('./scrapers/ccgp')
const { scrapeXinhuaLatest, XINHUA_URL } = require('./scrapers/xinhua')
const { scrapeNdrcLatest, NDRC_SOURCE } = require('./scrapers/ndrc')
const { scrapeCctvLatest, CCTV_SOURCE } = require('./scrapers/cctv')
const { scrapeCebpubLatest, CEBPUB_SOURCE } = require('./scrapers/cebpub')
const { scrapeCaizhaowangLatest, CZW_SOURCE } = require('./scrapers/caizhaowang')
const { scrapeMiitLatest, MIIT_SOURCE } = require('./scrapers/miit')
const { enhanceLead } = require('./scorer')

const app = express()
app.use(cors())
app.use(express.json())

// ============================================================
// 爬虫状态与实时数据缓存
// ============================================================
function mapStatus(typeText) {
  if (!typeText) return 'bidding'
  if (typeText.includes('中标') || typeText.includes('成交') || typeText.includes('结果')) return 'awarded'
  if (typeText.includes('废标') || typeText.includes('终止') || typeText.includes('异常')) return 'failed'
  if (typeText.includes('意向') || typeText.includes('公示')) return 'intention'
  return 'bidding'
}

let crawlerStatus = {
  running: false,
  lastRun: null,
  lastSuccess: null,
  totalFetched: 0,
  error: null,
}
// 从政府采购网实时抓取的标讯（追加到 bids 末尾）
let ccgpBids = []
// 从新华网实时抓取的政策信号
let xinhuaPolicies = []
// 从发改委抓取的政策信号
let ndrcPolicies = []
// 从央视抓取的企业新闻线索
let cctvLeads = []
// 从中国电子招标投标平台抓取的标讯
let cebpubBids = []
// 从采招网抓取的标讯
let czwBids = []
// 从工信部抓取的政策信号
let miitPolicies = []

async function runCrawler() {
  if (crawlerStatus.running) {
    console.log('[CCGP] 爬虫正在运行中，跳过本次触发')
    return
  }
  crawlerStatus.running = true
  crawlerStatus.lastRun = new Date().toISOString()
  crawlerStatus.error = null
  console.log('[CCGP] ── 开始抓取中国政府采购网数据 ──')
  try {
    const items = await scrapeLatest()
    // 转换为 bid 格式，按 ID 去重（保留已有人工数据）
    const existingIds = new Set([...bids.map(b => b.id), ...ccgpBids.map(b => b.id)])
    const newBids = items
      .filter(item => !existingIds.has(item.id))
      .map(item => ({
        id: item.id,
        title: item.fullTitle,
        amount: item.budget,
        region: item.region,
        city: item.city,
        status: mapStatus(item.typeText),
        publishedAt: item.publishedAt,
        deadline: null,
        department: item.dept,
        source: '中国政府采购网 (ccgp.gov.cn)',
        sourceUrl: item.sourceUrl,
        description: `公告类型：${item.typeText}。通过关键词实时抓取自政府采购网。`,
        hasSubcontract: false,
        competitors: [],
        winner: (item.typeText && (item.typeText.includes('中标') || item.typeText.includes('成交'))) ? '（待确认）' : null,
        score: item.score,
        nextAction: item.score >= 80
          ? `高优先级：立即安排商务联系 ${item.dept}`
          : `跟进观察：${item.dept} 项目已录入线索池`,
        isRealtime: true,
      }))
    // 将高分条目同时推进线索池
    const existingLeadIds = new Set(leads.map(l => l.id))
    for (const bid of newBids) {
      if (bid.score >= 55 && !existingLeadIds.has(bid.id)) {
        const lead = await enhanceLead({
          id: bid.id,
          title: bid.title,
          type: 'bidding',
          typeName: '招采动作',
          typeColor: 'blue',
          signalSource: '招投标公告',
          score: bid.score,
          scoreReason: `由政府采购网实时抓取，关键词匹配度高。公告类型：${bid.status}`,
          summary: bid.description,
          source: bid.source,
          sourceUrl: bid.sourceUrl,
          region: bid.region,
          city: bid.city,
          status: 'pending',
          createdAt: bid.publishedAt,
          updatedAt: new Date().toISOString().split('T')[0],
          nextAction: bid.nextAction,
          budget: bid.amount,
          department: bid.department,
          contact: null,
          contactRole: null,
          tags: ['实时抓取', '政采网', bid.region],
          deadline: null,
          isRealtime: true,
        })
        leads.push(lead)
        existingLeadIds.add(bid.id)
      }
    }
    ccgpBids.push(...newBids)
    crawlerStatus.totalFetched += newBids.length

    // 新华网信息公开数据抓取（政策信号）
    console.log('[XINHUA] ── 开始抓取新华网信息公开数据 ──')
    const xinhuaItems = await scrapeXinhuaLatest()
    const existingPolicyIds = new Set([...policies.map(p => p.id), ...xinhuaPolicies.map(p => p.id)])
    const newPolicies = xinhuaItems
      .filter(item => !existingPolicyIds.has(item.id))
      .map(item => ({
        id: item.id,
        title: item.title,
        level: 'national',
        region: '全国',
        publishedAt: item.publishedAt,
        summary: `来源新华网信息公开栏目，建议结合业务场景进行政策研判：${item.title}`,
        relevantTasks: ['识别政策导向', '提炼商机任务', '匹配潜在客户部门'],
        potentialDepts: ['各级政务服务管理部门', '各地大数据局'],
        budgetSignal: '预算信号需结合各省市预算公告进一步确认',
        score: item.score,
        source: '新华网信息公开',
        sourceUrl: item.sourceUrl,
        isRealtime: true,
      }))

    // 将高分政策同时推进线索池
    const existingLeadIds2 = new Set(leads.map(l => l.id))
    for (const p of newPolicies) {
      if (p.score >= 55 && !existingLeadIds2.has(p.id)) {
        const lead = await enhanceLead({
          id: p.id,
          title: p.title,
          type: 'policy',
          typeName: '政策驱动',
          typeColor: 'green',
          signalSource: '政策文件',
          score: p.score,
          scoreReason: '由新华网信息公开栏目实时抓取，具备政策驱动价值。',
          summary: p.summary,
          source: '新华网信息公开',
          sourceUrl: p.sourceUrl,
          region: '全国',
          city: '全国',
          status: 'pending',
          createdAt: p.publishedAt,
          updatedAt: new Date().toISOString().split('T')[0],
          nextAction: '建议情报团阒24小时内完成解读，匹配DIOS平台在治理/金融/媒体三大领域的应用场景。',
          budget: null,
          department: '新华社/政策发布相关部门',
          contact: null,
          contactRole: null,
          tags: ['实时抓取', '新华网', '政策信号'],
          deadline: null,
          isRealtime: true,
        })
        leads.push(lead)
        existingLeadIds2.add(p.id)
      }
    }

    xinhuaPolicies.push(...newPolicies)
    crawlerStatus.totalFetched += newPolicies.length
    console.log(`[XINHUA] ── 完成，新增 ${newPolicies.length} 条政策信号，线索池已同步 ──`)

    // ── 发改委政策文件 ──
    try {
      console.log('[NDRC] ── 开始抓取发改委政策数据 ──')
      const ndrcItems = await scrapeNdrcLatest()
      const existingNdrcIds = new Set([...policies.map(p => p.id), ...xinhuaPolicies.map(p => p.id), ...ndrcPolicies.map(p => p.id)])
      const newNdrc = ndrcItems.filter(item => !existingNdrcIds.has(item.id)).map(item => ({
        id: item.id,
        title: item.title,
        level: 'national',
        levelName: '国家级',
        region: '全国',
        publishedAt: item.publishedAt,
        summary: `来源国家发展改革委（${item.category}），发现与数字经济/政务信息化相关政策信号：${item.title}`,
        relevantTasks: ['研判政策导向', '识别资金拨付信号', '匹配对应省市跟进'],
        potentialDepts: ['各省发改委', '各地大数据局', '数字政府主管部门'],
        budgetSignal: '发改委政策文件通常伴随专项资金安排，建议关注配套预算公告',
        score: item.score,
        source: NDRC_SOURCE,
        sourceUrl: item.sourceUrl,
        isRealtime: true,
        signalSource: '政策文件',
      }))
      // 高分政策推进线索池
      const nIds = new Set(leads.map(l => l.id))
      for (const p of newNdrc) {
        if (p.score >= 55 && !nIds.has(p.id)) {
          const lead = await enhanceLead({
            id: p.id, title: p.title,
            type: 'policy', typeName: '政策驱动', typeColor: 'green',
            signalSource: '政策文件',
            score: p.score,
            scoreReason: '由发改委官网实时抓取，具备国家级政策驱动价值。',
            summary: p.summary, source: NDRC_SOURCE, sourceUrl: p.sourceUrl,
            region: '全国', city: '全国', status: 'pending',
            createdAt: p.publishedAt, updatedAt: new Date().toISOString().split('T')[0],
            nextAction: '建议对对DIOS平台匹配度，24小时内分发至治理/金融/媒体对应层的广廉经理跟进。',
            budget: null, department: '国家发展改革委',
            contact: null, contactRole: null,
            tags: ['实时抓取', '发改委', '政策文件'], deadline: null, isRealtime: true,
          })
          leads.push(lead)
          nIds.add(p.id)
        }
      }
      ndrcPolicies.push(...newNdrc)
      crawlerStatus.totalFetched += newNdrc.length
      console.log(`[NDRC] ── 完成，新增 ${newNdrc.length} 条政策信号 ──`)
    } catch (err) {
      console.warn('[NDRC] 抓取失败:', err.message)
    }

    // ── 央视企业新闻 ──
    try {
      console.log('[CCTV] ── 开始抓取央视动态数据 ──')
      const cctvItems = await scrapeCctvLatest()
      const existingCctvIds = new Set(cctvLeads.map(l => l.id))
      const newCctv = cctvItems.filter(item => !existingCctvIds.has(item.id))
      // 高分条目推进线索池
      const cIds = new Set(leads.map(l => l.id))
      for (const item of newCctv) {
        if (item.score >= 55 && !cIds.has(item.id)) {
          const lead = await enhanceLead({
            id: item.id, title: item.title,
            type: 'policy', typeName: '政策驱动', typeColor: 'green',
            signalSource: '企业新闻',
            score: item.score,
            scoreReason: '由央视新闻实时抓取，具备政策/企业动态参考价值。',
            summary: `来源央视（${item.category}）：${item.title}`,
            source: CCTV_SOURCE, sourceUrl: item.sourceUrl,
            region: '全国', city: '全国', status: 'pending',
            createdAt: item.publishedAt, updatedAt: new Date().toISOString().split('T')[0],
            nextAction: '关注领导层政策动向，结合业务战区分析可能的数字政府建设需求。',
            budget: null, department: '央视/政策相关部门',
            contact: null, contactRole: null,
            tags: ['实时抓取', '央视', '企业新闻'], deadline: null, isRealtime: true,
          })
          leads.push(lead)
          cIds.add(item.id)
        }
      }
      cctvLeads.push(...newCctv)
      crawlerStatus.totalFetched += newCctv.length
      console.log(`[CCTV] ── 完成，新增 ${newCctv.length} 条企业新闻信号 ──`)
    } catch (err) {
      console.warn('[CCTV] 抓取失败:', err.message)
    }

    // ── 中国电子招标投标平台 ──
    try {
      console.log('[CEBPUB] ── 开始抓取中国电子招标投标平台数据 ──')
      const cebItems = await scrapeCebpubLatest()
      const existingCebIds = new Set([...bids.map(b => b.id), ...ccgpBids.map(b => b.id), ...cebpubBids.map(b => b.id)])
      const newCeb = cebItems.filter(item => !existingCebIds.has(item.id)).map(item => ({
        id: item.id, title: item.title,
        amount: item.budget, region: item.region, city: item.city,
        statusKey: item.statusKey, statusName: '实时公告',
        publishedAt: item.publishedAt, deadline: null,
        department: item.title.slice(0, 20) + '...',
        source: CEBPUB_SOURCE, sourceUrl: item.sourceUrl,
        description: `来源中国电子招标投标公共服务平台（${item.category}）：${item.title}`,
        hasSubcontract: false, competitors: [], winner: null,
        score: item.score, isRealtime: true,
        signalSource: '招投标公告',
      }))
      // 高分条目推进线索池
      const cbIds = new Set(leads.map(l => l.id))
      for (const bid of newCeb) {
        if (bid.score >= 55 && !cbIds.has(bid.id)) {
          const lead = await enhanceLead({
            id: bid.id, title: bid.title,
            type: 'bidding', typeName: '招采动作', typeColor: 'blue',
            signalSource: '招投标公告',
            score: bid.score,
            scoreReason: `由中国电子招标投标公共服务平台实时抓取，关键词匹配度高。`,
            summary: bid.description, source: CEBPUB_SOURCE, sourceUrl: bid.sourceUrl,
            region: bid.region, city: bid.city, status: 'pending',
            createdAt: bid.publishedAt, updatedAt: new Date().toISOString().split('T')[0],
            nextAction: `立即跟进：${bid.title.slice(0, 25)}...`,
            budget: bid.amount, department: bid.department,
            contact: null, contactRole: null,
            tags: ['实时抓取', '电子招标', bid.region], deadline: null, isRealtime: true,
          })
          leads.push(lead)
          cbIds.add(bid.id)
        }
      }
      cebpubBids.push(...newCeb)
      crawlerStatus.totalFetched += newCeb.length
      console.log(`[CEBPUB] ── 完成，新增 ${newCeb.length} 条招标公告 ──`)
    } catch (err) {
      console.warn('[CEBPUB] 抓取失败:', err.message)
    }

    // ── 工信部政策文件 ──
    try {
      console.log('[MIIT] ── 开始抓取工信部数据 ──')
      const miitItems = await scrapeMiitLatest()
      const existingMiitIds = new Set([
        ...policies.map(p => p.id),
        ...xinhuaPolicies.map(p => p.id),
        ...ndrcPolicies.map(p => p.id),
        ...miitPolicies.map(p => p.id),
      ])
      const newMiit = miitItems.filter(item => !existingMiitIds.has(item.id)).map(item => ({
        id: item.id,
        title: item.title,
        level: 'national',
        levelName: '国家级',
        region: '全国',
        publishedAt: item.publishedAt,
        summary: `来源工业和信息化部（${item.category}），发现与ICT/数字经济相关信号：${item.title}`,
        relevantTasks: ['研判工信部政策导向', '识别资金抚持信号', '匹配对应省市跟进'],
        potentialDepts: ['各省工信庁', '大数据中心', '数字政府主管部门'],
        budgetSignal: '工信部政策文件通常伴随专项资金安排，建议关注配套预算公告',
        score: item.score,
        source: MIIT_SOURCE,
        sourceUrl: item.sourceUrl,
        isRealtime: true,
        signalSource: '政策文件',
      }))
      const miitLeadIds = new Set(leads.map(l => l.id))
      for (const p of newMiit) {
        if (p.score >= 55 && !miitLeadIds.has(p.id)) {
          const lead = await enhanceLead({
            id: p.id, title: p.title,
            type: 'policy', typeName: '政策驱动', typeColor: 'green',
            signalSource: '政策文件',
            score: p.score,
            scoreReason: '由工信部官网实时抓取，具备ICT领域政策驱动价値。',
            summary: p.summary, source: MIIT_SOURCE, sourceUrl: p.sourceUrl,
            region: '全国', city: '全国', status: 'pending',
            createdAt: p.publishedAt, updatedAt: new Date().toISOString().split('T')[0],
            nextAction: '建议对对DIOS平台匹配度，24小时内分发至沿治理/金融/媒体对应原经理跟进。',
            budget: null, department: '工业和信息化部',
            contact: null, contactRole: null,
            tags: ['实时抓取', '工信部', '政策文件'], deadline: null, isRealtime: true,
          })
          leads.push(lead)
          miitLeadIds.add(p.id)
        }
      }
      miitPolicies.push(...newMiit)
      crawlerStatus.totalFetched += newMiit.length
      console.log(`[MIIT] ── 完成，新增 ${newMiit.length} 条政策信号 ──`)
    } catch (err) {
      console.warn('[MIIT] 抓取失败:', err.message)
    }

    // ── 采招网招标公告 ──
    try {
      console.log('[CZW] ── 开始抓取采招网数据 ──')
      const czwItems = await scrapeCaizhaowangLatest()
      const existingCzwIds = new Set([...bids.map(b => b.id), ...ccgpBids.map(b => b.id), ...czwBids.map(b => b.id)])
      const newCzw = czwItems.filter(item => !existingCzwIds.has(item.id)).map(item => ({
        id: item.id, title: item.title,
        amount: null, region: '全国', city: '',
        status: 'bidding',
        publishedAt: item.publishedAt, deadline: null,
        department: item.title.slice(0, 20) + '...',
        source: CZW_SOURCE, sourceUrl: item.sourceUrl,
        description: `来源采招网（${item.category}）：${item.title}`,
        hasSubcontract: false, competitors: [], winner: null,
        score: item.score, isRealtime: true,
        signalSource: '招投标公告',
      }))
      const czwLeadIds = new Set(leads.map(l => l.id))
      for (const bid of newCzw) {
        if (bid.score >= 55 && !czwLeadIds.has(bid.id)) {
          const lead = await enhanceLead({
            id: bid.id, title: bid.title,
            type: 'bidding', typeName: '招采动作', typeColor: 'blue',
            signalSource: '招投标公告',
            score: bid.score,
            scoreReason: `由采招网实时抓取，关键词匹配度高。`,
            summary: bid.description, source: CZW_SOURCE, sourceUrl: bid.sourceUrl,
            region: '全国', city: '', status: 'pending',
            createdAt: bid.publishedAt, updatedAt: new Date().toISOString().split('T')[0],
            nextAction: `立即跟进：${bid.title.slice(0, 25)}...`,
            budget: null, department: bid.department,
            contact: null, contactRole: null,
            tags: ['实时抓取', '采招网'], deadline: null, isRealtime: true,
          })
          leads.push(lead)
          czwLeadIds.add(bid.id)
        }
      }
      czwBids.push(...newCzw)
      crawlerStatus.totalFetched += newCzw.length
      console.log(`[CZW] ── 完成，新增 ${newCzw.length} 条招标公告 ──`)
    } catch (err) {
      console.warn('[CZW] 抓取失败:', err.message)
    }

    crawlerStatus.lastSuccess = new Date().toISOString()
    console.log(`[CCGP] ── 完成，新增 ${newBids.length} 条标讯，线索池已同步 ──`)
  } catch (err) {
    crawlerStatus.error = err.message
    console.error('[CCGP] 爬虫异常:', err.message)
  } finally {
    crawlerStatus.running = false
  }
}

// 启动时立即执行一次；此后每 30 分钟定时抓取
setTimeout(runCrawler, 3000)
cron.schedule('*/30 * * * *', runCrawler)

// ============================================================
// 模拟数据 · 线索库
// ============================================================
// USE_MOCK=false 模式下从空数组开始，所有线索均来自实时爬虫抓取
// 预置部分来自存量客户的二次商机线索（非爬虫，属于客户管理推送）
const leads = [
  {
    id: 'RENEWAL-001',
    title: '广州市政务数据局二期AI大模型升级——DIOS认知平台接入',
    type: 'renewal', typeName: '二次商机', typeColor: 'purple',
    signalSource: '企业新闻',
    score: 91,
    scoreReason: '老客户二次商机，项目续签可能性极高，合同价值1500万，历史合作评价优良',
    summary: '广州市政务服务数据管理局现有政务数据共享交换平台一期（680万，2023年交付）已稳定运行，王建国处长明确表达二期升级意向。主要需求：接入DIOS大模型能力，实现自然语言查询和智能决策支持。',
    source: '客户管理系统（CRM）',
    sourceUrl: '',
    region: '广东省',
    city: '广州市',
    status: 'contacting',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-19',
    nextAction: '本周三前确认王处长拜访时间，携带DIOS大模型政务场景Demo方案',
    budget: 1500,
    department: '广州市政务服务数据管理局',
    contact: '王建国',
    contactRole: '采购处处长',
    tags: ['老客续签', '二次商机', 'AI大模型', '华南区', '高赢率'],
    deadline: '2026-06-30',
    isRealtime: false,
  },
  {
    id: 'RENEWAL-002',
    title: '深圳南山区政务云二期——AI+数据要素升级（1200万）',
    type: 'renewal', typeName: '二次商机', typeColor: 'purple',
    signalSource: '企业新闻',
    score: 88,
    scoreReason: '老客户，陈志强副局长反馈Q2预算会议已过，项目进入采购准备阶段',
    summary: '南山区政务云平台（950万，2023年总包）处于运维期，用户满意度高。陈志强副局长在3月19日沟通中确认，区里计划Q2启动二期采购，重点方向：数据要素流通平台+智能审批能力升级，预算约1200万。',
    source: '客户管理系统（CRM）',
    sourceUrl: '',
    region: '广东省',
    city: '深圳市',
    status: 'contacting',
    createdAt: '2026-03-19',
    updatedAt: '2026-03-19',
    nextAction: '本周内提交《南山区政务云二期升级方案建议书》初稿，本周五前完成内审',
    budget: 1200,
    department: '深圳市南山区政务服务数据管理局',
    contact: '陈志强',
    contactRole: '副局长',
    tags: ['老客续签', '二次商机', '数据要素', '华南区', '高赢率'],
    deadline: '2026-05-20',
    isRealtime: false,
  },
]

// ============================================================
// 线索信号源归类（用于筛选）
// 五类：招投标公告、企业新闻、政策文件、行业媒体、其他信源
// ============================================================
const SIGNAL_SOURCE_BY_TYPE = {
  bidding: '招投标公告',
  subcontract: '招投标公告',
  policy: '政策文件',
  budget: '政策文件',
  renewal: '企业新闻',
  personnel: '企业新闻',
  exhibition: '行业媒体',
  manual: '行业媒体',
}

function inferSignalSource(lead) {
  const src = `${lead.source || ''}`
  if (src.includes('采购') || src.includes('交易平台') || src.includes('中标')) return '招投标公告'
  if (src.includes('新华网') || src.includes('政府') || src.includes('财政') || src.includes('大数据局')) return '政策文件'
  return SIGNAL_SOURCE_BY_TYPE[lead.type] || '其他信源'
}

leads.forEach(l => {
  if (!l.signalSource) l.signalSource = inferSignalSource(l)
})

// ============================================================
// 模拟数据 · 政策库
// ============================================================
const policies = [
  {
    id: 'P001', title: '国家数据局《数字中国建设2026年工作要点》',
    level: 'national', region: '全国', publishedAt: '2026-03-01',
    summary: '明确2026年推进政务数据跨层级共享、建立全国一体化数据基础设施体系、推进政务AI大模型试点等12项重点任务。',
    relevantTasks: ['推进各省市统一大数据底座建设', '部署政务AI大模型能力平台', '完善数据要素市场化交易体系'],
    potentialDepts: ['各省市大数据局', '各省市数字化转型主管部门'],
    budgetSignal: '各省市配套专项资金落地是关键跟进节点',
    score: 90,
  },
  {
    id: 'P002', title: '广东省《数字政府建设三年行动方案（2025-2027）》',
    level: 'provincial', region: '广东省', publishedAt: '2025-11-15',
    summary: '明确三年内建设全省统一政务云底座、政务数据湖、AI大模型服务平台，赋能省市县三级政务系统，重点推进珠三角城市群数字化协同。',
    relevantTasks: ['建设省级政务数据湖', '市级数字政府标准化建设试点', '政务AI应用场景落地'],
    potentialDepts: ['广东省政务服务数据管理局', '各市大数据局'],
    budgetSignal: '广东省财政2026年数字政府专项预算已公示：12亿元',
    score: 95,
  },
  {
    id: 'P003', title: '上海市《城市数字化转型"十四五"规划中期评估》',
    level: 'provincial', region: '上海市', publishedAt: '2026-02-10',
    summary: '评估显示数字底座建设推进良好，但AI大模型政务应用落地率不及预期，中期评估报告明确提出2026年需重点补强政务大模型能力建设。',
    relevantTasks: ['补强政务大模型能力', '推进城市感知网络AI升级', '完成16个区数据共享专项'],
    potentialDepts: ['上海市大数据中心', '各区大数据管理部门'],
    budgetSignal: '市级补充专项预算预计2026年Q2公示',
    score: 82,
  },
  {
    id: 'P004', title: '成都市《数字政府2.0三年行动方案（2026-2028）》',
    level: 'city', region: '四川省', publishedAt: '2026-03-05',
    summary: '明确逐步建立覆盖全市政务部门的政务AI大模型能力底座，同步推进数据要素市场化试点，预计2026年完成规划与方案设计阶段。',
    relevantTasks: ['部署政务AI大模型底座', '建设数据要素流通试验区', '扩大政务数据共享覆盖范围'],
    potentialDepts: ['成都市大数据局', '成都市发展改革委'],
    budgetSignal: '专项债申报中，预计2026年Q3资金到位',
    score: 78,
  },
  {
    id: 'P005', title: '浙江省《关于加快推进数字政府迭代升级的若干措施》',
    level: 'provincial', region: '浙江省', publishedAt: '2026-01-20',
    summary: '出台16条措施加速政府数字化，重点推进AI赋能政务服务、打通省市县三级数据壁垒、建立数据资产管理体系',
    relevantTasks: ['AI赋能政务服务升级改造', '县级数字政府标准化建设', '建立全省统一数据资产管理平台'],
    potentialDepts: ['浙江省大数据发展管理局', '各地市数字化改革办公室'],
    budgetSignal: '省级预算已公示，各市配套资金预计Q2落地',
    score: 88,
  },
]

// ============================================================
// 模拟数据 · 招采/标讯库
// ============================================================
const bids = [
  {
    id: 'B001', title: '广州市政务数据局大数据治理平台建设项目（采购意向公示）',
    amount: 800, region: '广东省', city: '广州市',
    status: 'intention', publishedAt: '2026-03-21', deadline: '2026-04-05',
    department: '广州市政务数据局', source: '广东省政府采购网',
    description: '建设覆盖全市47个委办局的统一大数据治理平台，包含数据目录、数据质量、数据安全三大功能模块。',
    hasSubcontract: false, competitors: [], winner: null,
    policyRef: 'P002',
  },
  {
    id: 'B002', title: '上海市静安区数据共享交换平台（废标重招）',
    amount: 900, region: '上海市', city: '上海市',
    status: 'bidding', publishedAt: '2026-03-12', deadline: '2026-04-10',
    department: '上海市静安区大数据中心', source: '上海市政府采购云平台',
    description: '第一次采购因技术分歧废标。本次重新发布，预算调增100万，技术要求补充了大模型接入能力。',
    hasSubcontract: false, competitors: ['中软国际', '神州信息'],
    winner: null, policyRef: 'P003',
  },
  {
    id: 'B003', title: '重庆市渝北区智慧城市工程EPC总包（华为中标）',
    amount: 35000, region: '重庆市', city: '重庆市',
    status: 'awarded', publishedAt: '2026-03-01', deadline: null,
    department: '重庆市渝北区智慧城市建设指挥部', source: '重庆市公共资源交易平台',
    description: '智慧城市EPC总包，华为中标，标书中含大数据治理子模块（约1500万）。',
    hasSubcontract: true, competitors: [], winner: '华为技术有限公司',
    subcontractNote: '大数据治理模块（约1500万）将对外分包，是我司借船出海的切入点',
    policyRef: null,
  },
  {
    id: 'B004', title: '福建省政务AI大模型能力底座集中采购',
    amount: 3200, region: '福建省', city: '福州市',
    status: 'bidding', publishedAt: '2026-03-14', deadline: '2026-04-20',
    department: '福建省大数据管理局', source: '福建省政府采购网',
    description: '省级统一集采政务专用AI大模型底座，要求支持本地化私有化部署，面向全省40个省直部门提供服务。',
    hasSubcontract: false, competitors: ['华为云', '百度智能云'],
    winner: null, policyRef: null,
  },
  {
    id: 'B005', title: '北京市丰台区数字政务服务平台升级改造',
    amount: 1100, region: '北京市', city: '北京市',
    status: 'bidding', publishedAt: '2026-03-10', deadline: '2026-03-28',
    department: '北京市丰台区政务服务局', source: '北京市政府采购网',
    description: '对现有政务服务平台进行AI化智能升级，新增智能审批、AI客服、数据看板等功能。',
    hasSubcontract: false, competitors: ['中软国际', '思特奇'],
    winner: null, policyRef: null,
  },
  {
    id: 'B006', title: '辽宁省营口市公安局警务大数据平台',
    amount: 2400, region: '辽宁省', city: '营口市',
    status: 'failed', publishedAt: '2026-02-20', deadline: null,
    department: '营口市公安局', source: '辽宁省公共资源交易中心',
    description: '因预算调整原因发布废标公告，预计3月底重新发布更新后的采购需求。',
    hasSubcontract: false, competitors: ['中国电科', '海康威视'],
    winner: null, policyRef: null,
  },
]

// ============================================================
// 模拟数据 · 竞品情报库
// ============================================================
const competitors = [
  {
    id: 'C001', name: '华为技术有限公司（政务云业务）', shortName: '华为云',
    type: '整合型', strength: ['政府关系强', '硬件生态完整', '品牌背书强'],
    weakness: ['软件弹性不足', '定制化能力弱', '价格高昂'],
    recentWins: [
      { project: '重庆市渝北区智慧城市EPC', amount: 35000, date: '2026-03', region: '重庆' },
      { project: '广东省统一政务云底座', amount: 28000, date: '2026-01', region: '广东' },
    ],
    ecosystemPartners: ['新华三', '中软国际', '软通动力'],
    coverageRegions: ['广东', '重庆', '四川', '北京'],
  },
  {
    id: 'C002', name: '中软国际科技集团', shortName: '中软国际',
    type: '软件集成型', strength: ['华为生态深度绑定', '人力资源成本低', '承接能力强'],
    weakness: ['自研能力弱', '产品化程度低', '过度依赖华为'],
    recentWins: [
      { project: '北京市政务数据共享交换平台', amount: 1800, date: '2026-02', region: '北京' },
      { project: '河南省大数据中心扩容', amount: 3200, date: '2025-11', region: '河南' },
    ],
    ecosystemPartners: ['华为云', '毕马威', '安永'],
    coverageRegions: ['北京', '河南', '广东', '上海'],
  },
  {
    id: 'C003', name: '浪潮软件集团', shortName: '浪潮',
    type: '平台型', strength: ['山东根据地牢固', '政务领域老牌玩家', '本地化服务好'],
    weakness: ['AI能力相对滞后', '产品迭代慢'],
    recentWins: [
      { project: '山东省电子政务云平台扩容', amount: 8500, date: '2026-03', region: '山东' },
    ],
    ecosystemPartners: ['IBM', '甲骨文'],
    coverageRegions: ['山东', '江苏', '北京'],
  },
]

// ============================================================
// 模拟数据 · 政企图谱（存量/潜在客户）
// ============================================================
const customers = [
  {
    id: 'CU001', name: '广州市政务服务数据管理局', abbr: '广州政数局',
    region: '广东省', city: '广州市', type: '省会城市核心局',
    projects: [
      { name: '广州市政务数据共享交换平台一期', year: 2023, value: 680, status: '交付完成', role: '总包' },
      { name: '广州市数据安全管理系统（追加）', year: 2024, value: 220, status: '运维期', role: '总包' },
    ],
    totalValue: 900, lastContact: '2026-03-18',
    renewal: { risk: 'low', riskName: '低风险', title: '二期AI大模型升级：DIOS认知平台接入', value: 1500, date: '2026-Q3' },
    contacts: [
      { name: '王建国', role: '采购处处长', relation: '良好', phone: '138****0001' },
      { name: '张辉', role: '技术中心主任', relation: '协作', phone: '138****0011' },
    ],
    suppliers: ['我司（主包）', '华为云（基础设施）', '中软国际（实施）'],
  },
  {
    id: 'CU002', name: '深圳市南山区政务服务数据管理局', abbr: '南山政数局',
    region: '广东省', city: '深圳市', type: '区级重点客户',
    projects: [
      { name: '南山区政务云平台建设', year: 2023, value: 950, status: '运维期', role: '总包' },
    ],
    totalValue: 950, lastContact: '2026-03-19',
    renewal: { risk: 'low', riskName: '低风险', title: '二期AI+数据要素升级：智能审批与数据要素流通平台', value: 1200, date: '2026-Q2' },
    contacts: [
      { name: '陈志强', role: '副局长', relation: '深度合作', phone: '138****0002' },
      { name: '李明', role: '信息中心主任', relation: '良好', phone: '138****0012' },
    ],
    suppliers: ['我司（主包）', '腾讯云（基础设施）'],
  },
  {
    id: 'CU003', name: '杭州市西湖区大数据局', abbr: '西湖区大数据局',
    region: '浙江省', city: '杭州市', type: '区级',
    projects: [
      { name: '西湖区政务数字底座建设', year: 2022, value: 420, status: '交付完成', role: '数据底座分包' },
    ],
    totalValue: 420, lastContact: '2025-12-15',
    renewal: { risk: 'medium', riskName: '中等', title: '关注：人事异动衍生——拱墅区新建政务平台商机', value: null, date: null },
    contacts: [
      { name: '刘勇', role: '原局长（已调任拱墅区）', relation: '核心KP', phone: '138****0003' },
    ],
    suppliers: ['我司（分包）', '海康威视（主包）'],
  },
  {
    id: 'CU004', name: '天津市滨海新区城市管理委员会', abbr: '滨海城管委',
    region: '天津市', city: '天津市', type: '区级',
    projects: [
      { name: '滨海新区数字城管平台一期', year: 2023, value: 380, status: '维保到期（2026-06）', role: '总包' },
    ],
    totalValue: 380, lastContact: '2026-03-19',
    renewal: { risk: 'medium', riskName: '中等', title: '二期智能化改造：城管AI大脑升级+维保续签', value: 650, date: '2026-Q2' },
    contacts: [
      { name: '许明刚', role: '城管委主任', relation: '良好', phone: '138****0004' },
      { name: '赵丽', role: '信息科科长', relation: '协作', phone: '138****0014' },
    ],
    suppliers: ['我司（主包）', '科大讯飞（AI语音模块）'],
  },
  {
    id: 'CU005', name: '成都市锦江区政务服务和大数据局', abbr: '锦江大数据局',
    region: '四川省', city: '成都市', type: '区级',
    projects: [
      { name: '锦江区政务数据治理平台', year: 2024, value: 560, status: '运维期', role: '总包' },
      { name: '锦江区舆情监控系统', year: 2024, value: 180, status: '交付完成', role: '总包' },
    ],
    totalValue: 740, lastContact: '2026-03-12',
    renewal: { risk: 'medium', riskName: '中等', title: '西南区战略扩张：成都市级数据治理平台推广商机', value: 2200, date: '2026-Q4' },
    contacts: [
      { name: '周强', role: '局长', relation: '深度合作', phone: '138****0005' },
      { name: '李雪梅', role: '信息中心副主任', relation: '良好', phone: '138****0015' },
    ],
    suppliers: ['我司（主包）', '阿里云（基础设施）', '四川长虹（硬件集成）'],
  },
  {
    id: 'CU006', name: '北京市海淀区政务服务局', abbr: '海淀政务局',
    region: '北京市', city: '北京市', type: '重点区级',
    projects: [
      { name: '海淀区一体化政务服务平台改造', year: 2023, value: 1100, status: '运维期', role: '总包' },
      { name: '海淀区数据安全管控系统', year: 2024, value: 300, status: '交付完成', role: '总包' },
    ],
    totalValue: 1400, lastContact: '2026-02-28',
    renewal: { risk: 'medium', riskName: '中等', title: '三期AI大模型+智能审批接入（北京市统一集采候选）', value: 1800, date: '2026-Q3' },
    contacts: [
      { name: '马建设', role: '局长', relation: '深度合作', phone: '138****0006' },
      { name: '林子涵', role: '采购负责人', relation: '良好', phone: '138****0016' },
    ],
    suppliers: ['我司（主包）', '中关村科技（整合商）', '华为云（基础设施）'],
  },
  {
    id: 'CU007', name: '厦门市大数据中心', abbr: '厦门大数据中心',
    region: '福建省', city: '厦门市', type: '直属单位',
    projects: [
      { name: '厦门市政务数据共享平台建设', year: 2022, value: 850, status: '运维期', role: '核心模块分包' },
    ],
    totalValue: 850, lastContact: '2026-01-20',
    renewal: { risk: 'medium', riskName: '中等', title: '厦门数据要素市场化平台二期：需跟进预算拨付进度', value: 900, date: '2026-Q4' },
    contacts: [
      { name: '林国华', role: '中心主任', relation: '一般', phone: '138****0007' },
    ],
    suppliers: ['我司（分包）', '中软国际（主包）', '浪潮（硬件）'],
  },
  {
    id: 'CU008', name: '贵州省大数据发展管理局', abbr: '贵州大数据局',
    region: '贵州省', city: '贵阳市', type: '省级',
    projects: [
      { name: '贵州省政务大数据认知计算平台', year: 2023, value: 3200, status: '交付完成', role: '技术总包' },
      { name: '贵州省舆情大数据分析系统', year: 2024, value: 680, status: '运维期', role: '总包' },
    ],
    totalValue: 3880, lastContact: '2026-03-05',
    renewal: { risk: 'medium', riskName: '中等', title: '二期：省级AI决策支持平台建设（贵州数博会重点项目）', value: 3500, date: '2026-Q3' },
    contacts: [
      { name: '吴光明', role: '副局长', relation: '深度合作', phone: '138****0008' },
      { name: '胡宇', role: '技术处处长', relation: '良好', phone: '138****0018' },
    ],
    suppliers: ['我司（技术总包）', '中国电信贵州分公司（网络）'],
  },
]

// ============================================================
// 模拟数据 · 营销日历（展会/活动）
// ============================================================
const events = [
  {
    id: 'E001', name: '2026中国数字政府大会', type: 'conference',
    location: '北京国家会议中心', startDate: '2026-03-25', endDate: '2026-03-26',
    organizer: '工业和信息化部', relevance: 'high',
    description: '国内最高规格数字政府年度盛会，各省市大数据局长出席，是建立高层人脉的核心场景。',
    registered: true, expectedAttendees: '全国各省市大数据局长、信息化主管领导',
    leads: [],
  },
  {
    id: 'E002', name: '2026粤港澳大湾区数字经济峰会', type: 'summit',
    location: '广州琶洲会展中心', startDate: '2026-04-10', endDate: '2026-04-11',
    organizer: '广东省政务服务数据管理局', relevance: 'high',
    description: '聚焦大湾区数字政府建设与数据要素市场化，广东省及各市局长出席，是华南区重要客户关系维护场合。',
    registered: true, expectedAttendees: '广东省、深广佛等各市大数据局领导',
    leads: ['L001'],
  },
  {
    id: 'E003', name: '2026智慧城市与大数据技术博览会（上海）', type: 'expo',
    location: '上海世博展览馆', startDate: '2026-04-20', endDate: '2026-04-22',
    organizer: '中国智慧城市产业联盟', relevance: 'medium',
    description: '以展览为主，可接触华东区潜在客户，适合展示新产品方案。',
    registered: false, expectedAttendees: '华东区政府采购负责人、IT集成商',
    leads: [],
  },
  {
    id: 'E004', name: '全国大数据产业发展大会（贵阳）', type: 'conference',
    location: '贵阳国际会议中心', startDate: '2026-05-15', endDate: '2026-05-16',
    organizer: '国家数据局', relevance: 'medium',
    description: '国家数据局主办，重点展示数据要素市场化成果，可跟进多省市的数据要素平台建设需求。',
    registered: false, expectedAttendees: '全国数据要素相关主管部门',
    leads: [],
  },
]

// ============================================================
// 模拟数据 · 每日线索简报
// ============================================================
// 动态生成某天的简报（从当前 leads 实时取数）
function generateBriefing(date, leads_) {
  const sorted = [...leads_].sort((a, b) => b.score - a.score)
  return {
    id: `BR-${date.replace(/-/g, '')}`,
    date,
    title: `《智鹰ToG商机日报》${date}`,
    stats: {
      total: sorted.length,
      high: sorted.filter(l => l.score >= 70).length,
      medium: sorted.filter(l => l.score >= 55 && l.score < 70).length,
    },
    highlights: sorted.filter(l => l.score >= 70).slice(0, 5).map(l => ({
      id: l.id, title: l.title, score: l.score, type: l.typeName, nextAction: l.nextAction,
      region: l.region || l.city || '全国',
      scoreReason: l.scoreReason || '',
      summary: l.summary || '',
      contact: l.contact || '',
      contactRole: l.contactRole || '',
      sourceUrl: l.sourceUrl || '',
    })),
    sentChannels: ['飞书', '企业微信'],
    conversionStats: {
      pushed: sorted.length,
      claimed: Math.ceil(sorted.length * 0.7),
      converted: Math.ceil(sorted.length * 0.3),
    },
  }
}

// 动态生成最近 N 天的简报列表（基于当前 leads 实时数据）
function getDynamicBriefings(days = 7) {
  const result = []
  const sorted = [...leads].sort((a, b) => b.score - a.score)
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    // 今日简报：展示全部线索（分数最高的优先）
    // 历史简报：仅展示该天 createdAt 的线索，若无则留空
    const pool = i === 0 ? sorted : sorted.filter(l => l.createdAt === dateStr)
    result.push(generateBriefing(dateStr, pool))
  }
  return result
}

// ============================================================
// API 路由
// ============================================================
// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: '智鹰API服务运行正常', timestamp: new Date().toISOString() }))

// 工作台统计
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    totalLeads: leads.length,
    highPriority: leads.filter(l => l.score >= 70).length,
    contacting: leads.filter(l => l.status === 'contacting').length,
    filed: leads.filter(l => l.status === 'filed').length,
    funnel: [
      { name: '线索池', value: leads.length },
      { name: '接触中', value: leads.filter(l => l.status === 'contacting').length },
      { name: '已立项', value: leads.filter(l => l.status === 'filed').length },
      { name: '招投标', value: bids.filter(b => b.status === 'bidding').length },
    ],
    todayLeads: leads.filter(l => l.createdAt === '2026-03-21').length,
    renewalAlert: customers.filter(c => c.renewal.risk === 'low').length,
  })
})

// 工作台待办
app.get('/api/dashboard/todos', (req, res) => {
  res.json([
    { id: 1, type: 'urgent', text: '广州市政务数据局采购意向已公示，招标窗口期仅剩2周，请立即安排接触', leadId: 'L001', date: '2026-03-21' },
    { id: 2, type: 'reminder', text: '南山区二期升级方案建议书需本周五前提交', leadId: 'L003', date: '2026-03-22' },
    { id: 3, type: 'renewal', text: '天津滨海新区城管委维保合同6月到期，请加速推进续签谈判', leadId: 'L015', date: '2026-03-25' },
    { id: 4, type: 'visit', text: '福建省大数据局技术交流会（下周三），需提前准备大模型Demo', leadId: 'L009', date: '2026-03-26' },
    { id: 5, type: 'event', text: '中国数字政府大会（3月25日）：重点拜访山东省大数据局孙副局长', leadId: 'L005', date: '2026-03-25' },
  ])
})

// 线索列表（支持过滤）
app.get('/api/leads', (req, res) => {
  let result = [...leads]
  const { type, status, minScore, region, keyword, signalSource } = req.query
  if (type) result = result.filter(l => l.type === type)
  if (status) result = result.filter(l => l.status === status)
  if (minScore) result = result.filter(l => l.score >= Number(minScore))
  if (region) result = result.filter(l => l.region.includes(region))
  if (signalSource) result = result.filter(l => (l.signalSource || inferSignalSource(l)) === signalSource)
  if (keyword) result = result.filter(l => l.title.includes(keyword) || l.summary.includes(keyword))
  result.sort((a, b) => b.score - a.score)
  res.json({ data: result, total: result.length })
})

// 线索详情
app.get('/api/leads/:id', (req, res) => {
  const lead = leads.find(l => l.id === req.params.id)
  if (!lead) return res.status(404).json({ error: '线索不存在' })
  // 关联政策（如果有）
  const relatedPolicy = lead.policyRef ? policies.find(p => p.id === lead.policyRef) : null
  res.json({ ...lead, relatedPolicy })
})

// 更新线索状态
app.patch('/api/leads/:id/status', (req, res) => {
  const lead = leads.find(l => l.id === req.params.id)
  if (!lead) return res.status(404).json({ error: '线索不存在' })
  lead.status = req.body.status
  lead.updatedAt = new Date().toISOString().split('T')[0]
  res.json({ success: true, lead })
})

// 政策列表
app.get('/api/policies', (req, res) => {
  const { level, region, keyword } = req.query
  let result = [...policies, ...xinhuaPolicies]
  if (level) result = result.filter(p => p.level === level)
  if (region) result = result.filter(p => p.region.includes(region))
  if (keyword) result = result.filter(p => p.title.includes(keyword) || p.summary.includes(keyword))
  res.json({ data: result, total: result.length })
})

// 招采列表（静态 + 实时抓取数据合并）
app.get('/api/bids', (req, res) => {
  const { status, region, source } = req.query
  // source=realtime 只返回实时抓取数据；source=static 只返回静态数据
  let result
  if (source === 'realtime') result = [...ccgpBids]
  else if (source === 'static') result = [...bids]
  else result = [...bids, ...ccgpBids]
  if (status) result = result.filter(b => b.status === status)
  if (region) result = result.filter(b => b.region && b.region.includes(region))
  // 按发布时间降序
  result.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  res.json({ data: result, total: result.length, realtimeCount: ccgpBids.length })
})

// 爬虫状态查询
app.get('/api/crawler/status', (req, res) => {
  res.json({
    ...crawlerStatus,
    ccgpBidsCount: ccgpBids.length,
    xinhuaPoliciesCount: xinhuaPolicies.length,
    ndrcPoliciesCount: ndrcPolicies.length,
    cctvLeadsCount: cctvLeads.length,
    cebpubBidsCount: cebpubBids.length,
    sources: [
      { name: '中国政府采购网', url: 'http://www.ccgp.gov.cn/', signalSource: '招投标公告', count: ccgpBids.length },
      { name: '新华网信息公开', url: XINHUA_URL, signalSource: '政策文件', count: xinhuaPolicies.length },
      { name: NDRC_SOURCE, url: 'https://www.ndrc.gov.cn/', signalSource: '政策文件', count: ndrcPolicies.length },
      { name: CCTV_SOURCE, url: 'https://www.cctv.com/gyys/ldhd/index.shtml', signalSource: '企业新闻', count: cctvLeads.length },
      { name: CEBPUB_SOURCE, url: 'https://bulletin.cebpubservice.com/', signalSource: '招投标公告', count: cebpubBids.length },
      { name: CZW_SOURCE, url: 'https://www.caizhaowang.com/', signalSource: '招投标公告', count: czwBids.length },
      { name: MIIT_SOURCE, url: 'https://www.miit.gov.cn/', signalSource: '政策文件', count: miitPolicies.length },
    ],
    keywords: require('./scrapers/ccgp').FILTER_KEYWORDS,
    nextRun: '每30分钟自动执行一次',
  })
})

// 手动触发爬虫（用于调试或立即刷新）
app.post('/api/crawler/run', async (req, res) => {
  if (crawlerStatus.running) {
    return res.status(409).json({ message: '爬虫正在运行中，请稍后再试' })
  }
  res.json({ message: '爬虫任务已触发，请通过 /api/crawler/status 查看进度' })
  runCrawler()
})

// 竞品情报
app.get('/api/competitors', (req, res) => res.json({ data: competitors }))

// 政企图谱 - 客户列表
app.get('/api/graph/customers', (req, res) => res.json({ data: customers }))

// 营销活动日历
app.get('/api/events', (req, res) => res.json({ data: events }))

// 每日简报列表（动态生成，实时反映线索池最新数据）
app.get('/api/briefings', (req, res) => res.json({ data: getDynamicBriefings(7) }))

// 今日简报（动态生成）
app.get('/api/briefings/today', (req, res) => res.json(getDynamicBriefings(1)[0]))

// ============================================================
// 启动服务
// ============================================================
const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n🦅 智鹰后端API服务启动成功`)
  console.log(`   地址: http://localhost:${PORT}`)
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`)
})
