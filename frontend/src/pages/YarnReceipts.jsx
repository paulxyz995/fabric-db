import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Typography, message, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

export default function YarnReceipts() {
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/yarn-receipts'), api.get('/customers')])
      .then(([r, c]) => { setReceipts(r.data); setCustomers(c.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function onSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/yarn-receipts', {
        ...values,
        received_date: values.received_date?.format('YYYY-MM-DD'),
      });
      message.success('Yarn receipt logged');
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
    { title: 'Receipt #',  dataIndex: 'receipt_number', width: 140 },
    { title: 'Customer',   dataIndex: 'customer_name',  ellipsis: true },
    { title: 'Date',       dataIndex: 'received_date',  width: 120, render: (d) => dayjs(d).format('DD MMM YYYY') },
    { title: 'Yarn Type',  dataIndex: 'yarn_type' },
    { title: 'Color',      dataIndex: 'yarn_color' },
    { title: 'Qty (kg)',   dataIndex: 'quantity_kg',    width: 110, render: (v) => Number(v).toLocaleString('id-ID') },
    { title: 'Challan',    dataIndex: 'delivery_note',  ellipsis: true },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Yarn Receipts</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Log Receipt
        </Button>
      </Space>

      <Table dataSource={receipts} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal
        title="Log Yarn Receipt"
        open={modalOpen}
        onOk={onSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" initialValues={{ received_date: dayjs() }}>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={customers.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="received_date" label="Received Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="yarn_type" label="Yarn Type" rules={[{ required: true }]}>
            <Input placeholder="e.g. Cotton 30s" />
          </Form.Item>
          <Form.Item name="yarn_color" label="Color">
            <Input placeholder="e.g. White" />
          </Form.Item>
          <Form.Item name="quantity_kg" label="Quantity (kg)" rules={[{ required: true }]}>
            <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="delivery_note" label="Customer Challan / DN No.">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
