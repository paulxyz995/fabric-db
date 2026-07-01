import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin, Table, Empty } from 'antd';
import {
  DropboxOutlined, DollarOutlined, FileTextOutlined, InboxOutlined,
  RiseOutlined, ShoppingOutlined, FundOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID');
const rp = (n) => `Rp ${fmt(n)}`;

// Grafik batang sederhana (tanpa library) untuk tren pendapatan bulanan
function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return <Empty description="Belum ada data pendapatan" />;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200, padding: '8px 4px' }}>
      {data.map((d) => {
        const h = Math.round((d.revenue / max) * 160);
        return (
          <div key={d.month} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: '#555' }}>{rp(d.revenue)}</div>
            <div
              title={rp(d.revenue)}
              style={{
                height: Math.max(h, 2), background: '#1677ff', borderRadius: '4px 4px 0 0',
                transition: 'height .3s',
              }}
            />
            <div style={{ fontSize: 12, marginTop: 6, color: '#555' }}>
              {dayjs(d.month + '-01').format('MMM YY')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;
  if (!data) return null;

  const isOwner = data.is_owner;

  return (
    <>
      <Typography.Title level={4}>Dashboard</Typography.Title>

      <Typography.Text type="secondary">Produksi bulan ini</Typography.Text>
      <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Kain Diproduksi (kg)" value={fmt(data.production.total_kg)} prefix={<DropboxOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Roll (gulungan)" value={fmt(data.production.total_rolls)} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card><Statistic title="Benang Masuk (kg)" value={fmt(data.yarn.total_yarn_received_kg)} prefix={<InboxOutlined />} /></Card>
        </Col>
      </Row>

      {/* Bagian pendapatan/uang: HANYA owner */}
      {isOwner && (
        <>
          <Typography.Text type="secondary">Pendapatan</Typography.Text>
          <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Pendapatan Bulan Ini" value={rp(data.revenue_this_month)}
                  valueStyle={{ color: '#1677ff' }} prefix={<RiseOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card>
                <Statistic title="Belum Dibayar (Outstanding)" value={rp(data.invoices.outstanding)}
                  prefix={<DollarOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card>
                <Statistic title="Total Sudah Dibayar" value={rp(data.invoices.total_paid)}
                  valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card><Statistic title="Invoice Terkirim" value={data.invoices.sent} prefix={<FileTextOutlined />} /></Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card><Statistic title="Jatuh Tempo" value={data.invoices.overdue} valueStyle={{ color: '#ff4d4f' }} /></Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card><Statistic title="Draft" value={data.invoices.draft} /></Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card><Statistic title="Lunas" value={data.invoices.paid} valueStyle={{ color: '#52c41a' }} /></Card>
            </Col>
          </Row>

          <Typography.Text type="secondary">Penjualan kain sendiri (bulan ini)</Typography.Text>
          <Row gutter={[16, 16]} style={{ marginTop: 8, marginBottom: 24 }}>
            <Col xs={12} sm={12}>
              <Card>
                <Statistic title="Total Penjualan Kain Sendiri" value={rp(data.sales_this_month)}
                  prefix={<ShoppingOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={12}>
              <Card>
                <Statistic title="Untung Kain Sendiri" value={rp(data.profit_this_month)}
                  valueStyle={{ color: '#52c41a' }} prefix={<FundOutlined />} />
              </Card>
            </Col>
          </Row>

          <Typography.Text type="secondary">Tren pendapatan maklon 6 bulan terakhir</Typography.Text>
          <Card style={{ marginTop: 8, marginBottom: 24 }}>
            <RevenueChart data={data.monthly_revenue} />
          </Card>
        </>
      )}

      <Typography.Text type="secondary">Pelanggan teratas (produksi bulan ini)</Typography.Text>
      <Card style={{ marginTop: 8 }}>
        <Table
          dataSource={data.top_customers}
          rowKey="customer_name"
          size="small"
          pagination={false}
          columns={[
            { title: 'Pelanggan', dataIndex: 'customer_name' },
            { title: 'Kain (kg)', dataIndex: 'total_kg', align: 'right', render: fmt },
          ]}
          locale={{ emptyText: 'Belum ada produksi bulan ini' }}
        />
      </Card>
    </>
  );
}
