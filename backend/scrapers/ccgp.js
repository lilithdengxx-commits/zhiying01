'use strict'
const axios = require('axios')
const cheerio = require('cheerio')

const SOURCE_PAGES = [
  { url: 'http://www.ccgp.gov.cn/cggg/dfgg/', name: '地方采购公告' },
  { url: 'http://www.ccgp.gov.cn/cggg/zygg/', name: '中央采购公告' },
]

const FILTER_KEYWORDS = [
  '大数据', '数据治理', '数字政府', '政务数据', 'AI大模型', '数据中台',
  '数据平台', '数据湖', '数据共享', '数据开放', '数字化转型', '智慧城市',
  '政务云', '信息化平台', '数字经济', '数据要素', '一体化平台',
]

const HIGH_VALUE_KW = ['大数据', '数据治理', '数据中台', 'AI大模型', '政务AI', '数字政府', '数据要素', '数据湖', '数据共享']
const MED_VALUE_KW  = ['智慧城市', '数字化', '政务服务', '政务云', '信息化平台', '一体化平台', '数字经济']

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
  '内蒙古': { region: '内蒙古', city: '呼和浩特市' },
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

function extractRegion(shortName) {
  return REGION_MAP[shortName] || { region: shortName || '全国', city: shortName || '未知' }
}

function extractBudget(text) {
  const yi = text.match(/(\d+(?:\.\d+)?)\s*亿[元人民币]?/)
  if (yi) return Math.round(parseFloat(yi[1]) * 10000)
  const wan = text.match(/(\d+(?:\.\d+)?)\s*万[元人民币]?/)
  if (wan) return Math.round(parseFloat(wan[1]))
  return null
}

function mapStatus(typeText) {
  if (!typeText) return 'bidding'
  if (typeText.includes('中标') || typeText.includes('成交') || typeText.includes('结果')) return 'awarded'
  if (typeText.includes('废标') || typeText.includes('终止') || typeText.includes('异常')) return 'failed'
  if (typeText.includes('意向') || typeText.includes('公示')) return 'intention'
  return 'bidding'
}

function calculateScore(title, dept) {
  let score = 50
  const text = title + dept
  HIGH_VALUE_KW.forEach(kw => { if (text.includes(kw)) score += 7 })
  MED_VALUE_KW.forEach(kw  => { if (text.includes(kw)) score += 3 })
  if (dept.includes('省') && (dept.includes('厅') || dept.includes('局'))) score += 5
  const budget = extractBudget(title)
  if (budget) {
    if (budget >= 5000) score += 10
    else if (budget >= 1000) score += 7
    else if (budget >= 300) score += 4
  }
  return Math.min(Math.max(score, 45), 95)
}

function makeId(title) {
  let h = 0
  for (let i = 0; i < title.length; i++) { h = ((h << 5) - h) + title.charCodeAt(i); h |= 0 }
  return 'CCGP-' + Math.abs(h).toString(36).toUpperCase()
}

function matchesOurBusiness(title, dept) {
  const text = title + dept
  return FILTER_KEYWORDS.some(kw => text.includes(kw))
}

async function fetchListPage(pageUrl) {
  const response = await axios.get(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'http://www.ccgp.gov.cn/',
    },
    timeout: 15000,
  })
  return response.data
}

function parsePage(html) {
  const $ = cheerio.load(html)
  const results = []
  $('li').each(function() {
    const typeEl = $(this).find('em[rel="bxlx"]')
    if (typeEl.length === 0) return
    const anchor = $(this).find('a').first()
    const fullTitle = (anchor.attr('title') || anchor.text()).trim()
    const href = anchor.attr('href') || ''
    const sourceUrl = href.startsWith('http') ? href
      : 'http://www.ccgp.gov.cn/cggg/dfgg/' + href.replace(/^\.\//,'')
    const typeText = typeEl.text().trim()
    const ems = $(this).find('em:not([rel])')
    const date = ems.eq(0).text().trim()
    const regionShort = ems.eq(1).text().trim()
    const dept = ems.eq(2).text().trim()
    if (!fullTitle || fullTitle.length < 5) return
    const { region, city } = extractRegion(regionShort)
    const budget = extractBudget(fullTitle)
    const score = calculateScore(fullTitle, dept)
    const id = makeId(fullTitle)
    const publishedAt = (date || '').substring(0, 10) || new Date().toISOString().substring(0, 10)
    results.push({ id, fullTitle, sourceUrl, typeText, dept, region, city, budget, publishedAt, score })
  })
  return results
}

async function scrapeLatest() {
  const all = []
  const seenIds = new Set()
  const delay = ms => new Promise(r => setTimeout(r, ms))
  for (let i = 0; i < SOURCE_PAGES.length; i++) {
    const src = SOURCE_PAGES[i]
    try {
      console.log('[CCGP] 正在抓取:', src.name)
      const html = await fetchListPage(src.url)
      const items = parsePage(html)
      let kept = 0
      for (const item of items) {
        if (seenIds.has(item.id)) continue
        seenIds.add(item.id)
        if (!matchesOurBusiness(item.fullTitle, item.dept)) continue
        all.push(item)
        kept++
      }
      console.log('[CCGP]', src.name + ': 获取', items.length, '条，命中关键词', kept, '条')
      if (i < SOURCE_PAGES.length - 1) await delay(2000)
    } catch (err) {
      console.error('[CCGP]', src.name, '抓取失败:', err.message)
    }
  }
  console.log('[CCGP] 本轮共抓取到', all.length, '条相关标讯')
  return all
}

module.exports = { scrapeLatest, FILTER_KEYWORDS }
