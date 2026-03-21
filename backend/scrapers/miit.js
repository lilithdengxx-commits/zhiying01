'use strict'
/**
 * 工业和信息化部（MIIT）爬虫
 * 目标：https://www.miit.gov.cn/
 * 信号源分类：政策文件
 * 工信部是 AI/大数据/数字经济/ICT 政策的核心发布方，与中科闻歌三大领域高度相关
 */

const axios = require('axios')
const cheerio = require('cheerio')

const MIIT_URLS = [
  { url: 'https://www.miit.gov.cn/', name: '工信部首页' },
  { url: 'https://www.miit.gov.cn/zwgk/zcjd/', name: '政策解读' },
  { url: 'https://www.miit.gov.cn/cmsdNN/gzcy/tzgg/', name: '通知公告' },
  { url: 'https://www.miit.gov.cn/n973401/', name: '新闻资讯' },
]

const KEYWORDS_HIGH = [
  '人工智能', '大模型', '数字经济', '数据要素', '数字政府', '数字化转型',
  '工业互联网', '工业大数据', '公共安全', '社会治理', '融媒体', '媒体融合',
  '金融科技', '数字金融', '数字中国', '新型基础设施', '数据安全', '算力',
  '数据治理', '认知计算', '大数据', '智能制造', '软件产业', '信创',
]

const KEYWORDS_MED = [
  '信息化', '数字化', '平台建设', '政务服务', '公共服务', '创新发展',
  '产业数字化', '专项资金', '试点', '示范区', '智慧城市', '知识图谱',
  '信息技术', '电子信息', '集成电路', '互联网', '5G', '物联网',
  // 通用政府文件关键词（提高命中率）
  '通知', '意见', '方案', '规划', '政策', '指导', '实施', '推进', '工作', '建设',
]

function buildId(title) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash |= 0
  }
  return `MIIT-${Math.abs(hash).toString(36).toUpperCase()}`
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

async function scrapeMiitLatest() {
  const allItems = []
  const seen = new Set()

  for (const page of MIIT_URLS) {
    try {
      const resp = await axios.get(page.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Referer': 'https://www.miit.gov.cn/',
        },
      })

      const $ = cheerio.load(resp.data)

      $('a').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim()
        const href = normalizeHref($(el).attr('href') || '', page.url)
        const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim()

        if (!title || title.length < 8 || title.length > 200) return
        if (['首页', '返回', '更多', '下一页', '上一页', '登录', '注册'].includes(title)) return

        const combined = title + parentText
        const isRelevant = [...KEYWORDS_HIGH, ...KEYWORDS_MED].some(kw => combined.includes(kw))
        if (!isRelevant) return
        if (seen.has(title)) return
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
      console.warn(`[MIIT] 抓取 ${page.url} 失败: ${err.message}`)
    }
  }

  console.log(`[MIIT] 共抓取 ${allItems.length} 条政策文件（工信部）`)
  return allItems
}

const MIIT_SOURCE = '工业和信息化部 (miit.gov.cn)'
module.exports = { scrapeMiitLatest, MIIT_SOURCE }
