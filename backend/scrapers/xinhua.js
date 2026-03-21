'use strict'

const axios = require('axios')
const cheerio = require('cheerio')

const XINHUA_URL = 'https://www.xinhuanet.com/xinhuashe/xxgk.htm'

const KEYWORDS_HIGH = [
  '数字政府', '数据要素', '政务数据', '数据治理', '人工智能', '大模型', '智慧城市',
  '招标', '采购', '建设项目', '平台建设', '系统建设', '信息化',
]

const KEYWORDS_MED = [
  '信息公开', '政务服务', '数字化', '营商环境', '公共服务',
  '政策', '规划', '改革', '发展', '通知', '意见', '方案', '实施',
]

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `XH-${Math.abs(hash).toString(36).toUpperCase()}`
}

function calcScore(title) {
  let score = 55
  for (const kw of KEYWORDS_HIGH) if (title.includes(kw)) score += 10
  for (const kw of KEYWORDS_MED) if (title.includes(kw)) score += 4
  return Math.min(score, 92)
}

function extractDate(text, href) {
  const m1 = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[1]
  const m2 = href.match(/(20\d{2})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  return new Date().toISOString().split('T')[0]
}

function normalizeHref(href) {
  if (!href) return ''
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return `https:${href}`
  try {
    return new URL(href, XINHUA_URL).toString()
  } catch {
    return ''
  }
}

async function scrapeXinhuaLatest() {
  const resp = await axios.get(XINHUA_URL, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  })

  const $ = cheerio.load(resp.data)
  const raw = []
  const seen = new Set()

  $('a').each((_, el) => {
    const title = $(el).text().replace(/\s+/g, ' ').trim()
    const href = normalizeHref($(el).attr('href') || '')

    if (!title || title.length < 8 || title.length > 90) return
    if (!href || href.includes('javascript:')) return
    if (seen.has(title)) return

    seen.add(title)
    raw.push({
      id: buildId(title),
      title,
      sourceUrl: href,
      publishedAt: extractDate(title, href),
      score: calcScore(title),
    })
  })

  // 优先保留与 ToG 商机场景相关的条目，最多返回 30 条
  const related = raw.filter(item => {
    const t = item.title
    return [...KEYWORDS_HIGH, ...KEYWORDS_MED].some(k => t.includes(k))
  })

  const result = (related.length ? related : raw)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 30)

  return result
}

module.exports = { scrapeXinhuaLatest, XINHUA_URL }
