const axios = require('axios')
const cheerio = require('cheerio')

;(async () => {
  const r = await axios.get('http://www.ccgp.gov.cn/cggg/dfgg/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    timeout: 12000,
  })
  const $ = cheerio.load(r.data)

  // 统计实际公告 li 数量
  const notices = $('li').filter(function() { return $(this).find('em[rel="bxlx"]').length > 0 })
  console.log('实际公告数量:', notices.length)

  // 查看分页相关 HTML
  const pagerText = r.data.match(/第\d+页|共\d+页|nextPage|pageIndex|page_|totalPage|pageNum|\bpager\b/gi)
  if (pagerText) console.log('分页关键词:', [...new Set(pagerText)].slice(0, 20))

  // 尝试翻页 URL
  const r2 = await axios.get('http://www.ccgp.gov.cn/cggg/dfgg/index_2.html', {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000,
  }).catch(e => ({ status: e.response?.status, data: '' }))
  console.log('分页URL index_2.html 状态:', r2.status || r2.headers?.['content-type'])

  // 找全部公告 li 的标题（含时间）
  notices.each(function(i) {
    if (i >= 8) return false
    const anchor = $(this).find('a')
    const title = anchor.attr('title') || anchor.text()
    const ems = $(this).find('em:not([rel])')
    const region = ems.eq(1).text().trim()
    const dept = ems.eq(2).text().trim()
    const date = ems.eq(0).text().trim()
    console.log(`[${i+1}] ${title.substring(0,50)} | ${region} | ${dept} | ${date}`)
  })
})().catch(e => console.error('错误:', e.message))
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 12000,
  })

  const $ = cheerio.load(r.data)
  console.log('=== 页面标题:', $('title').text())
  console.log('=== ul 数量:', $('ul').length, '  li 数量:', $('li').length)
  console.log('=== a 数量:', $('a').length)

  const selectors = [
    '.cggg_list li', '.list li', 'table tr', '.notice-list li',
    '#listContent li', '.cgNotice li', '.gg_list li',
    '.notice li', '#content li', '.result li',
  ]
  for (const sel of selectors) {
    const count = $(sel).length
    if (count > 0) {
      console.log('找到:', sel, '共', count, '项')
      console.log('  第一项文本:', $(sel).first().text().trim().substring(0, 120))
    }
  }

  // 输出所有 li 的第一个
  const firstLi = $('li').first()
  console.log('\n=== 第一个 li HTML:', firstLi.html()?.substring(0, 300))

  // 查找包含日期的 li（公告日期格式 2026-xx-xx）
  const datePattern = /\d{4}-\d{2}-\d{2}/
  let count = 0
  $('li').each(function() {
    const text = $(this).text()
    if (datePattern.test(text) && text.length > 20 && count < 5) {
      console.log(`\n=== 公告 li #${count + 1} HTML:\n`, $(this).html()?.substring(0, 600))
      count++
    }
  })

  // 找 JS 中的 API 调用
  const scripts = $('script').map(function() { return $(this).html() }).get().join('\n')
  const apiMatch = scripts.match(/api[^'"]*|\/cggg[^'"]+|ajax[^'"]+/gi)
  if (apiMatch) console.log('\n=== JS 中发现的 API 路径:', apiMatch.slice(0, 10))
})().catch(e => console.error('错误:', e.message))
