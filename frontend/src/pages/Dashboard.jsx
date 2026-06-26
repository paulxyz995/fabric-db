import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin, Table } from 'antd';
import {
  DropboxOutlined, DollarOutlined, FileTextOutlined, InboxOutlined,
} from '@ant-design/icons';
import api from '../utils/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const fmt = (n) => Number(n).toLocaleString('id-ID');

  return (
    <>
      <Typography.Title level={4}>Dashboard</Typography.Title>

      <Typography.Text type="secondary">Production this month</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Fabric Produced (kg)" value={fmt(data.production.total_kg)} prefix={<DropboxOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Rolls (gulungan)" value={fmt(data.production.total_rolls)} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Yarn Received (kg)" value={fmt(data.yarn.total_yarn_received_kg)} prefix={<InboxOutlined />} /></Card>
        </Col>
      </Row>

      <Typography.Text type="secondary">Invoices</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Sent / Unpaid" value={data.invoices.sent} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Overdue" value={data.invoices.overdue} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Outstanding" value={`Rp ${fmt(data.invoices.outstanding)}`} prefix={<DollarOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total Paid" value={`Rp ${fmt(data.invoices.total_paid)}`} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Typography.Text type="secondary">Top customers by production this month</Typography.Text>
      <Card style={{ marginTop: 8 }}>
        <Table
          dataSource={data.top_customers}
          rowKey="customer_name"
          size="small"
          pagination={false}
          columns={[
            { title: 'Customer', dataIndex: 'customer_name' },
            { title: 'Fabric (kg)', dataIndex: 'total_kg', align: 'right', render: fmt },
          ]}
          locale={{ emptyText: 'No production recorded this month' }}
        />
      </Card>
    </>
  );
}
