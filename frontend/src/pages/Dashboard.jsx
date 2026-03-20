import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Tag, Typography, Alert, Timeline, Button, List, Badge, Progress, Spin, Space } from 'antd'
import {
  RiseOutlined, FireOutlined, ClockCircleOutlined, TrophyOutlined,
  ArrowRightOutlined, BellOutlined, CalendarOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getDashboardStats, getTodos } from '../api'

const { Title, Text, Paragraph } = Typography

const FUNNEL_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d']

// 分数色
const scoreColor = s => s >= 80 ? '#52c41a' : s >= 60 ? '#fa8c16' : '#f5222d'
const scoreText = s => s >= 80 ? '高分' : s >= 60 ? '中分' : '低分'

// 简单漏斗可视化
function FunnelViz({ data }) {
  const max = data[0]?.value || 1
  return (
    <div style={{ padding: '8px 0' }}>
      {data.map((item, i) => {
        const width = Math.round((item.value / max) * 100)
        return (
          <div key={item.name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13 }}>{item.name}</Text>
              <Text strong style={{ color: item.fill }}>{item.value} 个</Text>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 4, height: 24, overflow: 'hidden' }}>
              <div style={{
                width: `${width}%`, height: '100%', background: item.fill,
                borderRadius: 4, transition: 'width 0.8s ease',
                display: 'flex', alignItems: 'center', paddingLeft: 8,
              }}>
                {width > 25 && <Text style={{ color: '#fff', fontSize: 12 }}>{width}%</Text>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(), getTodos()]).then(([s, t]) => {
      setStats(s); setTodos(t); setLoading(false)
    })
  }, [])

  // 今日顶级线索（从 mockData 直接取以便展示评分）
  const topLeads = [
    { id: 'L001', title: '广州市政务数据局大数据治理平台', score: 94, type: '招采动作', typeColor: 'blue', city: '广州市' },
    { id: 'L003', title: '深圳南山区政务云平台二期扩容', score: 91, type: '二次商机', typeColor: 'purple', city: '深圳市' },
    { id: 'L005', title: '山东省数据要素市场化交易平台', score: 88, type: '预算专项', typeColor: 'gold', city: '济南市' },
  ]

  const todaySchedule = [
    { time: '09:30', event: '电话-确认广州局采购处王处长拜访时间', type: 'call' },
    { time: '14:00', event: '视频会议-福建省大数据局技术需求预沟通', type: 'meeting' },
    { time: '16:30', event: '内审-南山区二期方案建议书初稿评审', type: 'review' },
    { time: '全天', event: '关注：中国数字政府大会（北京）直播', type: 'event' },
  ]

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>🦅 工作台</Title>
        <Text type="secondary">今日作战全局概览 · 2026年3月21日</Text>
      </div>

      {/* 紧急提醒横幅 */}
      <Alert
        type="warning"
        showIcon
        icon={<FireOutlined style={{ color: '#f5222d' }} />}
        message={<Text strong style={{ color: '#d46b08' }}>⚡ 今日紧急：广州市政务数据局采购意向公示，招标窗口期仅剩 <Text style={{ color: '#f5222d' }} strong>14天</Text>，请立即安排接触！</Text>}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {/* 核心指标卡 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: '线索总量', value: stats.totalLeads, suffix: '条', icon: <BellOutlined />, color: '#1677ff', trend: '+3 今日新增' },
          { title: '高分线索(≥80)', value: stats.highPriority, suffix: '条', icon: <FireOutlined />, color: '#f5222d', trend: '需优先跟进' },
          { title: '接触跟进中', value: stats.contacting, suffix: '个', icon: <ClockCircleOutlined />, color: '#fa8c16', trend: '销售进行中' },
          { title: '已立项商机', value: stats.filed, suffix: '个', icon: <TrophyOutlined />, color: '#52c41a', trend: '进入招投标' },
        ].map(item => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card hoverable style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>
                  <div style={{ fontSize: 36, fontWeight: 700, color: item.color, lineHeight: 1.2, margin: '6px 0' }}>
                    {item.value}
                    <Text style={{ fontSize: 14, color: '#666', fontWeight: 400, marginLeft: 4 }}>{item.suffix}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.trend}</Text>
                </div>
                <div style={{ fontSize: 28, color: item.color, opacity: 0.15 }}>{item.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 今日高分线索速览 */}
        <Col xs={24} lg={8}>
          <Card
            title={<><RiseOutlined style={{ color: '#1677ff' }} /> 今日高分线索速览</>}
            extra={<Button type="link" size="small" href="/leads">查看全部 <ArrowRightOutlined /></Button>}
            style={{ borderRadius: 10, height: '100%' }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {topLeads.map((lead, i) => (
              <div key={lead.id} style={{
                padding: '12px 0', borderBottom: i < topLeads.length - 1 ? '1px solid #f5f5f5' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: `${scoreColor(lead.score)}18`,
                    border: `2px solid ${scoreColor(lead.score)}`,
                    color: scoreColor(lead.score), fontWeight: 700, fontSize: 13,
                  }}>
                    {lead.score}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{lead.title}</Text>
                    <Space size={4} style={{ marginTop: 2 }}>
                      <Tag color={lead.typeColor} style={{ fontSize: 11, margin: 0, lineHeight: '18px' }}>{lead.type}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>{lead.city}</Text>
                    </Space>
                  </div>
                </div>
              </div>
            ))}
            <Button type="primary" block style={{ marginTop: 8, borderRadius: 6 }} href="/leads">
              进入线索池认领 →
            </Button>
          </Card>
        </Col>

        {/* 待办提醒 */}
        <Col xs={24} lg={8}>
          <Card
            title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 今日待办</>}
            style={{ borderRadius: 10, height: '100%' }}
            bodyStyle={{ padding: '0 16px' }}
          >
            <List
              dataSource={todos}
              renderItem={todo => (
                <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{todo.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12.5, display: 'block', lineHeight: 1.5 }}>{todo.text}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>⏰ {todo.date}</Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 右侧：漏斗 + 今日日程 */}
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 商机漏斗 */}
            <Card
              title="📊 商机漏斗"
              style={{ borderRadius: 10 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <FunnelViz data={stats.funnel} />
            </Card>

            {/* 今日日程 */}
            <Card
              title={<><CalendarOutlined style={{ color: '#722ed1' }} /> 今日日程</>}
              style={{ borderRadius: 10 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Timeline
                items={todaySchedule.map(s => ({
                  dot: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
                  children: (
                    <div>
                      <Text strong style={{ fontSize: 12 }}>{s.time}</Text>
                      <Text style={{ fontSize: 12, marginLeft: 8, color: '#555' }}>{s.event}</Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
