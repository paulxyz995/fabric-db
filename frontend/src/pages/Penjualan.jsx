import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  Space, Typography, message, Popconfirm, Statistic, Row, Col, Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');
const rp = (v) => `Rp ${fmt(v)}`;

export default function Penjualan() {
  const [rows, setRows] = useState([]);
  const [fabricTypes, setFabricTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Ikuti field untuk hitung total & untung secara langsung di form
  const qty = Form.useWatch('quantity_kg', form) || 0;
  const sell = Form.useWatch('sell_price_per_kg', form) || 0;
  const cost = Form.useWatch('cost_per_kg', form) || 0;
  const previewAmount = qty * sell;
  const previewProfit = qty * sell - qty * cost;

  const load = () => {
    setLoading(true);
    const params = {};
    if (month) params.month = month.format('YYYY-MM');
    api.get('/sales', { params }).then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [month]);
  useEffect(() => { api.get('/fabric-types').then((r) => setFabricTypes(r.data)); }, []);

  function openNew() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sale_date: dayjs(), roll_count: 0, cost_per_kg: 0 });
    setOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    form.setFieldsValue({ ...row, sale_date: dayjs(row.sale_date) });
    setOpen(true);
  }

  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = { ...v, sale_date: v.sale_date?.format('YYYY-MM-DD') };
      if (editing) await api.put(`/sales/${editing.id}`, payload);
      else await api.post('/sales', payload);
      message.success(editing ? 'Penjualan diperbarui' : 'Penjualan dicatat');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  async function del(id) {
    try { await api.delete(`/sales/${id}`); message.success('Dihapus'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const totalSales = rows.reduce((s, r) => s + Number(r.amount), 0);
  const totalProfit = rows.reduce((s, r) => s + Number(r.profit), 0);
  const totalKg = rows.reduce((s, r) => s + Number(r.quantity_kg), 0);

  const columns = [
    { title: 'Tanggal', dataIndex: 'sale_date', width: 115, render: (d) => dayjs(d).format('DD MMM YYYY') },
    { title: 'No.', dataIndex: 'sale_number', width: 130 },
    { title: 'Pembeli', dataIndex: 'buyer', ellipsis: true, render: (v) => v || '—' },
    { title: 'Jenis Kain', dataIndex: 'fabric_type', width: 130, render: (v) => v || '—' },
    { title: 'Roll', dataIndex: 'roll_count', width: 70, align: 'right', render: fmt },
    { title: 'KG', dataIndex: 'quantity_kg', width: 90, align: 'right', render: fmt },
    { title: 'Harga Jual/kg', dataIndex: 'sell_price_per_kg', width: 120, align: 'right', render: rp },
    { title: 'Modal/kg', dataIndex: 'cost_per_kg', width: 110, align: 'right', render: rp },
    { title: 'Total', dataIndex: 'amount', width: 130, align: 'right', render: rp },
    { title: 'Untung', dataIndex: 'profit', width: 130, align: 'right',
      render: (v) => <b style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>{rp(v)}</b> },
    {
      title: '', key: 'a', width: 90, align: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Hapus penjualan ini?" okText="Hapus" cancelText="Batal" onConfirm={() => del(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Penjualan Kain Sendiri</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Catat Penjualan</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}><Card><Statistic title="Total Penjualan (filter)" value={rp(totalSales)} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Total Untung (filter)" value={rp(totalProfit)} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Total KG (filter)" value={fmt(totalKg)} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <DatePicker picker="month" placeholder="Filter bulan" value={month} onChange={setMonth} />
        <Typography.Text type="secondary">{rows.length} transaksi</Typography.Text>
      </Space>

      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" scroll={{ x: 1100 }} />

      <Modal
        title={editing ? `Ubah ${editing.sale_number}` : 'Catat Penjualan'}
        open={open} onOk={save} onCancel={() => setOpen(false)}
        confirmLoading={saving} okText="Simpan" cancelText="Batal" width={560}
      >
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="sale_date" label="Tanggal" rules={[{ required: true }]} style={{ width: 180 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
            </Form.Item>
            <Form.Item name="buyer" label="Pembeli" style={{ flex: 1, minWidth: 220 }}>
              <Input placeholder="Nama pembeli (opsional)" />
            </Form.Item>
          </Space>
          <Form.Item name="fabric_type_id" label="Jenis Kain">
            <Select showSearch allowClear optionFilterProp="label" placeholder="Pilih jenis kain"
              options={fabricTypes.map((f) => ({ value: f.id, label: f.name }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="roll_count" label="Roll" style={{ width: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="quantity_kg" label="Jumlah (kg)" rules={[{ required: true, message: 'Wajib diisi' }]} style={{ flex: 1 }}>
              <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="sell_price_per_kg" label="Harga Jual / kg (Rp)" rules={[{ required: true, message: 'Wajib diisi' }]} style={{ flex: 1 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cost_per_kg" label="Modal / kg (Rp)" tooltip="HPP: biaya benang + produksi per kg" style={{ flex: 1 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Row gutter={16} style={{ marginBottom: 8 }}>
            <Col span={12}><Card size="small"><Statistic title="Total Penjualan" value={rp(previewAmount)} /></Card></Col>
            <Col span={12}><Card size="small"><Statistic title="Untung" value={rp(previewProfit)}
              valueStyle={{ color: previewProfit < 0 ? '#ff4d4f' : '#52c41a' }} /></Card></Col>
          </Row>

          <Form.Item name="notes" label="Catatan (opsional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
