import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Tag, Typography, message, Select } from 'antd';
import { PlusOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/customers').then(r => setCustomers(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setEditing(null); form.resetFields(); setModalOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue(row); setModalOpen(true); }

  async function onSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api.put(`/customers/${editing.id}`, { ...editing, ...values });
      else await api.post('/customers', values);
      message.success(editing ? 'Diperbarui' : 'Pelanggan ditambahkan');
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  const columns = [
    { title: 'Kode', dataIndex: 'code', width: 110 },
    { title: 'Nama', dataIndex: 'name', ellipsis: true,
      render: (v) => <a>{v}</a> },
    { title: 'Inisial', dataIndex: 'short_code', width: 90,
      render: (v) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Tipe', dataIndex: 'type', width: 130,
      render: (v) => v === 'own'
        ? <Tag color="purple">Produksi Sendiri</Tag>
        : <Tag color="cyan">Maklon</Tag> },
    { title: 'Kontak', dataIndex: 'contact_person', ellipsis: true },
    { title: 'Telepon', dataIndex: 'phone' },
    { title: 'Status', dataIndex: 'is_active', width: 90,
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    {
      title: '', key: 'actions', width: 130, align: 'right',
      render: (_, row) => (
        <Space onClick={(e) => e.stopPropagation()}>
          {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
          <Button size="small" type="link" onClick={() => navigate(`/customers/${row.id}`)}>
            Buka <RightOutlined />
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Pelanggan</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Tambah Pelanggan</Button>}
      </Space>

      <Table
        dataSource={customers}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        onRow={(row) => ({
          onClick: () => navigate(`/customers/${row.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal title={editing ? 'Ubah Pelanggan' : 'Tambah Pelanggan'} open={modalOpen}
        onOk={onSave} onCancel={() => setModalOpen(false)} confirmLoading={saving}
        okText="Simpan" cancelText="Batal">
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Kode Pelanggan" rules={[{ required: true, message: 'Kode wajib diisi' }]}>
            <Input placeholder="CUST-006" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="Nama Perusahaan" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="mis. Chia Fransdhika Yuan" />
          </Form.Item>
          <Form.Item name="short_code" label="Inisial / Nama Singkat"
            tooltip="Inisial yang dipakai di nama file PDF, mis. LYB, FRS, CFY">
            <Input placeholder="mis. CFY" maxLength={20} />
          </Form.Item>
          <Form.Item name="type" label="Tipe" initialValue="maklon"
            tooltip="Maklon = benang dari pelanggan (jasa). Produksi Sendiri = pabrik beli benang & jual kainnya.">
            <Select options={[
              { value: 'maklon', label: 'Maklon (jasa)' },
              { value: 'own', label: 'Produksi Sendiri' },
            ]} />
          </Form.Item>
          <Form.Item name="contact_person" label="Nama Kontak"><Input /></Form.Item>
          <Form.Item name="phone" label="Telepon"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input type="email" /></Form.Item>
          <Form.Item name="address" label="Alamat"><Input.TextArea rows={2} /></Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Status">
              <Select options={[{ value: true, label: 'Aktif' }, { value: false, label: 'Nonaktif' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
