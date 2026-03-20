import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Table, Tag, Typography, Select, Input, Button, Space,
  Drawer, Divider, Progress, Alert, message, Badge, Tooltip, Tabs,
} from 'antd'
import {
  SearchOutlined, FilterOutlined, ExportOutlined, ArrowRightOutlined,
  FireOutlined, PhoneOutlined, FileDoneOutlined, CloseCircleOutlined,
  InfoCircleOutlined, BulbOutlined,
} from '@ant-design/icons'
import { getLeads, updateLeadStatus } from '../api'

const { Title, Text, Paragraph } = Typography

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'bidding', label: '招采动作' },
  { value: 'policy', label: '政策驱动' },
  { value: 'renewal', label: '二次商机' },
  { value: 'subcontract', label: '友商分包' },
  { value: 'personnel', label: '人事异动' },
  { value: 'budget', label: '预算专项' },
  { value: 'exhibition', label: '展会活动' },
  { value: 'manual', label: '手工录入' },
]

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待跟进' },
  { value: 'contacting', label: '接触中' },
  { value: 'filed', label: '已立项' },
  { value: 'closed', label: '无效关闭' },
]

const SCORE_OPTIONS = [
  { value: '', label: '全部评分' },
  { value: '80', label: '≥80 高分' },
  { value: '60', label: '≥60 中分' },
]

const scoreColor = s => s >= 80 ? '#52c41a' : s >= 60 ? '#fa8c16' : '#f5222d'
const scoreBg = s => s >= 80 ? '#f6ffed' : s >= 60 ? '#fff7e6' : '#fff2f0'

const statusMap = {
  pending: { color: 'default', name: '待跟进' },
  contacting: { color: 'blue', name: '接触中' },
  filed: { color: 'green', name: '已立项' },
  closed: { color: 'red', name: '无效关闭' },
}

