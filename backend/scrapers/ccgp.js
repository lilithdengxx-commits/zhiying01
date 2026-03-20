'use strict'
/**
 * 中国政府采购网 (www.ccgp.gov.cn) 实时爬虫
 * 搜索接口: http://search.ccgp.gov.cn/bxsearch
 * 编码: GBK（自动检测并转换）
 */
const axios = require('axios')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')

// ── 搜索关键词（与我司产品高度相关）──────────────────────────
const SEARCH_KEYWORDS = [
  '大数据平台',
  '数据治理',
  '数字政府',
  '政务数据',
  'AI大模型',
]

// ── 评分维度关键词 ────────────────────────────────────────────
const HIGH_VALUE_KW = ['大数据', '数据治理', '数据中台', 'AI大模型', '政务AI', '数字政府', '数据要素', '数据湖', '数据共享']
const MED_VALUE_KW  = ['智慧城市', '数字化', '政务服务', '云平台', '信息化改造', '平台建设', '一网通办']

// ── 省市映射表 ────────────────────────────────────────────────
const REGION_MAP = {
  '北京': { region: '北京市',  city: '北京市'  },
  '天津': { region: '天津市',  city: '天津市'  },
  '上海': { region: '上海市',  city: '上海市'  },
  '重庆': { region: '重庆市',  city: '重庆市'  },
  '广州': { region: '广东省',  city: '广州市'  },
  '深圳': { region: '广东省',  city: '深圳市'  },
  '广东': { region: '广东省',  city: '广州市'  },
  '浙江': { region: '浙江省',  city: '杭州市'  },
  '杭州': { region: '浙江省',  city: '杭州市'  },
  '宁波': { region: '浙江省',  city: '宁波市'  },
  '江苏': { region: '江苏省',  city: '南京市'  },
  '南京': { region: '江苏省',  city: '南京市'  },
  '苏州': { region: '江苏省',  city: '苏州市'  },
  '山东': { region: '山东省',  city: '济南市'  },
  '济南': { region: '山东省',  city: '济南市'  },
  '福建': { region: '福建省',  city: '福州市'  },
  '福州': { region: '福建省',  city: '福州市'  },
  '四川': { region: '四川省',  city: '成都市'  },
  '成都': { region: '四川省',  city: '成都市'  },
  '湖北': { region: '湖北省',  city: '武汉市'  },
  '武汉': { region: '湖北省',  city: '武汉市'  },
  '湖南': { region: '湖南省',  city: '长沙市'  },
  '河南': { region: '河南省',  city: '郑州市'  },
  '陕西': { region: '陕西省',  city: '西安市'  },
  '辽宁': { region: '辽宁省',  city: '沈阳市'  },
  '安徽': { region: '安徽省',  city: '合肥市'  },
  '贵州': { region: '贵州省',  city: '贵阳市'  },
  '云南': { region: '云南省',  city: '昆明市'  },
  '江西': { region: '江西省',  city: '南昌市'  },
  '广西': { region: '广西壮族自治区', city: '南宁市' },
  '内蒙古': { region: '内蒙古',  city: '呼和浩特市' },
  '海南': { region: '海南省',  city: '海口市'  },
  '河北': { region: '河北省',  city: '石家庄市' },
  '山西': { region: '山西省',  city: '太原市'  },
  '黑龙江': { region: '黑龙江省', city: '哈尔滨市' },
  '吉林': { region: '吉林省',  city: '长春市'  },
  '新疆': { region: '新疆',    city: '乌鲁木齐市' },
  '甘肃': { region: '甘肃省',  city: '兰州市'  },
  '宁夏': { region: '宁夏',    city: '银川市'  },
  '青海': { region: '青海省',  city: '西宁市'  },
  '西藏': { region: '西藏',    city: '拉萨市'  },
}

// ── 提取省市 ──────────────────────────────────────────────────
function extractRegionCity(text) {
  for (const [key, val] of Object.entries(REGION_MAP)) {
    if (text.includes(key)) return val
  }
  return { region: '全国', city: '未知' }
}

// ── 提取预算金额（万元） ───────────────────────────────────────
function extractBudget(text) {
  const yi = text.match(/(\d+(?:\.\d+)?)\s*亿[元人民币]?/)
  if (yi) return Math.round(parseFloat(yi[1]) * 10000)
  const wan = text.match(/(\d+(?:\.\d+)?)\s*万[元人民币]?/)
  if (wan) return Math.round(parseFloat(wan[1]))
  return null
}

// ── 公告类型 → bid status ─────────────────────────────────────
function mapStatus(announceType) {
  if (!announceType) return 'bidding'
  if (announceType.includes('成交') || announceType.includes('中标') || announceType.includes('结果')) return 'awarded'
  if (announceType.includes('废标') || announceType.includes('终止') || announceType.includes('异常')) return 'failed'
  if (announceType.includes('意向')) return 'intention'
  return 'bidding'
}

