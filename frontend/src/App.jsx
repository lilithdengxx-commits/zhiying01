import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Avatar, Space, Badge, ConfigProvider, theme, Button, Tooltip } from 'antd'
import {
  DashboardOutlined, BulbOutlined, RadarChartOutlined, FileSearchOutlined,
  ApartmentOutlined, CalendarOutlined, FileTextOutlined, BellOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, GlobalOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import LeadPool from './pages/LeadPool'
import PolicyRadar from './pages/PolicyRadar'
import BidRadar from './pages/BidRadar'
import GovGraph from './pages/GovGraph'
import MarketingCalendar from './pages/MarketingCalendar'
import DailyBriefing from './pages/DailyBriefing'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

const NAV_ITEMS = [
  { key: '/', label: '工作台', icon: <DashboardOutlined /> },
  { key: '/leads', label: '智能线索池', icon: <BulbOutlined /> },
  { key: '/policy', label: '政策雷达', icon: <RadarChartOutlined /> },
  { key: '/bidding', label: '标讯雷达', icon: <FileSearchOutlined /> },
  { key: '/graph', label: '政企图谱', icon: <ApartmentOutlined /> },
  { key: '/calendar', label: '营销日历', icon: <CalendarOutlined /> },
  { key: '/briefing', label: '每日线索简报', icon: <FileTextOutlined /> },
]

function AppInner() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const menuItems = NAV_ITEMS.map(item => ({
    key: item.key,
    icon: item.icon,
    label: <Link to={item.key}>{item.label}</Link>,
  }))

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ background: '#001529', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}
      >
        {/* Logo */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🦅</span>
          {!collapsed && (
            <div style={{ marginLeft: 10 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>智鹰</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>ToG商机挖掘系统</div>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />

        {/* 数据源状态 */}
        {!collapsed && (
          <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, padding: '0 16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>数据源状态</Text>
              {[
                { name: '政采网', ok: true }, { name: '标讯平台', ok: true },
                { name: '企查查API', ok: false }, { name: '政府官网', ok: true },
              ].map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.ok ? '#52c41a' : '#faad14', flexShrink: 0 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{s.name}</Text>
                  {!s.ok && <Text style={{ color: '#faad14', fontSize: 10 }}>待配置</Text>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#fff', padding: '0 24px',
          boxShadow: '0 1px 4px rgba(0,21,41,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 99,
        }}>
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>
              📅 2026年3月21日（星期六）
            </Text>
          </Space>
          <Space size={20}>
            <Tooltip title="系统文档">
              <Button type="text" icon={<GlobalOutlined />} />
            </Tooltip>
            <Tooltip title="7条未读消息">
              <Badge count={7} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 17 }} />} />
              </Badge>
            </Tooltip>
            <Space>
              <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1677ff', cursor: 'pointer' }} />
              <div>
                <Text style={{ fontSize: 13, fontWeight: 500, display: 'block', lineHeight: 1.2 }}>张三</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>华南区销售总监</Text>
              </div>
            </Space>
          </Space>
        </Header>

        <Content style={{ minHeight: 'calc(100vh - 64px)', background: '#f0f2f5', padding: '0' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<LeadPool />} />
            <Route path="/policy" element={<PolicyRadar />} />
            <Route path="/bidding" element={<BidRadar />} />
            <Route path="/graph" element={<GovGraph />} />
            <Route path="/calendar" element={<MarketingCalendar />} />
            <Route path="/briefing" element={<DailyBriefing />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgLayout: '#f0f2f5',
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <Router>
        <AppInner />
      </Router>
    </ConfigProvider>
  )
}
