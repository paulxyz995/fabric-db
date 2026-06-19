import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  ClockCircleOutlined, CheckCircleOutlined,
  DollarOutlined, FileTextOutlined,
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

      <Typography.Text type="secondary">Production Jobs</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Pending"      value={data.jobs.pending}     prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="In Progress"  value={data.jobs.in_progress} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Completed"    value={data.jobs.completed}   valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Dispatched"   value={data.jobs.dispatched} /></Card>
        </Col>
      </Row>

      <Typography.Text type="secondary">Invoices</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Sent / Unpaid"  value={data.invoices.sent}    prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Overdue"         value={data.invoices.overdue} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total Billed"    value={`Rp ${fmt(data.invoices.total_billed)}`}  prefix={<DollarOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total Paid"      value={`Rp ${fmt(data.invoices.total_paid)}`}   valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Typography.Text type="secondary">Yarn received this month</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Yarn Received (kg)" value={fmt(data.yarn.total_yarn_received_kg)} suffix="kg" /></Card>
        </Col>
      </Row>
    </>
  );
}
