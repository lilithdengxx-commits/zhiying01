'use strict'
/**
 * 发改委数据源爬虫
 * 目标：https://www.ndrc.gov.cn/
 * 信号源分类：政策文件
 */

const axios = require('axios')
const cheerio = require('cheerio')

const NDRC_URLS = [
  { url: 'https://www.ndrc.gov.cn/xxgk/zcfb/', name: '政策发布' },
  { url: 'https://www.ndrc.gov.cn/xwdt/tzgg/', name: '通知公告' },
]

const KEYWORDS_HIGH = [
  '数字经济', '数据要素', '数字政府', '人工智能', '大模型', '数字化转型',
  '新型基础设施', '智慧城市', '数字中国', '数据安全', '算力', '数据治理',
]

const KEYWORDS_MED = [
  '信息化', '数字化', '平台建设', '政务服务', '公共服务', '创新发展',
  '产业数字化', '专项资金', '试点', '示范区',
]

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `NDRC-${Math.abs(hash).toString(36).toUpperCase()}`
}

function calcScore(title) {
  let score = 58
  for (const kw of KEYWORDS_HIGH) if (title.includes(kw)) score += 10
  for (const kw of KEYWORDS_MED) if (title.includes(kw)) score += 4
  return Math.min(score, 95)
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

async function scrapeNdrcLatest() {
  const allItems = []
  const seen = new Set()

  for (const page of NDRC_URLS) {
    try {
      const resp = await axios.get(page.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Referer': 'https://www.ndrc.gov.cn/',
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
        // 过滤导航类链接
        if (['首页', '返回', '更多', '下一页', '上一页', '站点地图'].includes(title)) return

        seen.add(title)
        allItems.push({
          id: buildId(title),
          title,
          sourceUrl: href,
          publishedAt: extractDate(parentText, href),
          score: calcScore(title),
          category: page.name,
        })
      })
    } catch (err) {
      console.warn(`[NDRC] 抓取 ${page.url} 失败: ${err.message}`)
    }
  }

  // 过滤相关条目
  const related = allItems.filter(item =>
    [...KEYWORDS_HIGH, ...KEYWORDS_MED].some(k => item.title.includes(k))
  )

  const result = (related.length ? related : allItems)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 30)

  return result
}

module.exports = { scrapeNdrcLatest, NDRC_SOURCE: '国家发展改革委官网' }
