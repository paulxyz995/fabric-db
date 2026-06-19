import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    api.get('/customers').then(r => setCustomers(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function onSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/customers', values);
      message.success('Customer added');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { title: 'Code',    dataIndex: 'code',           width: 120 },
    { title: 'Name',    dataIndex: 'name',           ellipsis: true },
    { title: 'Contact', dataIndex: 'contact_person', ellipsis: true },
    { title: 'Phone',   dataIndex: 'phone' },
    { title: 'Email',   dataIndex: 'email',          ellipsis: true },
    {
      title: 'Status', dataIndex: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
      width: 100,
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Customers</Typography.Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add Customer
          </Button>
        )}
      </Space>

      <Table
        dataSource={customers}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
      />

      <Modal
        title="Add Customer"
        open={modalOpen}
        onOk={onSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Customer Code" rules={[{ required: true }]}>
            <Input placeholder="CUST-004" />
          </Form.Item>
          <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_person" label="Contact Person">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
