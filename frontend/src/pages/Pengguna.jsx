import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch,
  Space, Typography, message, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABEL = { owner: 'Owner (Pemilik)', admin: 'Admin', hr: 'HR' };
const ROLE_COLOR = { owner: 'gold', admin: 'blue', hr: 'green' };

export default function Pengguna() {
  const { isOwner } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get('/users').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Owner boleh membuat/menetapkan semua peran; HR hanya admin & hr
  const roleOptions = (isOwner ? ['owner', 'admin', 'hr'] : ['admin', 'hr'])
    .map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  function openNew() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'admin', is_active: true });
    setOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      email: row.email,
      role: row.role,
      is_active: row.is_active,
      password: '',
    });
    setOpen(true);
  }

  async function save() {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: v.name, role: v.role, is_active: v.is_active };
        if (v.password) payload.password = v.password;
        await api.put(`/users/${editing.id}`, payload);
        message.success('Pengguna diperbarui');
      } else {
        await api.post('/users', {
          name: v.name, email: v.email, password: v.password, role: v.role,
        });
        message.success('Pengguna ditambahkan');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  const columns = [
    { title: 'Nama', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Peran', dataIndex: 'role', width: 160,
      render: (r) => <Tag color={ROLE_COLOR[r]}>{ROLE_LABEL[r] || r}</Tag> },
    { title: 'Status', dataIndex: 'is_active', width: 100,
      render: (a) => a ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag> },
    { title: 'Dibuat', dataIndex: 'created_at', width: 130,
      render: (d) => dayjs(d).format('DD MMM YYYY') },
    {
      title: '', key: 'a', width: 80, align: 'right',
      render: (_, row) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Kelola Pengguna</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Tambah Pengguna</Button>
      </Space>

      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal
        title={editing ? `Ubah ${editing.name}` : 'Tambah Pengguna'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="Nama lengkap" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email valid wajib diisi' }]}>
            <Input placeholder="email@perusahaan.com" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'Password baru (kosongkan bila tidak diubah)' : 'Password'}
            rules={editing ? [] : [{ required: true, min: 6, message: 'Minimal 6 karakter' }]}
          >
            <Input.Password placeholder={editing ? '••••••' : 'Minimal 6 karakter'} />
          </Form.Item>
          <Form.Item name="role" label="Peran" rules={[{ required: true }]}>
            <Select options={roleOptions} />
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
