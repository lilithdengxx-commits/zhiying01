import React, { useState, useEffect } from 'react'
import {
  Row, Col, Card, Calendar, Tag, Typography, List, Button, Badge,
  Modal, Form, Input, Select, Space, message, Alert, Tooltip, Divider,
} from 'antd'
import {
  CalendarOutlined, PlusOutlined, CheckOutlined, EnvironmentOutlined,
  TeamOutlined, StarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getEvents } from '../api'

const { Title, Text, Paragraph } = Typography

const RELEVANCE_COLOR = { high: 'red', medium: 'orange', low: 'default' }
const TYPE_COLOR = { '高峰论坛': 'red', '区域峰会': 'blue', '展览博览': 'green', '行业论坛': 'purple' }

// 首字母头像颜色
const AVATAR_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96']

function EventCard({ ev, onRegister, onLeadEntry }) {
  const isUpcoming = dayjs(ev.startDate).isAfter(dayjs())
  const isPast = dayjs(ev.endDate).isBefore(dayjs())

  return (
    <Card
      hoverable
      style={{
        borderRadius: 10, marginBottom: 12,
        borderLeft: `4px solid ${ev.relevance === 'high' ? '#f5222d' : ev.relevance === 'medium' ? '#fa8c16' : '#d9d9d9'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <Tag color={TYPE_COLOR[ev.type] || 'default'} style={{ fontSize: 11 }}>{ev.type}</Tag>
            <Tag color={RELEVANCE_COLOR[ev.relevance]} style={{ fontSize: 11 }}>
              {ev.relevanceName}
            </Tag>
            {ev.registered && <Tag color="green" icon={<CheckOutlined />} style={{ fontSize: 11 }}>已报名</Tag>}
            {isPast && <Tag color="default" style={{ fontSize: 11 }}>已结束</Tag>}
          </div>
          <Text strong style={{ fontSize: 14 }}>{ev.name}</Text>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <CalendarOutlined style={{ marginRight: 4 }} />
          {ev.startDate} {ev.startDate !== ev.endDate ? `~ ${ev.endDate}` : ''}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <EnvironmentOutlined style={{ marginRight: 4 }} />
          {ev.location}
        </Text>
      </div>

      <Paragraph style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>{ev.description}</Paragraph>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        <TeamOutlined style={{ marginRight: 4 }} />
        {ev.expectedAttendees}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!ev.registered && !isPast && (
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => onRegister(ev)}>
            加入我的日程
          </Button>
        )}
        {isPast && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => onLeadEntry(ev)}>
            录入展会线索
          </Button>
        )}
        {ev.registered && !isPast && (
          <Button size="small" icon={<CalendarOutlined />} onClick={() => message.info('已添加到日历')}>
            查看日历
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function MarketingCalendar() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [localEvents, setLocalEvents] = useState([])
  const [leadModal, setLeadModal] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    getEvents().then(r => {
      setEvents(r.data)
      setLocalEvents(r.data)
      setLoading(false)
    })
  }, [])

  // 日历 cell 渲染
  const getEventsForDate = (date) => {
    const dateStr = date.format('YYYY-MM-DD')
    return localEvents.filter(e => dateStr >= e.startDate && dateStr <= e.endDate)
  }

  const dateCellRender = (value) => {
    const dateEvents = getEventsForDate(value)
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dateEvents.map(e => (
          <li key={e.id} style={{ marginBottom: 2 }}>
            <Badge
              color={e.relevance === 'high' ? 'red' : e.relevance === 'medium' ? 'orange' : 'blue'}
              text={<Text style={{ fontSize: 10 }}>{e.name.slice(0, 8)}...</Text>}
            />
          </li>
        ))}
      </ul>
    )
  }

  const handleRegister = (ev) => {
    setLocalEvents(prev => prev.map(e => e.id === ev.id ? { ...e, registered: true } : e))
    message.success(`已报名《${ev.name}》，已添加至您的日程`)
  }

  const handleLeadEntry = (ev) => {
    setLeadModal(ev)
    form.resetFields()
  }

  const handleSubmitLeads = async () => {
    try {
      await form.validateFields()
      message.success('展会线索已录入智能线索池，请前往线索池查看')
      setLeadModal(null)
    } catch {}
  }

  const highValueEvents = localEvents.filter(e => e.relevance === 'high')
  const registeredEvents = localEvents.filter(e => e.registered)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>📅 营销日历</Title>
          <Text type="secondary">展会、论坛、培训等线下获客场景管理</Text>
        </div>
        <Space>
          <Tag color="red">高价值活动 {highValueEvents.length} 个</Tag>
          <Tag color="green">已报名 {registeredEvents.length} 个</Tag>
        </Space>
      </div>

      <Row gutter={16}>
        {/* 左侧：日历视图 */}
        <Col xs={24} lg={14}>
          <Card style={{ borderRadius: 10 }} title="📆 活动日历视图">
            <Calendar
              cellRender={dateCellRender}
              headerRender={({ value, onChange }) => {
                const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }))
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', gap: 8 }}>
                    <Select
                      value={value.month()}
                      options={months}
                      style={{ width: 80 }}
                      onChange={m => onChange(value.clone().month(m))}
                    />
                    <Select
                      value={value.year()}
                      options={[2025, 2026, 2027].map(y => ({ value: y, label: `${y}年` }))}
                      style={{ width: 90 }}
                      onChange={y => onChange(value.clone().year(y))}
                    />
                  </div>
                )
              }}
            />
          </Card>
        </Col>

        {/* 右侧：活动列表 */}
        <Col xs={24} lg={10}>
          <div>
            <Card
              title={<><StarOutlined style={{ color: '#f5222d' }} /> 近期重点活动</>}
              style={{ borderRadius: 10, marginBottom: 16 }}
              bodyStyle={{ maxHeight: 680, overflowY: 'auto' }}
            >
              {loading ? (
                <Text type="secondary">加载中...</Text>
              ) : (
                localEvents.map(ev => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    onRegister={handleRegister}
                    onLeadEntry={handleLeadEntry}
                  />
                ))
              )}
            </Card>
          </div>
        </Col>
      </Row>

      {/* 展会线索录入弹窗 */}
      <Modal
        open={!!leadModal}
        title={`📝 录入展会线索 · ${leadModal?.name}`}
        onOk={handleSubmitLeads}
        onCancel={() => setLeadModal(null)}
        okText="录入线索池"
        width={520}
      >
        <Alert
          type="info"
          showIcon
          message="请填写展会上收集到的潜在客户信息，系统将自动创建「展会活动」类线索并推入智能线索池。"
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item name="company" label="客户单位" rules={[{ required: true, message: '请填写机构名称' }]}>
            <Input placeholder="如：南京市鼓楼区大数据局" />
          </Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true }]}>
            <Input placeholder="姓名 + 职务" />
          </Form.Item>
          <Form.Item name="need" label="痛点/需求描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="对方提到的需求或痛点..." />
          </Form.Item>
          <Form.Item name="budget" label="预算线索（可选）">
            <Input placeholder="如：约300万，2026年下半年" />
          </Form.Item>
          <Form.Item name="next" label="建议下一步">
            <Input placeholder="如：发送产品资料，下周安排线上交流" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