// ── AI 评分 ───────────────────────────────────────────────────
function calculateScore(title, dept) {
  let score = 50
  const text = title + dept
  for (const kw of HIGH_VALUE_KW) { if (text.includes(kw)) score += 7 }
  for (const kw of MED_VALUE_KW)  { if (text.includes(kw)) score += 3 }
  // 省级机构加分
  if (dept.includes('省') && (dept.includes('厅') || dept.includes('局'))) score += 5
  // 预算加分
  const budget = extractBudget(title)
  if (budget) {
    if (budget >= 5000) score += 10
    else if (budget >= 1000) score += 7
    else if (budget >= 300) score += 4
  }
  return Math.min(Math.max(score, 45), 95)
}

// ── 根据评分生成操作建议 ──────────────────────────────────────
function genNextAction(title, score, dept) {
  if (score >= 80) return `高优先级：立即安排商务团队联系 ${dept}，确认采购需求和预算情况`
  if (score >= 65) return `中优先级：本周内跟进 ${dept}，了解项目立项进展`
  return `持续观察：${dept} 项目已录入线索池，待预算确认后跟进`
}

// ── 生成去重 ID ───────────────────────────────────────────────
function makeId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `CCGP-${Math.abs(hash).toString(36).toUpperCase()}`
}

// ── 发起 HTTP 请求（自动处理 GBK/UTF-8 编码）────────────────
async function fetchPage(keyword, pageIndex = 1) {
  const response = await axios.get('http://search.ccgp.gov.cn/bxsearch', {
    params: {
      searchtype: 1,
      page_index: pageIndex,
      bidSort: 0,
      buyerName: '',
      projectId: '',
      pinMu: 0,
      bidType: 0,
      dbselect: 'bidx',
      kw: keyword,
      timeType: 6,  // 近6个月
      displayZone: '',
      zoneId: '',
      pppStatus: 0,
      agentName: '',
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'http://www.ccgp.gov.cn/',
      'Connection': 'keep-alive',
    },
    responseType: 'arraybuffer',
    timeout: 15000,
  })

  // 自动检测编码
  const contentType = (response.headers['content-type'] || '').toLowerCase()
  const encoding = contentType.includes('utf-8') ? 'utf-8' : 'gbk'
  return iconv.decode(Buffer.from(response.data), encoding)
}

// ── 解析搜索结果 HTML ─────────────────────────────────────────
function parseHTML(html, keyword) {
  const $ = cheerio.load(html, { decodeEntities: false })
  const items = []

  // ccgp 搜索结果列表选择器（兼容多种版本的页面结构）
  const rows = $('ul.vT-srch-result-list-bid li, .vT-srch-result-list li, .search-result-list li, table.pList tr')

  rows.each((_, el) => {
    const $el = $(el)
    const anchor = $el.find('a').first()
    const title = anchor.text().trim().replace(/\s+/g, ' ')
    const href  = anchor.attr('href') || ''

    if (!title || title.length < 5) return

    const infoText = $el.find('p, span, td').text().replace(/\s+/g, ' ')

    // 解析采购单位
    const deptMatch = infoText.match(/采购[人单位]{0,2}[：:\s]([^|｜\n]{2,30})/)
    const dept = (deptMatch ? deptMatch[1].trim() : '').replace(/代理.*$/, '').trim() || '未知单位'

    // 解析发布日期
    const dateMatch = infoText.match(/(\d{4}-\d{2}-\d{2})/)
    const publishedAt = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0]

    // 解析公告类型
    const typeMatch = infoText.match(/公告类型[：:\s]([^|｜\n]{2,20})/)
    const announceType = typeMatch ? typeMatch[1].trim() : '采购公告'

    const { region, city } = extractRegionCity(dept + title + infoText)
    const budget = extractBudget(title)
    const score  = calculateScore(title, dept)
    const id     = makeId(title)

    items.push({
      id,
      title,
      href,
      dept,
      region,
      city,
      budget,
      publishedAt,
      announceType,
      status: mapStatus(announceType),
      score,
      keyword,
      nextAction: genNextAction(title, score, dept),
    })
  })

  return items
}

// ── 主抓取函数 ────────────────────────────────────────────────
async function scrapeLatest() {
  const results = []
  const seenIds = new Set()
  const delay = ms => new Promise(r => setTimeout(r, ms))

  for (let i = 0; i < SEARCH_KEYWORDS.length; i++) {
    const kw = SEARCH_KEYWORDS[i]
    try {
      console.log(`[CCGP] 抓取关键词: "${kw}" ...`)
      const html  = await fetchPage(kw)
      const items = parseHTML(html, kw)

      let newCount = 0
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id)
          results.push(item)
          newCount++
        }
      }
      console.log(`[CCGP] "${kw}" → ${newCount} 条新数据，累计 ${results.length} 条`)

      // 礼貌延迟，避免触发限流
      if (i < SEARCH_KEYWORDS.length - 1) await delay(2500)
    } catch (err) {
      console.error(`[CCGP] 关键词 "${kw}" 抓取失败: ${err.message}`)
    }
  }

  return results
}

module.exports = { scrapeLatest, SEARCH_KEYWORDS }
