import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Table, Tag, Typography, Input, Select, Button,
  Space, Alert, Tabs, List, Badge, Divider, Drawer, message, Tooltip,
} from 'antd'
import {
  SearchOutlined, EyeOutlined, LinkOutlined, AlertOutlined,
  RiseOutlined, TeamOutlined, BranchesOutlined, WarningOutlined,
} from '@ant-design/icons'
import { getBids, getCompetitors } from '../api'

const { Title, Text, Paragraph } = Typography

const STATUS_COLOR = { intention: 'orange', bidding: 'blue', awarded: 'green', failed: 'red' }
const STATUS_NAMES = { intention: '采购意向', bidding: '招标进行中', awarded: '已成交', failed: '废标/终止' }

function SubcontractAlert({ bids }) {
  const subs = bids.filter(b => b.hasSubcontract)
  if (!subs.length) return null
  return (
    <div style={{ marginBottom: 16 }}>
      {subs.map(b => (
        <Alert
          key={b.id}
          type="success"
          showIcon
          icon={<BranchesOutlined />}
          style={{ marginBottom: 8, borderRadius: 8 }}
          message={
            <Text strong>🎯 分包商机预警：{b.winner} 中标「{b.title}」</Text>
          }
          description={
            <div>
              <Text style={{ fontSize: 12 }}>
                总包金额：{(b.amount / 10000).toFixed(1)}亿元 · 中标方：{b.winner}
              </Text>
              <br />
              <Text style={{ fontSize: 12, color: '#389e0d' }}>
                ⚡ {b.subcontractNote}
              </Text>
              <br />
              <Button type="link" size="small" style={{ padding: 0, marginTop: 4 }}
                onClick={() => message.success('已生成分包线索并推入智能线索池')}>
                → 一键推送至线索池
              </Button>
            </div>
          }
        />
      ))}
    </div>
  )
}

