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
      message.success(editing ? 'Updated' : 'Customer added');
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  const columns = [
    { title: 'Code', dataIndex: 'code', width: 110 },
    { title: 'Name', dataIndex: 'name', ellipsis: true,
      render: (v) => <a>{v}</a> },
    { title: 'Short', dataIndex: 'short_code', width: 90,
      render: (v) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Contact', dataIndex: 'contact_person', ellipsis: true },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Status', dataIndex: 'is_active', width: 90,
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    {
      title: '', key: 'actions', width: 130, align: 'right',
      render: (_, row) => (
        <Space onClick={(e) => e.stopPropagation()}>
          {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
          <Button size="small" type="link" onClick={() => navigate(`/customers/${row.id}`)}>
            Open <RightOutlined />
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Customers</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Customer</Button>}
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

      <Modal title={editing ? 'Edit Customer' : 'Add Customer'} open={modalOpen}
        onOk={onSave} onCancel={() => setModalOpen(false)} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Customer Code" rules={[{ required: true }]}>
            <Input placeholder="CUST-006" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Chia Fransdhika Yuan" />
          </Form.Item>
          <Form.Item name="short_code" label="Short Code / Nickname"
            tooltip="Initial used in PDF filenames, e.g. LYB, FRS, CFY">
            <Input placeholder="e.g. CFY" maxLength={20} />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact Person"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input type="email" /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Status">
              <Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
