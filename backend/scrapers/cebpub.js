'use strict'
/**
 * 中国电子招标投标公共服务平台爬虫
 * 目标：https://bulletin.cebpubservice.com/
 * 信号源分类：招投标公告
 */

const axios = require('axios')
const cheerio = require('cheerio')

// 尝试多个公告列表页，提升抓取成功率
const CEBPUB_URLS = [
  { url: 'https://bulletin.cebpubservice.com/category/cggg/', name: '采购公告' },
  { url: 'https://bulletin.cebpubservice.com/category/zbgg/', name: '招标公告' },
  { url: 'https://bulletin.cebpubservice.com/', name: '首页公告' },
]

const FILTER_KEYWORDS = [
  '大数据', '数据治理', '数字政府', '政务数据', 'AI大模型', '数据中台',
  '数据平台', '数据湖', '数据共享', '数据开放', '数字化转型', '智慧城市',
  '政务云', '信息化平台', '数字经济', '数据要素', '一体化平台', '人工智能',
  '算力', '云计算', '数字化', '信息系统', '软件', '平台', '系统集成',
]

const HIGH_VALUE_KW = [
  '大数据', '数据治理', '数据中台', 'AI大模型', '政务AI', '数字政府', '数据要素',
  '数据湖', '数据共享', '智慧城市', '数字化转型', '人工智能', '算力中心',
]

const REGION_MAP = {
  '北京': { region: '北京市', city: '北京市' },
  '天津': { region: '天津市', city: '天津市' },
  '上海': { region: '上海市', city: '上海市' },
  '重庆': { region: '重庆市', city: '重庆市' },
  '广东': { region: '广东省', city: '广州市' },
  '广州': { region: '广东省', city: '广州市' },
  '深圳': { region: '广东省', city: '深圳市' },
  '浙江': { region: '浙江省', city: '杭州市' },
  '杭州': { region: '浙江省', city: '杭州市' },
  '江苏': { region: '江苏省', city: '南京市' },
  '山东': { region: '山东省', city: '济南市' },
  '四川': { region: '四川省', city: '成都市' },
  '成都': { region: '四川省', city: '成都市' },
  '湖北': { region: '湖北省', city: '武汉市' },
  '福建': { region: '福建省', city: '福州市' },
  '陕西': { region: '陕西省', city: '西安市' },
  '安徽': { region: '安徽省', city: '合肥市' },
  '河南': { region: '河南省', city: '郑州市' },
  '湖南': { region: '湖南省', city: '长沙市' },
  '云南': { region: '云南省', city: '昆明市' },
  '贵州': { region: '贵州省', city: '贵阳市' },
}

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `CEB-${Math.abs(hash).toString(36).toUpperCase()}`
}

function calcScore(title) {
  let score = 55
  for (const kw of HIGH_VALUE_KW) if (title.includes(kw)) score += 10
  return Math.min(score, 95)
}

function extractBudget(text) {
  const yi = text.match(/(\d+(?:\.\d+)?)\s*亿/)
  if (yi) return Math.round(parseFloat(yi[1]) * 10000)
  const wan = text.match(/(\d+(?:\.\d+)?)\s*万/)
  if (wan) return Math.round(parseFloat(wan[1]))
  return null
}

function extractRegion(title) {
  for (const [key, val] of Object.entries(REGION_MAP)) {
    if (title.includes(key)) return val
  }
  return { region: '全国', city: '未知' }
}

function extractDate(text, href) {
  const m1 = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[1]
  const m2 = href.match(/(20\d{2})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return new Date().toISOString().split('T')[0]
}

function normalizeHref(href, base) {
  if (!href) return ''
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return `https:${href}`
  try { return new URL(href, base).toString() } catch { return '' }
}

function mapBidStatus(title) {
  if (title.includes('中标') || title.includes('成交') || title.includes('结果')) return 'awarded'
  if (title.includes('废标') || title.includes('终止')) return 'failed'
  if (title.includes('意向') || title.includes('公示')) return 'intention'
  return 'bidding'
}

async function scrapeCebpubLatest() {
  const allItems = []
  const seen = new Set()

  for (const page of CEBPUB_URLS) {
    try {
      const resp = await axios.get(page.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Referer': 'https://bulletin.cebpubservice.com/',
        },
      })

      const $ = cheerio.load(resp.data)

      $('a').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim()
        const href = normalizeHref($(el).attr('href') || '', page.url)
        const parentText = $(el).closest('li, tr, div').text().replace(/\s+/g, ' ').trim()

        if (!title || title.length < 8 || title.length > 120) return
        if (!href || href.includes('javascript:')) return
        if (seen.has(title)) return
        if (['首页', '返回', '更多', '下一页', '上一页', '会员登录', '注册'].includes(title)) return

        // 只保留与关键词相关的公告
        const isRelevant = FILTER_KEYWORDS.some(k => title.includes(k))
        if (!isRelevant) return

        seen.add(title)
        const geo = extractRegion(title)
        allItems.push({
          id: buildId(title),
          title,
          sourceUrl: href,
          publishedAt: extractDate(parentText, href),
          score: calcScore(title),
          budget: extractBudget(parentText),
          region: geo.region,
          city: geo.city,
          statusKey: mapBidStatus(title),
          category: page.name,
        })
      })
    } catch (err) {
      console.warn(`[CEBPUB] 抓取 ${page.url} 失败: ${err.message}`)
    }
  }

  const result = allItems
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 40)

  return result
}

module.exports = { scrapeCebpubLatest, CEBPUB_SOURCE: '中国电子招标投标公共服务平台' }
