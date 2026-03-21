'use strict'
/**
 * 采招网爬虫 (caizhaowang.com)
 * 全国领先的招采信息平台，日均发布数万条招投标公告
 * 信号源分类：招投标公告
 */
const axios = require('axios')
const cheerio = require('cheerio')
const https = require('https')

// 采招网使用了较旧的TLS配置，需要宽松的HTTPS Agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ciphers: 'DEFAULT:@SECLEVEL=0',
  minVersion: 'TLSv1',
})

const CZW_URLS = [
  { url: 'http://www.caizhaowang.com/zbgg/', name: '招标公告' },
  { url: 'http://www.caizhaowang.com/cjgg/', name: '成交公告' },
  { url: 'http://www.caizhaowang.com/zhaobiao/', name: '招标信息' },
]

const FILTER_KEYWORDS = [
  // 核心业务关键词（中科闻歌三大领域）
  '大数据', '数据治理', '数字政府', '政务数据', '人工智能', '大模型',
  '舆情', '媒体', '融媒体', '传媒', '广播电视', '内容管理',
  '金融科技', '智能风控', '银行', '保险科技',
  '公共安全', '社会治理', '智慧城市', '数字化转型',
  '数据平台', '数据中台', '知识图谱', '算法', '智能分析', '决策支持',
  '信息化', '系统建设', '平台建设', '软件开发',
]

const HIGH_VALUE_KW = [
  '大数据', '人工智能', '大模型', '数据治理', '舆情', '融媒体',
  '公共安全', '智能风控', '知识图谱', '数字政府', '数据中台',
]
const MED_VALUE_KW = [
  '数字化转型', '智慧城市', '信息化', '平台建设', '系统建设',
  '媒体', '银行', '金融', '决策支持', '智能分析',
]

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `CZW-${Math.abs(hash).toString(36).toUpperCase()}`
}

function calcScore(title, dept = '') {
  let score = 55
  const text = title + dept
  for (const kw of HIGH_VALUE_KW) if (text.includes(kw)) score += 9
  for (const kw of MED_VALUE_KW) if (text.includes(kw)) score += 4
  // 预算加分
  const yi = text.match(/(\d+(?:\.\d+)?)\s*亿/)
  if (yi) score += Math.min(15, Math.round(parseFloat(yi[1]) * 3))
  const wan = text.match(/(\d+(?:\.\d+)?)\s*万/)
  if (wan) {
    const v = parseFloat(wan[1])
    if (v >= 1000) score += 10
    else if (v >= 300) score += 6
    else if (v >= 50) score += 3
  }
  return Math.min(score, 95)
}

async function scrapeCaizhaowangLatest() {
  const results = []
  const seen = new Set()
  const today = new Date().toISOString().split('T')[0]

  for (const page of CZW_URLS) {
    try {
      const resp = await axios.get(page.url, {
        timeout: 12000,
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Referer': 'https://www.caizhaowang.com/',
        },
      })
      const $ = cheerio.load(resp.data)

      // 尝试多种常见列表选择器
      const selectors = ['ul.list li', '.list-item', 'ul li a', '.notice-list li', '.info-list li', 'table tr']
      let items = $()
      for (const sel of selectors) {
        const found = $(sel)
        if (found.length > 3) { items = found; break }
      }

      items.each((i, el) => {
        const $el = $(el)
        const $a = $el.is('a') ? $el : $el.find('a').first()
        const title = ($a.text() || $el.text()).replace(/\s+/g, ' ').trim()
        const href = $a.attr('href') || ''
        if (!title || title.length < 8) return
        const isRelevant = FILTER_KEYWORDS.some(kw => title.includes(kw))
        if (!isRelevant) return
        const id = buildId(title)
        if (seen.has(id)) return
        seen.add(id)
        const sourceUrl = href.startsWith('http') ? href
          : href.startsWith('/') ? `https://www.caizhaowang.com${href}` : ''
        results.push({
          id,
          title,
          score: calcScore(title),
          sourceUrl,
          publishedAt: today,
          category: page.name,
        })
      })
      console.log(`[采招网] ${page.name}: 抓取 ${results.length} 条相关公告`)
    } catch (e) {
      console.warn(`[采招网] 抓取 ${page.url} 失败: ${e.message}`)
    }
  }
  return results.filter(r => r.title.length > 5)
}

const CZW_SOURCE = '采招网 (caizhaowang.com)'
module.exports = { scrapeCaizhaowangLatest, CZW_SOURCE }
