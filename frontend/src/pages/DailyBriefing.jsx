import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Tag, Typography, Select, Button, Space, Divider,
  Statistic, List, Alert, Tabs, Input, Badge, Progress, message, Spin, Dropdown,
} from 'antd'
import {
  FileTextOutlined, SendOutlined, SearchOutlined, BarChartOutlined,
  ClockCircleOutlined, RiseOutlined, FireOutlined, CheckCircleOutlined,
  ArrowRightOutlined, DownloadOutlined, DownOutlined,
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getBriefings } from '../api'

const { Title, Text, Paragraph } = Typography

const scoreColor = s => s >= 70 ? '#52c41a' : s >= 60 ? '#fa8c16' : '#f5222d'
const scoreBg = s => s >= 70 ? '#f6ffed' : s >= 60 ? '#fff7e6' : '#fff2f0'
const TYPE_COLORS = {
  '招采动作': 'blue', '政策驱动': 'green', '二次商机': 'purple',
  '友商分包': 'orange', '人事异动': 'cyan', '预算专项': 'gold',
  '展会活动': 'magenta', '手工录入': 'default',
}

// 假数据兔底高亮显示（真实线索 < 5 时剭至 5 条）
const MOCK_FALLBACK_HIGHLIGHTS = [
  { id: 'MOCK001', title: '某省大数据发展局智慧政务平台建设项目（采购意向公示）', score: 73, type: '招采动作', region: '华东区', nextAction: '建议24小时内核实采购经办人信息，提前递送DIOS平台方案资料' },
  { id: 'MOCK002', title: '国家发改委《“十五五”数字基础设施装备规划》印发（大数据中心第二期）', score: 70, type: '政策驱动', region: '全国', nextAction: '提炼政策卖点，本周内更新DIOS平台适配材料并分发战区经理' },
  { id: 'MOCK003', title: '某市融媒体中心AI内容生产平台招标（预算800万）', score: 68, type: '招采动作', region: '华南区', nextAction: '华南区经理跟进，本月内完成调研走访' },
  { id: 'MOCK004', title: '某居先间咪山区公安分局大数据实战平台升级改造', score: 65, type: '招采动作', region: '华北区', nextAction: '进入线索培育池，每月跟进采购进度' },
  { id: 'MOCK005', title: '工信部《2026年数字经济专项资金申报指南》发布（A类资池治理方向）', score: 62, type: '政策驱动', region: '全国', nextAction: '关注A类资池申报窗口，挑选目标客户进行项目医合' },
]

