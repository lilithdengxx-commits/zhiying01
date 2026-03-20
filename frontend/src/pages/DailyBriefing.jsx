import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Tag, Typography, Select, Button, Space, Divider,
  Statistic, List, Alert, Tabs, Input, Badge, Progress, message, Spin,
} from 'antd'
import {
  FileTextOutlined, SendOutlined, SearchOutlined, BarChartOutlined,
  ClockCircleOutlined, RiseOutlined, FireOutlined, CheckCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getBriefings } from '../api'

const { Title, Text, Paragraph } = Typography

const scoreColor = s => s >= 80 ? '#52c41a' : s >= 60 ? '#fa8c16' : '#f5222d'
const scoreBg = s => s >= 80 ? '#f6ffed' : s >= 60 ? '#fff7e6' : '#fff2f0'
const TYPE_COLORS = {
  '招采动作': 'blue', '政策驱动': 'green', '二次商机': 'purple',
  '友商分包': 'orange', '人事异动': 'cyan', '预算专项': 'gold',
  '展会活动': 'magenta', '手工录入': 'default',
}

function BriefingReport({ briefing }) {
  if (!briefing) return null
  const convRate = Math.round((briefing.conversionStats.converted / briefing.conversionStats.pushed) * 100)

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
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>高分≥80</Text>
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
        <Text strong style={{ fontSize: 13, color: '#444' }}>📋 今日高优先级线索（AI评分 ≥ 70分）</Text>
        <Divider style={{ margin: '10px 0' }} />

        {briefing.highlights.map((h, i) => (
          <div
            key={h.id}
            style={{
              padding: '12px 14px',
              background: scoreBg(h.score),
              borderRadius: 8,
              marginBottom: 10,
              borderLeft: `3px solid ${scoreColor(h.score)}`,
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
    getBriefings().then(r => {
      setBriefings(r.data)
      setSelectedDate(r.data[0]?.date)
      setLoading(false)
    })
  }, [])

  const currentBriefing = briefings.find(b => b.date === selectedDate)

  const filteredBriefings = briefings.filter(b => {
    if (!searchKw) return true
    return b.date.includes(searchKw) ||
      b.highlights.some(h => h.title.includes(searchKw) || h.type.includes(searchKw))
  })

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>

  const totalConvRate = briefings.length
    ? Math.round(briefings.reduce((s, b) => s + b.conversionStats.converted / b.conversionStats.pushed, 0) / briefings.length * 100)
    : 0

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
              <BriefingReport briefing={briefings[0]} />
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
                  <Statistic title="推送总量" value={briefings.reduce((s, b) => s + b.conversionStats.pushed, 0)} valueStyle={{ fontSize: 20, color: '#1677ff' }} />
                </Col>
                <Col span={8}>
                  <Statistic title="认领率" value={`${Math.round(briefings.reduce((s, b) => s + b.conversionStats.claimed / b.conversionStats.pushed, 0) / briefings.length * 100)}%`} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
                </Col>
                <Col span={8}>
                  <Statistic title="转化率" value={`${totalConvRate}%`} valueStyle={{ fontSize: 20, color: '#fa8c16' }} />
                </Col>
              </Row>
              <div style={{ marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>近7日转化漏斗</Text>
              </div>
              {[
                { label: '推送线索', value: briefings.reduce((s, b) => s + b.conversionStats.pushed, 0), max: null, color: '#1677ff' },
                { label: '销售认领', value: briefings.reduce((s, b) => s + b.conversionStats.claimed, 0), max: briefings.reduce((s, b) => s + b.conversionStats.pushed, 0), color: '#52c41a' },
                { label: '转为立项', value: briefings.reduce((s, b) => s + b.conversionStats.converted, 0), max: briefings.reduce((s, b) => s + b.conversionStats.pushed, 0), color: '#fa8c16' },
              ].map(r => {
                const pct = r.max ? Math.round(r.value / r.max * 100) : 100
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
                <BriefingReport briefing={currentBriefing} />
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
              title="📈 近7日情报推送与转化趋势"
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
                { title: '7日累计推送', value: briefings.reduce((s, b) => s + b.conversionStats.pushed, 0), suffix: '条', color: '#1677ff' },
                { title: '销售认领率', value: `${Math.round(briefings.reduce((s, b) => s + b.conversionStats.claimed / b.conversionStats.pushed, 0) / briefings.length * 100)}%`, suffix: '', color: '#52c41a' },
                { title: '线索转化率', value: `${totalConvRate}%`, suffix: '', color: '#fa8c16' },
                { title: '待挖掘潜值', value: briefings.reduce((s, b) => s + (b.conversionStats.pushed - b.conversionStats.converted), 0), suffix: '条', color: '#722ed1' },
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
