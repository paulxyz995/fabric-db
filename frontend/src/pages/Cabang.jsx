import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Switch, Space, Typography, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function Cabang() {
  const { canWriteOps } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get('/branches').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true }); setOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue(row); setOpen(true); }

  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api.put(`/branches/${editing.id}`, v);
      else await api.post('/branches', v);
      message.success(editing ? 'Diperbarui' : 'Ditambahkan');
      setOpen(false); load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal');
    } finally { setSaving(false); }
  }

  async function del(id) {
    try { await api.delete(`/branches/${id}`); message.success('Dihapus'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const columns = [
    { title: 'Nama Cabang', dataIndex: 'name' },
    { title: 'Status', dataIndex: 'is_active', width: 110,
      render: (a) => a ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag> },
    ...(canWriteOps ? [{
      title: '', key: 'a', width: 100, align: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Hapus cabang ini?" okText="Hapus" cancelText="Batal" onConfirm={() => del(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Cabang Produksi</Typography.Title>
        {canWriteOps && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Tambah Cabang</Button>}
      </Space>

      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />

      <Modal title={editing ? 'Ubah Cabang' : 'Tambah Cabang'} open={open}
        onOk={save} onCancel={() => setOpen(false)} confirmLoading={saving} okText="Simpan" cancelText="Batal">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama Cabang" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="mis. Cabang Bandung" />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Aktif" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