// 导出 PDF
function exportToPDF(briefing) {
  if (!briefing) return message.warning('暂无简报数据可导出')
  const highlights = briefing.highlights || []
  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>智鹰ToG商机日报 ${briefing.date}</title>
    <style>
      body{font-family:'Microsoft YaHei',Arial,sans-serif;margin:30px;color:#333;font-size:13px;}
      h1{color:#001529;border-bottom:3px solid #1677ff;padding-bottom:10px;margin-bottom:20px;}
      h2{color:#1677ff;margin:20px 0 10px;}
      .header-stats{display:flex;gap:30px;margin:15px 0;padding:15px;background:#f8fbff;border-radius:8px;}
      .stat{text-align:center;} .stat .num{font-size:28px;font-weight:bold;color:#1677ff;display:block;}
      .stat.high .num{color:#f5a623;} .stat.med .num{color:#52c41a;}
      .lead-item{border-left:4px solid #1677ff;padding:12px 16px;margin:8px 0;background:#f8fbff;border-radius:0 8px 8px 0;}
      .lead-item.high{border-color:#52c41a;background:#f6ffed;} .lead-item.mock{border-color:#d9d9d9;background:#fafafa;opacity:0.8;}
      .score{display:inline-block;width:34px;height:34px;border-radius:50%;background:#1677ff;color:white;text-align:center;line-height:34px;font-weight:bold;font-size:12px;margin-right:10px;}
      .score.high{background:#52c41a;} .action{color:#1677ff;font-style:italic;font-size:12px;margin-top:6px;}
      .footer{margin-top:30px;padding-top:15px;border-top:1px solid #eee;color:#999;font-size:11px;text-align:center;}
      @media print{body{margin:15px;} .no-print{display:none;}}
    </style>
  </head><body>
    <h1>👅 智鹰ToG商机日报</h1>
    <p>日期：<strong>${briefing.date}</strong> &nbsp;&nbsp; 系统自动生成 &nbsp;&nbsp; 已推送至：${(briefing.sentChannels || []).join('、')}</p>
    <div class="header-stats">
      <div class="stat"><span class="num">${briefing.stats.total}</span>总线索</div>
      <div class="stat high"><span class="num">${briefing.stats.high}</span>高分≥⁰</div>
      <div class="stat med"><span class="num">${briefing.stats.medium}</span>中分</div>
    </div>
    <h2>📋 今日高优先级线索</h2>
    ${highlights.map((h, i) => `
      <div class="lead-item ${h.score >= 70 ? 'high' : ''} ${h.isMock ? 'mock' : ''}">
        <div style="display:flex;align-items:center;">
          <span class="score ${h.score >= 70 ? 'high' : ''}">${h.score}</span>
          <strong>[${String(i + 1).padStart(2, '0')}] ${h.title}${h.isMock ? ' (参考数据)' : ''}</strong>
        </div>
        <div style="margin-top:6px;color:#666;">类型：${h.type || '-'} &nbsp; 地区：${h.region || '全国'}</div>
        <div class="action">💡 建议动作：${h.nextAction || '-'}</div>
      </div>`).join('')}
    <div class="footer">智鹰ToG商机智能系统 · 中科闻歌 &copy; ${new Date().getFullYear()}</div>
  </body></html>`
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { message.error('请允许弹出窗口后重试'); return }
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 800)
}

// 导出 Word
function exportToWord(briefing) {
  if (!briefing) return message.warning('暂无简报数据可导出')
  const highlights = briefing.highlights || []
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'>
  <title>智鹰商机日报 ${briefing.date}</title>
  <style>
    body{font-family:'Microsoft YaHei',SimSun,serif;margin:2cm;color:#333;font-size:12pt;}
    h1{color:#001529;font-size:18pt;border-bottom:1px solid #1677ff;}
    h2{color:#1677ff;font-size:14pt;margin-top:16pt;}
    p{line-height:1.6;}
    .stat-row{margin:10pt 0;}
    .lead-box{border-left:4pt solid #1677ff;padding:8pt 12pt;margin:8pt 0;background:#f8fbff;}
    .lead-box.high{border-color:#52c41a;background:#f6ffed;}
    .score{font-weight:bold;color:#1677ff;font-size:14pt;}
    .score.high{color:#52c41a;}
  </style></head><body>
  <h1>👅 智鹰ToG商机日报</h1>
  <p><b>日期：</b>${briefing.date} &nbsp;&nbsp; <b>推送渠道：</b>${(briefing.sentChannels || []).join('、')}</p>
  <div class="stat-row">总线索：<b>${briefing.stats.total}</b>条 &nbsp;&nbsp; 高分(≥70)：<b>${briefing.stats.high}</b>条 &nbsp;&nbsp; 中分：<b>${briefing.stats.medium}</b>条</div>
  <h2>📋 今日高优先级线索</h2>
  ${highlights.map((h, i) => `
    <div class="lead-box ${h.score >= 70 ? 'high' : ''}">
      <p><span class="score ${h.score >= 70 ? 'high' : ''}">${h.score}分</span> &nbsp; <b>[${String(i + 1).padStart(2, '0')}] ${h.title}${h.isMock ? '（参考）' : ''}</b></p>
      <p>类型：${h.type || '-'} | 地区：${h.region || '全国'}</p>
      <p><i>💡 建议动作：${h.nextAction || '-'}</i></p>
    </div>`).join('')}
  <p style="margin-top:20pt;color:#999;font-size:10pt;text-align:center;">智鹰ToG商机智能系统 · 中科闻歌</p>
  </body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `智鹰商机日报_${briefing.date}.doc`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  message.success(`已导出Word文件：智鹰商机日报_${briefing.date}.doc`)
}

function BriefingReport({ briefing, isTodayBriefing = false }) {
  if (!briefing) return null
  const highlights = briefing.highlights || []
  // 真实线索 < 5 时用假数据兔底
  const displayHighlights = highlights.length >= 5
    ? highlights
    : [...highlights, ...MOCK_FALLBACK_HIGHLIGHTS.slice(0, 5 - highlights.length).map(h => ({ ...h, isMock: true }))]

  const totalCount = displayHighlights.filter(h => !h.isMock).length || highlights.length || 0
  const pushed = briefing.conversionStats?.pushed || 0
  const avgScore = totalCount ? Math.round(highlights.reduce((s, h) => s + (h.score || 0), 0) / Math.max(highlights.length, 1)) : 0
  const highCount = highlights.filter(h => (h.score || 0) >= 70).length
  const typeCounter = highlights.reduce((acc, h) => {
    const key = h.type || '其他'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const topTypes = Object.entries(typeCounter)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => `${k}${v}条`).join('、')
  const regionCounter = highlights.reduce((acc, h) => {
    const key = h.region || '全国'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const topRegions = Object.entries(regionCounter)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => `${k}${v}条`).join('、')

  // 生成不同语气的行动建议
  const actionAdvice = highCount >= 5
    ? '建议立即建立A类攻坚清单，优先推进高分线索的一对一拜访与方案递交，48小时内完成负责人认领。'
    : highCount >= 2
    ? '建议尽快安排高分项目吃饯或技方预沟通，将中分线索转入持续培育池，按战区建立分层跟进节奏。'
    : '建议优先完成核心部门需求确认，将已识别线索按产品匹配度分类，提升后续研判质量。'

  return (
    <div>
      {/* 简报头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #001529 0%, #003a70 100%)',
        borderRadius: '12px 12px 0 0',
        padding: '20px 24px',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20 }}>🦅</div>
            <Title level={4} style={{ color: '#fff', margin: '4px 0' }}>ToG商机日报</Title>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{briefing.date} · 系统自动生成</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{briefing.stats.total}</div>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>总线索</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f5a623' }}>{briefing.stats.high}</div>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>高分≥70</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{briefing.stats.medium}</div>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>中分</Text>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {briefing.sentChannels.map(c => (
                <Tag key={c} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 11 }}>
                  ✓ 已推送至{c}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 简报内容 */}
      <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', padding: '16px 20px' }}>
        <Paragraph style={{
          marginBottom: 10,
          padding: '10px 12px',
          background: '#f8fbff',
          border: '1px solid #e6f4ff',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.75,
        }}>
          <Text strong>今日线索概述：</Text>
          {totalCount > 0
            ? `今日展示高优线索 ${totalCount} 条，平均评分 ${avgScore} 分；其中高分（≥70分）${highCount} 条需优先跟进。线索类型以${topTypes || '蚂薗吊夜'}为主${topRegions && topRegions !== '全国1条' ? '，区域分布翁盖' + topRegions : ''}。${actionAdvice}`
            : '当前日期尚无实时截取的匹配线索，以下点位为坫近期商机拆解参考，建议业务团队结合自身业务范围判断关注水平。'
          }
        </Paragraph>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13, color: '#444' }}>📋 今日高优先级线索（AI评分 ≥ 60分）</Text>
          {isTodayBriefing && (
            <Dropdown menu={{
              items: [
                { key: 'pdf', label: '📄 导出 PDF', onClick: () => exportToPDF(briefing) },
                { key: 'word', label: '📝 导出 Word', onClick: () => exportToWord(briefing) },
              ]
            }}>
              <Button size="small" icon={<DownloadOutlined />}>导出 <DownOutlined /></Button>
            </Dropdown>
          )}
        </div>

        <Divider style={{ margin: '8px 0' }} />
        {displayHighlights.map((h, i) => (
          <div
            key={h.id}
            style={{
              padding: '12px 14px',
              background: h.isMock ? '#fafafa' : scoreBg(h.score),
              borderRadius: 8,
              marginBottom: 10,
              borderLeft: `3px solid ${h.isMock ? '#d9d9d9' : scoreColor(h.score)}`,
              opacity: h.isMock ? 0.85 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: scoreColor(h.score), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 13,
              }}>
                {h.score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>【{String(i + 1).padStart(2, '0')}】{h.title}</Text>
                    {h.isMock && <Tag color="default" style={{ fontSize: 10, margin: '0 0 0 4px' }}>参考</Tag>}
                </div>
                <Space size={4}>
                  <Tag color={TYPE_COLORS[h.type]} style={{ fontSize: 11, margin: 0 }}>{h.type}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>{h.region}</Text>
                </Space>
                <div style={{ marginTop: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.7)', borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, color: '#1677ff' }}>
                    💡 建议动作：{h.nextAction}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConversionChart({ briefings }) {
  const chartData = briefings.map(b => ({
    date: b.date.slice(5),
    推送: b.conversionStats.pushed,
    认领: b.conversionStats.claimed,
    转化: b.conversionStats.converted,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="推送" fill="#1677ff" radius={[3, 3, 0, 0]} />
        <Bar dataKey="认领" fill="#52c41a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="转化" fill="#fa8c16" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function DailyBriefing() {
  const [briefings, setBriefings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [searchKw, setSearchKw] = useState('')
  const [activeTab, setActiveTab] = useState('today')

  useEffect(() => {
    getBriefings()
      .then(r => { setBriefings(r.data || []); setSelectedDate(r.data?.[0]?.date); setLoading(false) })
      .catch(e => { console.error('[DailyBriefing] fetch failed:', e); setBriefings([]); setLoading(false) })
  }, [])

  const currentBriefing = briefings.find(b => b.date === selectedDate)

  const sortHighlights = (briefing) => {
    if (!briefing) return briefing
    const sorted = [...(briefing.highlights || [])]
    sorted.sort((a, b) => b.score - a.score)
    return { ...briefing, highlights: sorted }
  }

  const filteredBriefings = briefings.filter(b => {
    if (!searchKw) return true
    return b.date.includes(searchKw) ||
      b.highlights.some(h => h.title.includes(searchKw) || h.type.includes(searchKw))
  })

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>

  // 安全除法，避免分母为0时出现 NaN
  const safeDiv = (a, b) => (b > 0 ? a / b : 0)
  const totalPushed = briefings.reduce((s, b) => s + (b.conversionStats?.pushed || 0), 0)
  const totalClaimed = briefings.reduce((s, b) => s + (b.conversionStats?.claimed || 0), 0)
  const totalConverted = briefings.reduce((s, b) => s + (b.conversionStats?.converted || 0), 0)
  const claimRate = totalPushed > 0 ? Math.round(totalClaimed / totalPushed * 100) : 0
  const totalConvRate = totalPushed > 0 ? Math.round(totalConverted / totalPushed * 100) : 0

  const tabItems = [
    {
      key: 'today',
      label: <span><FireOutlined style={{ color: '#f5222d' }} /> 今日简报</span>,
      children: (
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card
              style={{ borderRadius: 10 }}
              bodyStyle={{ padding: 0 }}
              title={null}
            >
              <BriefingReport briefing={sortHighlights(briefings[0])} isTodayBriefing={true} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title="⚙️ 推送配置"
              style={{ borderRadius: 10, marginBottom: 16 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>推送渠道</Text>
                {[
                  { name: '飞书', active: true, note: '张三 / 华南区群' },
                  { name: '企业微信', active: true, note: '华南区销售群' },
                  { name: '钉钉', active: false, note: '未配置' },
                  { name: '邮件', active: false, note: '未配置' },
                ].map(c => (
                  <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <Space>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.active ? '#52c41a' : '#d9d9d9' }} />
                      <Text style={{ fontSize: 13 }}>{c.name}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11 }}>{c.note}</Text>
                  </div>
                ))}
                <Button type="dashed" size="small" block style={{ marginTop: 10 }}
                  onClick={() => message.info('推送配置功能开发中')}>
                  + 添加推送渠道
                </Button>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>推送规则</Text>
              <Alert
                style={{ marginTop: 6, borderRadius: 6 }}
                type="info"
                message={<Text style={{ fontSize: 11 }}>每日 08:00 自动推送 · 仅推送评分 ≥ 70 分线索 · 按战区标签过滤</Text>}
              />
            </Card>
            <Card
              title="📊 情报转化效能看板"
              style={{ borderRadius: 10 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Row gutter={8} style={{ marginBottom: 12 }}>
                <Col span={8}>
                  <Statistic title="推送总量" value={totalPushed} valueStyle={{ fontSize: 20, color: '#1677ff' }} />
                </Col>
                <Col span={8}>
                  <Statistic title="认领率" value={`${claimRate}%`} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
                </Col>
                <Col span={8}>
                  <Statistic title="转化率" value={`${totalConvRate}%`} valueStyle={{ fontSize: 20, color: '#fa8c16' }} />
                </Col>
              </Row>
              <div style={{ marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{`近${briefings.length}日转化漏斗`}</Text>
              </div>
              {[
                { label: '推送线索', value: totalPushed, max: null, color: '#1677ff' },
                { label: '销售认领', value: totalClaimed, max: totalPushed, color: '#52c41a' },
                { label: '转为立项', value: totalConverted, max: totalPushed, color: '#fa8c16' },
              ].map(r => {
                const pct = r.max > 0 ? Math.round(r.value / r.max * 100) : (r.max === null ? 100 : 0)
                return (
                  <div key={r.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11 }}>{r.label}</Text>
                      <Text style={{ fontSize: 11, color: r.color }}>{r.value} 条</Text>
                    </div>
                    <Progress percent={pct} showInfo={false} strokeColor={r.color} size="small" />
                  </div>
                )
              })}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'archive',
      label: <span><ClockCircleOutlined /> 历史档案</span>,
      children: (
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Card
              title="📅 简报归档"
              style={{ borderRadius: 10 }}
              bodyStyle={{ padding: 0 }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <Input
                  placeholder="搜索日期或关键词..."
                  prefix={<SearchOutlined />}
                  value={searchKw}
                  onChange={e => setSearchKw(e.target.value)}
                  allowClear
                  size="small"
                />
              </div>
              <List
                dataSource={filteredBriefings}
                renderItem={b => (
                  <List.Item
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      background: selectedDate === b.date ? '#e6f4ff' : 'transparent',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                    onClick={() => { setSelectedDate(b.date); setActiveTab('preview') }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong style={{ fontSize: 13 }}>{b.date}</Text>
                        <div>
                          <Tag color="blue" style={{ fontSize: 11 }}>高分 {b.stats.high} 条</Tag>
                        </div>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>共推送 {b.stats.total} 条线索</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} md={16}>
            {currentBriefing ? (
              <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
                <BriefingReport briefing={sortHighlights(currentBriefing)} />
              </Card>
            ) : (
              <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                <div style={{ padding: 60 }}>
                  <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 12 }} />
                  <Text type="secondary">点击左侧日期查看历史简报</Text>
                </div>
              </Card>
            )}
          </Col>
        </Row>
      ),
    },
    {
      key: 'stats',
      label: <span><BarChartOutlined /> 转化趋势</span>,
      children: (
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card
              title={`📈 近${briefings.length}日情报推送与转化趋势`}
              style={{ borderRadius: 10 }}
            >
              <ConversionChart briefings={briefings} />
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                {[
                  { label: '推送总量', color: '#1677ff' },
                  { label: '销售认领', color: '#52c41a' },
                  { label: '转为立项', color: '#fa8c16' },
                ].map(l => (
                  <Space key={l.label}>
                    <div style={{ width: 12, height: 12, background: l.color, borderRadius: 2 }} />
                    <Text style={{ fontSize: 12 }}>{l.label}</Text>
                  </Space>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="📊 效能汇总" style={{ borderRadius: 10 }}>
              {[
                { title: `近${briefings.length}日累计推送`, value: totalPushed, suffix: '条', color: '#1677ff' },
                { title: '销售认领率', value: `${claimRate}%`, suffix: '', color: '#52c41a' },
                { title: '线索转化率', value: `${totalConvRate}%`, suffix: '', color: '#fa8c16' },
                { title: '待挖掘潜值', value: totalPushed - totalConverted, suffix: '条', color: '#722ed1' },
              ].map(s => (
                <div key={s.title} style={{ padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>{s.title}</Text>
                    <Text strong style={{ fontSize: 18, color: s.color }}>{s.value}{s.suffix}</Text>
                  </div>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>📰 每日线索简报</Title>
          <Text type="secondary">每日核心情报聚合中心 · 支持历史溯源与转化效能追踪</Text>
        </div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => message.success('今日简报已手动触发推送至飞书和企业微信')}
        >
          立即推送今日简报
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />
    </div>
  )
}
