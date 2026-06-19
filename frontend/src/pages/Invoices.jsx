import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Select, DatePicker, InputNumber,
  Space, Typography, message, Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLOR = {
  draft: 'default', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'orange',
};

const fmt = (v) => `Rp ${Number(v).toLocaleString('id-ID')}`;

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/invoices'), api.get('/production-jobs?status=completed')])
      .then(([inv, j]) => { setInvoices(inv.data); setJobs(j.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function createInvoice() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/invoices', {
        ...values,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
      });
      message.success('Invoice created');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to create invoice');
    } finally { setSaving(false); }
  }

  async function markPaid(id) {
    await api.patch(`/invoices/${id}/status`, { status: 'paid', paid_date: dayjs().format('YYYY-MM-DD') });
    message.success('Marked as paid');
    load();
  }

  const columns = [
    { title: 'Invoice #',    dataIndex: 'invoice_number',  width: 140 },
    { title: 'Customer',     dataIndex: 'customer_name',   ellipsis: true },
    { title: 'Job #',        dataIndex: 'job_number',      width: 130 },
    { title: 'Date',         dataIndex: 'invoice_date',    width: 120, render: d => dayjs(d).format('DD MMM YYYY') },
    { title: 'Due',          dataIndex: 'due_date',        width: 120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title: 'Fabric (kg)',  dataIndex: 'fabric_kg',       width: 110, render: v => Number(v).toLocaleString('id-ID') },
    { title: 'Rate/kg',      dataIndex: 'rate_per_kg',     width: 110, render: v => fmt(v) },
    { title: 'Total',        dataIndex: 'total_amount',    width: 150, render: v => fmt(v) },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: s => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: '', key: 'actions', width: 90,
      render: (_, row) =>
        isAdmin && row.status === 'sent'
          ? <Button size="small" type="primary" onClick={() => markPaid(row.id)}>Mark Paid</Button>
          : null,
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Invoices</Typography.Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Generate Invoice
          </Button>
        )}
      </Space>

      <Table dataSource={invoices} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal
        title="Generate Invoice"
        open={modalOpen}
        onOk={createInvoice}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" initialValues={{ invoice_date: dayjs(), tax_percent: 11 }}>
          <Form.Item name="production_job_id" label="Completed Job" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              options={jobs.map(j => ({ value: j.id, label: `${j.job_number} — ${j.customer_name} (${Number(j.total_fabric_kg).toLocaleString('id-ID')} kg)` }))}
            />
          </Form.Item>
          <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="due_date" label="Due Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tax_percent" label="Tax (%)">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Form.Item name="notes"><span /></Form.Item>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
