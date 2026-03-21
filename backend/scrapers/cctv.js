'use strict'
/**
 * 央视网数据源爬虫（领导活动/政企动态）
 * 目标：https://www.cctv.com/gyys/ldhd/index.shtml
 * 信号源分类：企业新闻
 */

const axios = require('axios')
const cheerio = require('cheerio')

const CCTV_URLS = [
  { url: 'https://www.cctv.com/gyys/ldhd/index.shtml', name: '领导活动' },
  { url: 'https://news.cctv.com/china/index.shtml', name: '国内时政' },
]

const KEYWORDS_HIGH = [
  '数字经济', '数字中国', '数据要素', '人工智能', '数字政府', '数字化转型',
  '智慧城市', '大数据', '算力', '平台建设', '数字基础设施', '数据安全',
]

const KEYWORDS_MED = [
  '信息化', '数字化', '政务', '政府', '数据', '互联网', '科技', '创新',
  '基础设施', '5G', '新型', '示范', '试点', '数字',
]

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `CCTV-${Math.abs(hash).toString(36).toUpperCase()}`
}

function calcScore(title) {
  let score = 52
  for (const kw of KEYWORDS_HIGH) if (title.includes(kw)) score += 9
  for (const kw of KEYWORDS_MED) if (title.includes(kw)) score += 3
  return Math.min(score, 88)
}

function extractDate(text, href) {
  const m1 = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[1]
  const m2 = href.match(/(20\d{2})(\d{2})(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  // 从URL路径提取: /2026/03/21/
  const m3 = href.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//)
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`
  return new Date().toISOString().split('T')[0]
}

function normalizeHref(href, base) {
  if (!href) return ''
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return `https:${href}`
  try { return new URL(href, base).toString() } catch { return '' }
}

async function scrapeCctvLatest() {
  const allItems = []
  const seen = new Set()

  for (const page of CCTV_URLS) {
    try {
      const resp = await axios.get(page.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Referer': 'https://www.cctv.com/',
        },
      })

      const $ = cheerio.load(resp.data)

      $('a').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim()
        const href = normalizeHref($(el).attr('href') || '', page.url)
        const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim()

        if (!title || title.length < 8 || title.length > 100) return
        if (!href || href.includes('javascript:')) return
        if (seen.has(title)) return
        if (['首页', '返回', '更多', '下一页', '上一页', '直播', '视频'].includes(title)) return

        seen.add(title)
        allItems.push({
          id: buildId(title),
          title,
          sourceUrl: href,
          publishedAt: extractDate(parentText + ' ' + href, href),
          score: calcScore(title),
          category: page.name,
        })
      })
    } catch (err) {
      console.warn(`[CCTV] 抓取 ${page.url} 失败: ${err.message}`)
    }
  }

  const related = allItems.filter(item =>
    [...KEYWORDS_HIGH, ...KEYWORDS_MED].some(k => item.title.includes(k))
  )

  // 只返回有相关关键词的条目，避免无关领导活动进入线索池
  const result = related
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 30)

  return result
}

module.exports = { scrapeCctvLatest, CCTV_SOURCE: '央视新闻（领导活动/国内时政）' }
