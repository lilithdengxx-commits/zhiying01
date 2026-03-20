import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Table, Tag, Typography, Tabs, Timeline, Alert,
  Statistic, Space, Badge, Button, Divider, List, message, Drawer,
} from 'antd'
import {
  ApartmentOutlined, UserSwitchOutlined, WarningOutlined, RiseOutlined,
  EyeOutlined, PhoneOutlined, GoldOutlined,
} from '@ant-design/icons'
import { getCustomers } from '../api'

const { Title, Text, Paragraph } = Typography

const riskMap = {
  low: { color: 'green', text: '低风险', dot: '#52c41a' },
  medium: { color: 'orange', text: '中等', dot: '#fa8c16' },
  high: { color: 'red', text: '高风险', dot: '#f5222d' },
}

const personnelChanges = [
  { id: 1, date: '2026-03-15', person: '刘勇', from: '杭州市西湖区大数据局局长', to: '杭州市拱墅区大数据局局长', type: 'move', leadId: 'L007', isOurClient: true },
  { id: 2, date: '2026-03-10', person: '赵明', from: '重庆市渝北区信息中心主任', to: '重庆市大数据发展局副局长', type: 'promote', leadId: null, isOurClient: false },
  { id: 3, date: '2026-02-28', person: '钱国华', from: '山东省大数据局信息处处长', to: '山东省大数据局副局长', type: 'promote', leadId: 'L005', isOurClient: false },
  { id: 4, date: '2026-02-20', person: '孙建军', from: '深圳市南山区政数局副局长', to: '深圳市龙岗区政数局局长', type: 'move', leadId: 'L003', isOurClient: true },
]

function CustomerDetailDrawer({ customer, onClose }) {
  if (!customer) return null
  return (
    <Drawer open={!!customer} onClose={onClose} title="客户档案" width={540}>
      <div style={{ marginBottom: 16, padding: '14px 16px', background: '#f9f9f9', borderRadius: 8 }}>
        <Title level={5} style={{ margin: 0 }}>{customer.name}</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>{customer.region} · {customer.city} · {customer.type}</Text>
      </div>

      {/* 合同总价值 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic title="合同总价值" value={customer.totalValue} suffix="万" valueStyle={{ color: '#1677ff', fontSize: 22 }} />
        </Col>
        <Col span={8}>
          <Statistic title="合作项目" value={customer.projects.length} suffix="个" valueStyle={{ color: '#52c41a', fontSize: 22 }} />
        </Col>
        <Col span={8}>
          <Statistic title="最近联系" value={customer.lastContact} valueStyle={{ fontSize: 14 }} />
        </Col>
      </Row>

      {/* 历史项目 */}
      <Divider>历史合作项目</Divider>
      {customer.projects.map((p, i) => (
        <div key={i} style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 8, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>{p.name}</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Tag>{p.year}年</Tag>
            <Tag color="blue">{p.role}</Tag>
            <Tag color="green">{p.value}万</Tag>
            <Tag color={p.status.includes('到期') ? 'red' : 'default'}>{p.status}</Tag>
          </div>
        </div>
      ))}

      {/* 二次商机 */}
      {customer.renewal && (
        <>
          <Divider>二次商机预测</Divider>
          <Alert
            type={customer.renewal.risk === 'low' ? 'success' : 'warning'}
            showIcon
            icon={<RiseOutlined />}
            message={customer.renewal.title}
            description={
              <div>
                {customer.renewal.value && <Text>预计价值：<Text strong style={{ color: '#fa8c16' }}>{customer.renewal.value}万</Text></Text>}
                {customer.renewal.date && <Text style={{ marginLeft: 12 }}>预计时间：{customer.renewal.date}</Text>}
              </div>
            }
            style={{ borderRadius: 8 }}
          />
        </>
      )}

      {/* 关键联系人 */}
      <Divider>关键联系人</Divider>
      {customer.contacts.map((c, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <Text strong>{c.name}</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{c.role}</Text>
          </div>
          <div>
            <Tag color={c.relation === '深度合作' ? 'green' : 'blue'}>{c.relation}</Tag>
            <Button type="link" size="small" icon={<PhoneOutlined />}>联系</Button>
          </div>
        </div>
      ))}

      {/* IT供应商格局 */}
      <Divider>IT供应商格局</Divider>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {customer.suppliers.map((s, i) => (
          <Tag key={i} color={s.includes('我司') ? 'blue' : 'default'} style={{ padding: '4px 10px' }}>{s}</Tag>
        ))}
      </div>

      <Button type="primary" block style={{ marginTop: 24 }} onClick={() => message.success('已添加回访提醒')}>
        设置关怀/回访提醒
      </Button>
    </Drawer>
  )
}