function CompetitorCard({ comp }) {
  return (
    <Card style={{ borderRadius: 10, marginBottom: 12 }} hoverable>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>{comp.name}</Text>
          <br />
          <Tag color="geekblue" style={{ marginTop: 4 }}>{comp.type}</Tag>
        </div>
      </div>
      <Row gutter={12}>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>核心优势</Text>
          {comp.strength.map(s => (
            <Tag key={s} color="green" style={{ marginBottom: 3, fontSize: 11 }}>{s}</Tag>
          ))}
        </Col>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>明显弱点</Text>
          {comp.weakness.map(w => (
            <Tag key={w} color="red" style={{ marginBottom: 3, fontSize: 11 }}>{w}</Tag>
          ))}
        </Col>
      </Row>
      <Divider style={{ margin: '8px 0' }} />
      <Text type="secondary" style={{ fontSize: 11 }}>近期中标：</Text>
      {comp.recentWins.slice(0, 2).map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <Text style={{ fontSize: 12 }} ellipsis>{w.project}</Text>
          <Text style={{ fontSize: 12, color: '#fa8c16', flexShrink: 0, marginLeft: 8 }}>
            {w.amount >= 10000 ? `${(w.amount / 10000).toFixed(1)}亿` : `${w.amount}万`}
          </Text>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>主要势力范围：</Text>
        {comp.coverageRegions.map(r => <Tag key={r} style={{ fontSize: 11, margin: '2px 2px 2px 0' }}>{r}</Tag>)}
      </div>
    </Card>
  )
}

export default function BidRadar() {
  const [bids, setBids] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedBid, setSelectedBid] = useState(null)
  const [activeTab, setActiveTab] = useState('bids')

  useEffect(() => {
    Promise.all([getBids(), getCompetitors()])
      .then(([b, c]) => { setBids(b.data || []); setCompetitors(c.data || []); setLoading(false) })
      .catch(e => { console.error('[BidRadar] fetch failed:', e); setBids([]); setCompetitors([]); setLoading(false) })
  }, [])

  const filteredBids = bids.filter(b => {
    if (statusFilter && b.statusKey !== statusFilter) return false
    if (keyword && !b.title.includes(keyword) && !b.department.includes(keyword)) return false
    return true
  })

  const columns = [
    {
      title: '招采状态', key: 'status', width: 110,
      render: (_, row) => {
        const statusKey = row.statusKey || row.status || 'bidding'
        const name = row.statusName || STATUS_NAMES[statusKey] || statusKey
        return <Badge color={STATUS_COLOR[statusKey] || 'default'} text={name} />
      },
    },
    {
      title: '项目名称', dataIndex: 'title', key: 'title',
      render: (text, row) => (
        <div>
          {row.hasSubcontract && (
            <Tag color="orange" icon={<BranchesOutlined />} style={{ marginBottom: 4, display: 'block', width: 'fit-content' }}>
              ⚡ 含分包机会
            </Tag>
          )}
          <Text
            strong style={{ fontSize: 13, cursor: 'pointer', color: '#1677ff' }}
            onClick={() => setSelectedBid(row)}
          >{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{row.department} · {row.city}</Text>
        </div>
      ),
    },
    {
      title: '预算金额', dataIndex: 'amount', key: 'amount', width: 110,
      sorter: (a, b) => b.amount - a.amount,
      render: v => (
        <Text strong style={{ color: '#fa8c16' }}>
          {v >= 10000 ? `${(v / 10000).toFixed(1)}亿` : `${v}万`}
        </Text>
      ),
    },
    {
      title: '地区', dataIndex: 'region', key: 'region', width: 90,
      render: v => <Tag>{v}</Tag>,
    },
    {
      title: '竞争对手', dataIndex: 'competitors', key: 'competitors', width: 160,
      render: arr => arr?.length ? arr.map(c => <Tag key={c} color="red" style={{ margin: '1px', fontSize: 11 }}>{c}</Tag>) : <Text type="secondary" style={{ fontSize: 11 }}>未知</Text>,
    },
    {
      title: '招标截止', dataIndex: 'deadline', key: 'deadline', width: 100,
      render: d => d ? <Text style={{ fontSize: 12, color: '#f5222d' }}>⏰ {d}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '评标溯源', key: 'trace', width: 80,
      render: (_, row) => row.policyRef ? (
        <Tooltip title="点击查看政策来龙去脉">
          <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => setSelectedBid(row)}>溯源</Button>
        </Tooltip>
      ) : <Text type="secondary" style={{ fontSize: 11 }}>-</Text>,
    },
  ]

  const tabItems = [
    {
      key: 'bids',
      label: <span>📋 招采监控 <Badge count={filteredBids.length} style={{ background: '#1677ff' }} /></span>,
      children: (
        <div>
          <SubcontractAlert bids={bids} />
          <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={filteredBids}
              columns={columns}
              rowKey="id"
              loading={loading}
              size="middle"
              pagination={{ pageSize: 8 }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'competitors',
      label: '🕵️ 友商透视',
      children: (
        <div>
          <Alert
            type="info"
            showIcon
            message="友商竞品情报说明"
            description="数据来源：企查查API接口（工商信息）+ 各省市公共资源交易平台中标公告（自动爬取）。企查查API当前为「待配置」状态，接入后将实时同步友商最新中标动态。"
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
          <Row gutter={16}>
            {competitors.map(c => (
              <Col xs={24} md={12} lg={8} key={c.id}>
                <CompetitorCard comp={c} />
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>🔍 标讯雷达</Title>
        <Text type="secondary">ToG销售的"显微镜" · 实时监控采购动作与竞争格局</Text>
      </div>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16, borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={12}>
          <Col flex="1">
            <Input
              placeholder="搜索项目名称 / 采购部门..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              style={{ width: 130 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: '全部状态' },
                { value: 'intention', label: '采购意向' },
                { value: 'bidding', label: '正在招标' },
                { value: 'awarded', label: '已中标' },
                { value: 'failed', label: '已废标' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />

      {/* 招标详情抽屉 */}
      <Drawer
        open={!!selectedBid}
        onClose={() => setSelectedBid(null)}
        title="招采项目详情"
        width={520}
      >
        {selectedBid && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Badge color={STATUS_COLOR[selectedBid.statusKey]} text={selectedBid.statusName} />
              {selectedBid.hasSubcontract && <Tag color="orange" icon={<BranchesOutlined />}>含分包机会</Tag>}
            </div>
            <Title level={5}>{selectedBid.title}</Title>
            <Paragraph style={{ color: '#555' }}>{selectedBid.description}</Paragraph>
            {selectedBid.subcontractNote && (
              <Alert type="success" showIcon message="分包机会" description={selectedBid.subcontractNote} style={{ marginBottom: 16, borderRadius: 8 }} />
            )}
            {[
              { label: '采购部门', value: selectedBid.department },
              { label: '地区', value: `${selectedBid.region} · ${selectedBid.city}` },
              { label: '预算金额', value: selectedBid.amount >= 10000 ? `${(selectedBid.amount / 10000).toFixed(1)}亿` : `${selectedBid.amount}万` },
              { label: '信息来源', value: selectedBid.source },
              { label: '发布日期', value: selectedBid.publishedAt },
              { label: '招标截止', value: selectedBid.deadline || '暂无' },
              { label: '中标单位', value: selectedBid.winner || '未定' },
              { label: '竞争对手', value: selectedBid.competitors?.join('、') || '未知' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
                <Text type="secondary" style={{ width: 72, flexShrink: 0, fontSize: 12 }}>{r.label}</Text>
                <Text style={{ fontSize: 13 }}>{r.value}</Text>
              </div>
            ))}
            {selectedBid.policyRef && (
              <Alert
                type="info" showIcon icon={<LinkOutlined />}
                message="政策溯源"
                description="此采购项目的政策来源：广东省《数字政府建设三年行动方案（2025-2027）》中「建设省级政务数据湖」相关任务，预算支撑明确。"
                style={{ marginTop: 16, borderRadius: 8 }}
              />
            )}
            <Divider />
            <Button type="primary" block onClick={() => { message.success('已推送至智能线索池'); setSelectedBid(null) }}>
              推送至智能线索池
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  )
}
