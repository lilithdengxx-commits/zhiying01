import React, { useState, useEffect } from 'react'
import { Row, Col, Card, List, Tag, Typography, Input, Select, Badge, Spin, Modal, Divider, Alert, Space } from 'antd'
import { RadarChartOutlined, SearchOutlined, GlobalOutlined, MoneyCollectOutlined } from '@ant-design/icons'
import { getPolicies } from '../api'

const { Title, Text, Paragraph } = Typography

const LEVEL_MAP = { national: { color: 'red', name: '国家级' }, provincial: { color: 'blue', name: '省级' }, city: { color: 'green', name: '市级' } }
const scoreColor = s => s >= 85 ? '#52c41a' : s >= 70 ? '#fa8c16' : '#1677ff'

export default function PolicyRadar() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [level, setLevel] = useState('')
  const [selected, setSelected] = useState(null)

  const fetch_ = async (kw = keyword, lv = level) => {
    setLoading(true)
    try {
      const clean = {}
      if (kw) clean.keyword = kw
      if (lv) clean.level = lv
      const { data } = await getPolicies(clean)
      setPolicies(data || [])
    } catch (e) {
      console.error('[PolicyRadar] fetch failed:', e)
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch_() }, [])

  const budgetAlerts = [
    { region: '广东省', amount: '12亿', desc: '2026年数字政府专项预算已公示', status: '已到位', color: 'success' },
    { region: '山东省', amount: '8000万', desc: '数据要素专项债资金已获批', status: '已到位', color: 'success' },
    { region: '成都市', amount: '待确认', desc: 'AI大模型专项债申报中，预计Q3到位', status: '审批中', color: 'warning' },
    { region: '上海市', amount: '待公示', desc: '政务大模型补充专项预算预计Q2公示', status: '待公示', color: 'processing' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>📡 政策雷达</Title>
        <Text type="secondary">ToG销售的"望远镜" · 提前3个月至3年的宏观规划情报</Text>
      </div>

      {/* 预算监控区 */}
      <Card
        title={<><MoneyCollectOutlined style={{ color: '#fa8c16' }} /> 预算/专项债资金监控</>}
        style={{ marginBottom: 16, borderRadius: 10 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Row gutter={[12, 8]}>
          {budgetAlerts.map(a => (
            <Col xs={24} sm={12} lg={6} key={a.region}>
              <Badge.Ribbon text={a.status} color={a.status === '已到位' ? 'green' : a.status === '审批中' ? 'orange' : 'blue'}>
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Text strong>{a.region}</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16', margin: '4px 0' }}>{a.amount}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{a.desc}</Text>
                </Card>
              </Badge.Ribbon>
            </Col>
          ))}
        </Row>
        <Alert
          style={{ marginTop: 12, borderRadius: 8 }}
          type="info"
          showIcon
          message="💡 数据来源策略：系统监控各省市财政局预算公开报告、发改委专项债批复文件、国家数据局政策发文，每6小时自动更新。"
        />
      </Card>

      {/* 过滤 */}
      <Card style={{ marginBottom: 16, borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={12}>
          <Col flex="1">
            <Input
              placeholder="搜索政策标题或关键词..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => { setKeyword(e.target.value); fetch_(e.target.value, level) }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              style={{ width: 130 }}
              value={level}
              onChange={v => { setLevel(v); fetch_(keyword, v) }}
              options={[
                { value: '', label: '全部层级' },
                { value: 'national', label: '国家级' },
                { value: 'provincial', label: '省级' },
                { value: 'city', label: '市级' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* 政策列表 */}
      <Row gutter={16}>
        <Col xs={24} md={10} lg={8}>
          <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div> : (
              <List
                dataSource={policies}
                renderItem={(p, i) => (
                  <List.Item
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      background: selected?.id === p.id ? '#e6f4ff' : 'transparent',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onClick={() => setSelected(p)}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <Text strong style={{ fontSize: 13, flex: 1 }}>{p.title}</Text>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: scoreColor(p.score) + '18', border: `2px solid ${scoreColor(p.score)}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, color: scoreColor(p.score), fontWeight: 700, fontSize: 12,
                        }}>{p.score}</div>
                      </div>
                      <Space style={{ marginTop: 6 }}>
                        <Tag color={LEVEL_MAP[p.level]?.color} style={{ fontSize: 11 }}>{LEVEL_MAP[p.level]?.name}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{p.region}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{p.publishedAt}</Text>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={14} lg={16}>
          {selected ? (
            <Card style={{ borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>{selected.title}</Title>
                  <Space style={{ marginTop: 6 }}>
                    <Tag color={LEVEL_MAP[selected.level]?.color}>{LEVEL_MAP[selected.level]?.name}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>发布：{selected.publishedAt}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>地区：{selected.region}</Text>
                  </Space>
                </div>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: scoreColor(selected.score) + '15', border: `3px solid ${scoreColor(selected.score)}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: scoreColor(selected.score),
                }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.score}</div>
                  <div style={{ fontSize: 10 }}>相关度</div>
                </div>
              </div>

              <Divider />

              <div style={{ marginBottom: 14 }}>
                <Text strong style={{ color: '#555', fontSize: 12 }}>📋 政策摘要</Text>
                <Paragraph style={{ marginTop: 6, color: '#555' }}>{selected.summary}</Paragraph>
              </div>

              <div style={{ background: '#f6ffed', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <Text strong style={{ color: '#389e0d', fontSize: 12 }}>🎯 AI提取商机任务（与我司业务匹配项）</Text>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {selected.relevantTasks.map((t, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 13 }}>{t}</Text>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ background: '#e6f4ff', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <Text strong style={{ color: '#1677ff', fontSize: 12 }}>🏢 AI预测潜在牵头部门</Text>
                <div style={{ marginTop: 8 }}>
                  {selected.potentialDepts.map((d, i) => (
                    <Tag key={i} color="blue" style={{ margin: '2px 4px 2px 0' }}>{d}</Tag>
                  ))}
                </div>
              </div>

              <Alert
                showIcon
                type="warning"
                message="💰 预算信号"
                description={selected.budgetSignal}
                style={{ borderRadius: 8 }}
              />
            </Card>
          ) : (
            <Card style={{ borderRadius: 10, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 60 }}>
                <RadarChartOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 12 }} />
                <Text type="secondary">点击左侧政策查看AI解析详情</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
