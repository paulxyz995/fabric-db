import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Typography, Space } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, InboxOutlined,
  ToolOutlined, FileTextOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/',               icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/customers',      icon: <TeamOutlined />,      label: 'Customers' },
  { key: '/yarn-receipts',  icon: <InboxOutlined />,     label: 'Yarn Receipts' },
  { key: '/production-jobs',icon: <ToolOutlined />,      label: 'Production Jobs' },
  { key: '/invoices',       icon: <FileTextOutlined />,  label: 'Invoices' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ padding: '16px', color: '#fff', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
          {collapsed ? 'FB' : 'Fabric DB'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Space>
            <Avatar>{user?.name?.[0]?.toUpperCase()}</Avatar>
            <Typography.Text>{user?.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ textTransform: 'capitalize' }}>
              ({user?.role})
            </Typography.Text>
            <Button icon={<LogoutOutlined />} type="text" onClick={logout}>
              Logout
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