export default function GovGraph() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('customers')

  useEffect(() => {
    getCustomers().then(r => { setCustomers(r.data); setLoading(false) })
  }, [])

  const columns = [
    {
      title: '客户名称', dataIndex: 'name', key: 'name',
      render: (name, row) => (
        <div>
          <Text strong style={{ fontSize: 13, cursor: 'pointer', color: '#1677ff' }} onClick={() => setSelected(row)}>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{row.region} · {row.type}</Text>
        </div>
      ),
    },
    {
      title: '合同总价值', dataIndex: 'totalValue', key: 'totalValue', width: 110,
      sorter: (a, b) => b.totalValue - a.totalValue,
      render: v => <Text strong style={{ color: '#fa8c16' }}>{v}万</Text>,
    },
    {
      title: '二次商机', key: 'renewal',
      render: (_, row) => (
        <div>
          <Tag color={riskMap[row.renewal.risk]?.color}>{riskMap[row.renewal.risk]?.text}</Tag>
          <Text style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{row.renewal.title}</Text>
          {row.renewal.value && <Text type="secondary" style={{ fontSize: 11 }}>预计 {row.renewal.value}万 · {row.renewal.date}</Text>}
        </div>
      ),
    },
    {
      title: 'IT供应商格局', dataIndex: 'suppliers', key: 'suppliers',
      render: arr => (
        <div>
          {arr.map((s, i) => (
            <Tag key={i} color={s.includes('我司') ? 'blue' : 'default'} style={{ margin: '2px 2px 2px 0', fontSize: 11 }}>{s}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '最近联系', dataIndex: 'lastContact', key: 'lastContact', width: 100,
      render: d => <Text type="secondary" style={{ fontSize: 12 }}>{d}</Text>,
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, row) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelected(row)}>详情</Button>,
    },
  ]

  const renewalList = customers
    .filter(c => c.renewal.risk === 'low' && c.renewal.value)
    .sort((a, b) => (b.renewal.value || 0) - (a.renewal.value || 0))

  const tabItems = [
    {
      key: 'customers',
      label: '🏢 存量客户档案',
      children: (
        <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
          <Table dataSource={customers} columns={columns} rowKey="id" loading={loading} size="middle" />
        </Card>
      ),
    },
    {
      key: 'renewal',
      label: <span>🔄 二次商机预测 <Tag color="red" style={{ marginLeft: 4 }}>{renewalList.length}</Tag></span>,
      children: (
        <Row gutter={16}>
          {renewalList.map(c => (
            <Col xs={24} md={12} key={c.id}>
              <Card
                hoverable
                style={{ borderRadius: 10, marginBottom: 16, borderLeft: `4px solid ${riskMap[c.renewal.risk]?.dot}` }}
                onClick={() => setSelected(c)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong>{c.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{c.region}</Text>
                  </div>
                  <Tag color={riskMap[c.renewal.risk]?.color}>{riskMap[c.renewal.risk]?.text}</Tag>
                </div>
                <Alert
                  type="success"
                  message={c.renewal.title}
                  description={c.renewal.value ? `预计价值 ${c.renewal.value}万 · ${c.renewal.date}` : '价值待评估'}
                  style={{ marginTop: 10, borderRadius: 6 }}
                  showIcon
                  icon={<GoldOutlined />}
                />
                <Button type="primary" size="small" block style={{ marginTop: 10 }}
                  onClick={e => { e.stopPropagation(); message.success('已推送二次商机至线索池') }}>
                  推送至线索池
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      ),
    },
    {
      key: 'personnel',
      label: '👤 人事异动监控',
      children: (
        <div>
          <Alert
            type="info"
            showIcon
            message="数据来源：各省市政府官网人事任免公告（每日自动爬取）。当检测到老客户关键联系人调任新机构时，系统自动生成「人事异动」类线索推入线索池。"
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
          <Card style={{ borderRadius: 10 }}>
            <Timeline
              items={personnelChanges.map(pc => ({
                dot: (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: pc.isOurClient ? '#1677ff' : '#d9d9d9',
                  }} />
                ),
                children: (
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8, marginBottom: 8,
                      borderColor: pc.isOurClient ? '#1677ff44' : '#f0f0f0',
                      background: pc.isOurClient ? '#e6f4ff' : '#fafafa',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <Space>
                          <Text strong>{pc.person}</Text>
                          {pc.isOurClient && <Tag color="blue" style={{ fontSize: 11 }}>老客户KP</Tag>}
                          <Tag color={pc.type === 'promote' ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                            {pc.type === 'promote' ? '晋升' : '调任'}
                          </Tag>
                        </Space>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          {pc.from} → <Text strong style={{ color: '#1677ff' }}>{pc.to}</Text>
                        </div>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{pc.date}</Text>
                    </div>
                    {pc.leadId && (
                      <Button type="link" size="small" style={{ padding: 0, marginTop: 4 }}
                        onClick={() => message.success('已跳转至相关线索')}>
                        → 查看关联线索
                      </Button>
                    )}
                  </Card>
                ),
              }))}
            />
          </Card>
        </div>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>🗺️ 客户管理</Title>
        <Text type="secondary">从一锤子买卖到长效经营 · 存量客户价值罗盘</Text>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { title: '存量客户', value: customers.length, suffix: '家', color: '#1677ff' },
          { title: '合同总价值', value: customers.reduce((s, c) => s + c.totalValue, 0), suffix: '万', color: '#fa8c16' },
          { title: '二次商机', value: customers.filter(c => c.renewal.value).length, suffix: '个', color: '#52c41a' },
          { title: '预计续签金额', value: customers.filter(c => c.renewal.value).reduce((s, c) => s + (c.renewal.value || 0), 0), suffix: '万', color: '#722ed1' },
        ].map(s => (
          <Col xs={12} md={6} key={s.title}>
            <Card style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title={s.title} value={s.value} suffix={s.suffix} valueStyle={{ color: s.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />

      <CustomerDetailDrawer customer={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