function ScoreBadge({ score }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: scoreBg(score), border: `2px solid ${scoreColor(score)}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Text strong style={{ color: scoreColor(score), fontSize: 14 }}>{score}</Text>
    </div>
  )
}

function LeadDetailDrawer({ lead, onClose, onStatusChange }) {
  if (!lead) return null

  const handleStatus = async (status) => {
    await updateLeadStatus(lead.id, status)
    onStatusChange(lead.id, status)
    message.success('状态已更新')
  }

  return (
    <Drawer open={!!lead} onClose={onClose} title="线索详情" width={560} extra={
      <Tag color={lead.typeColor}>{lead.typeName}</Tag>
    }>
      {/* 评分板块 */}
      <Card style={{ background: scoreBg(lead.score), border: 'none', marginBottom: 16, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor(lead.score), lineHeight: 1 }}>{lead.score}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>AI综合评分</Text>
          </div>
          <div style={{ flex: 1 }}>
            <Text strong>📊 评分理由</Text>
            <Paragraph style={{ margin: '6px 0 0', fontSize: 13, color: '#555' }}>{lead.scoreReason}</Paragraph>
          </div>
        </div>
      </Card>

      {/* 基本信息 */}
      <Title level={5} style={{ margin: '0 0 8px' }}>{lead.title}</Title>
      <Paragraph style={{ color: '#555', fontSize: 13 }}>{lead.summary}</Paragraph>

      <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        {[
          { label: '来源', value: lead.source },
          { label: '地区', value: `${lead.region} · ${lead.city}` },
          { label: '部门', value: lead.department },
          { label: '预算', value: lead.budget ? `约 ${lead.budget} 万元` : '暂未确认' },
          { label: '截止日期', value: lead.deadline || '暂无' },
          { label: '发现时间', value: lead.createdAt },
          ...(lead.contact ? [{ label: '对接联系人', value: `${lead.contact}（${lead.contactRole}）` }] : []),
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Text type="secondary" style={{ width: 80, flexShrink: 0, fontSize: 12 }}>{r.label}</Text>
            <Text style={{ fontSize: 13 }}>{r.value}</Text>
          </div>
        ))}
      </div>

      {/* 标签 */}
      <div style={{ marginBottom: 16 }}>
        {lead.tags?.map(t => <Tag key={t} style={{ marginBottom: 4 }}>{t}</Tag>)}
      </div>

      {/* AI建议动作 */}
      <Alert
        icon={<BulbOutlined />}
        showIcon
        type="info"
        message="AI建议下一步动作"
        description={lead.nextAction}
        style={{ marginBottom: 20 }}
      />

      <Divider>状态操作</Divider>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button icon={<PhoneOutlined />} type="primary" onClick={() => handleStatus('contacting')}>标记"接触中"</Button>
        <Button icon={<FileDoneOutlined />} onClick={() => handleStatus('filed')} style={{ borderColor: '#52c41a', color: '#52c41a' }}>转入立项</Button>
        <Button icon={<ExportOutlined />} onClick={() => message.success('已推送到CRM系统')}>同步至CRM</Button>
        <Button icon={<CloseCircleOutlined />} danger onClick={() => handleStatus('closed')}>无效关闭</Button>
      </div>
    </Drawer>
  )
}

export default function LeadPool() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ type: '', status: '', minScore: '', keyword: '' })
  const [selectedLead, setSelectedLead] = useState(null)

  const fetchLeads = async (f = filters) => {
    setLoading(true)
    const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
    const { data } = await getLeads(clean)
    setLeads(data)
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  const handleFilter = (key, val) => {
    const next = { ...filters, [key]: val }
    setFilters(next)
    fetchLeads(next)
  }

  const handleStatusChange = (id, status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status }))
  }

  const columns = [
    {
      title: '评分', dataIndex: 'score', key: 'score', width: 70, sorter: (a, b) => b.score - a.score,
      defaultSortOrder: 'ascend',
      render: s => <ScoreBadge score={s} />,
    },
    {
      title: '线索标题', dataIndex: 'title', key: 'title',
      render: (text, row) => (
        <div>
          <Text strong style={{ fontSize: 13, cursor: 'pointer', color: '#1677ff' }} onClick={() => setSelectedLead(row)}>
            {text}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Tag color={row.typeColor} style={{ fontSize: 11 }}>{row.typeName}</Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>· {row.city}</Text>
            {row.budget && <Text type="secondary" style={{ fontSize: 11 }}> · 约{row.budget}万</Text>}
          </div>
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.name}</Tag>,
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 200,
      render: tags => (
        <div>
          {tags?.slice(0, 3).map(t => <Tag key={t} style={{ marginBottom: 2, fontSize: 11 }}>{t}</Tag>)}
        </div>
      ),
    },
    {
      title: '发现日期', dataIndex: 'createdAt', key: 'createdAt', width: 100,
      render: d => <Text type="secondary" style={{ fontSize: 12 }}>{d}</Text>,
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setSelectedLead(row)}>
          详情 <ArrowRightOutlined />
        </Button>
      ),
    },
  ]

  const highCount = leads.filter(l => l.score >= 80).length
  const pendingCount = leads.filter(l => l.status === 'pending').length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>🧠 智能线索池</Title>
          <Text type="secondary">AI自动采集、打分、分类 · 全网情报转化为标准化销售资产</Text>
        </div>
        <Space>
          <Badge count={pendingCount} size="small">
            <Button type="primary" ghost icon={<FireOutlined />}>待认领 {pendingCount} 条</Button>
          </Badge>
        </Space>
      </div>

      {/* 统计行 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: '线索总量', value: leads.length, color: '#1677ff' },
          { label: '高分(≥80)', value: highCount, color: '#f5222d' },
          { label: '待跟进', value: pendingCount, color: '#fa8c16' },
          { label: '跟进中', value: leads.filter(l => l.status === 'contacting').length, color: '#52c41a' },
          { label: '已立项', value: leads.filter(l => l.status === 'filed').length, color: '#722ed1' },
        ].map(s => (
          <Col flex="1" key={s.label}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 过滤工具栏 */}
      <Card style={{ marginBottom: 16, borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={12} align="middle">
          <Col flex="1">
            <Input
              placeholder="搜索线索标题或关键词..."
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={e => handleFilter('keyword', e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              style={{ width: 130 }} options={TYPE_OPTIONS} value={filters.type}
              onChange={v => handleFilter('type', v)} placeholder="线索类型"
            />
          </Col>
          <Col>
            <Select
              style={{ width: 120 }} options={STATUS_OPTIONS} value={filters.status}
              onChange={v => handleFilter('status', v)} placeholder="跟进状态"
            />
          </Col>
          <Col>
            <Select
              style={{ width: 110 }} options={SCORE_OPTIONS} value={filters.minScore}
              onChange={v => handleFilter('minScore', v)} placeholder="最低评分"
            />
          </Col>
          <Col>
            <Button onClick={() => { setFilters({ type: '', status: '', minScore: '', keyword: '' }); fetchLeads({ type: '', status: '', minScore: '', keyword: '' }) }}>
              重置
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 线索表格 */}
      <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={leads}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条线索` }}
          onRow={row => ({ onDoubleClick: () => setSelectedLead(row), style: { cursor: 'pointer' } })}
          size="middle"
        />
      </Card>

      {/* 线索详情抽屉 */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
