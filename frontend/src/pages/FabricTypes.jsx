import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function FabricTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    api.get('/fabric-types').then(r => setTypes(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setEditing(null); form.resetFields(); setModalOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue(row); setModalOpen(true); }

  async function onSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api.put(`/fabric-types/${editing.id}`, values);
      else await api.post('/fabric-types', values);
      message.success(editing ? 'Diperbarui' : 'Ditambahkan');
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal');
    } finally { setSaving(false); }
  }

  async function onDelete(id) {
    try {
      await api.delete(`/fabric-types/${id}`);
      message.success('Dihapus');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal');
    }
  }

  const columns = [
    { title: 'Jenis Kain', dataIndex: 'name', width: 200 },
    { title: 'Keterangan', dataIndex: 'description', ellipsis: true },
    ...(isAdmin ? [{
      title: '', key: 'actions', width: 120,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Hapus jenis kain ini?" okText="Hapus" cancelText="Batal" onConfirm={() => onDelete(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Jenis Kain</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Tambah Jenis Kain</Button>}
      </Space>

      <Table dataSource={types} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? 'Ubah Jenis Kain' : 'Tambah Jenis Kain'} open={modalOpen}
        onOk={onSave} onCancel={() => setModalOpen(false)} confirmLoading={saving}
        okText="Simpan" cancelText="Batal">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="mis. LOTTO, HYGET, RIB" />
          </Form.Item>
          <Form.Item name="description" label="Keterangan">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
