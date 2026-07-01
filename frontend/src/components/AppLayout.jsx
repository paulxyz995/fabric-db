import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Typography, Space } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, BgColorsOutlined,
  FileTextOutlined, LogoutOutlined, CarOutlined, UserSwitchOutlined,
  ShoppingOutlined, BranchesOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', hr: 'HR' };

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isOwner, canManageUsers, canWriteOps } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Menu disesuaikan dengan peran
  const menuItems = [
    { key: '/',             icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/customers',    icon: <TeamOutlined />,      label: 'Pelanggan' },
    { key: '/fabric-types', icon: <BgColorsOutlined />,  label: 'Jenis Kain' },
    { key: '/surat-jalan',  icon: <CarOutlined />,       label: 'Surat Jalan' },
    // Kelola cabang produksi: owner + admin
    ...(canWriteOps ? [{ key: '/branches', icon: <BranchesOutlined />, label: 'Cabang' }] : []),
    // Invoice/pendapatan hanya owner
    ...(isOwner ? [{ key: '/invoices', icon: <FileTextOutlined />, label: 'Invoice' }] : []),
    // Penjualan kain sendiri hanya owner
    ...(isOwner ? [{ key: '/sales', icon: <ShoppingOutlined />, label: 'Penjualan' }] : []),
    // Kelola user hanya owner + HR
    ...(canManageUsers ? [{ key: '/users', icon: <UserSwitchOutlined />, label: 'Pengguna' }] : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ padding: '16px', color: '#fff', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
          {collapsed ? 'FB' : 'Fabric DB'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={['/' + (pathname.split('/')[1] || '')]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Space>
            <Avatar>{user?.name?.[0]?.toUpperCase()}</Avatar>
            <Typography.Text>{user?.name}</Typography.Text>
            <Typography.Text type="secondary">
              ({ROLE_LABEL[user?.role] || user?.role})
            </Typography.Text>
            <Button icon={<LogoutOutlined />} type="text" onClick={logout}>
              Keluar
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
