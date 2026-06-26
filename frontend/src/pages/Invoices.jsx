import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Select, DatePicker, InputNumber, Alert,
  Space, Typography, message, Tag, Descriptions, Divider,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLOR = {
  draft: 'default', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'orange',
};
const fmt = (v) => `Rp ${Number(v).toLocaleString('id-ID')}`;
const STATUS_FLOW = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [genOpen, setGenOpen]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [preview, setPreview]   = useState(null);
  const [detail, setDetail]     = useState(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/invoices'), api.get('/customers')])
      .then(([inv, c]) => { setInvoices(inv.data); setCustomers(c.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openGen() {
    form.resetFields();
    form.setFieldsValue({ month: dayjs(), invoice_date: dayjs(), tax_percent: 0 });
    setPreview(null);
    setGenOpen(true);
  }

  // Build period from the selected month
  function periodFromForm(values) {
    const start = values.month.startOf('month').format('YYYY-MM-DD');
    const end = values.month.endOf('month').format('YYYY-MM-DD');
    return { period_start: start, period_end: end };
  }

  async function doPreview() {
    const values = await form.validateFields(['customer_id', 'month']);
    try {
      const { data } = await api.post('/invoices/preview', {
        customer_id: values.customer_id, ...periodFromForm(values),
      });
      setPreview(data);
    } catch (err) {
      message.error(err.response?.data?.error || 'Preview failed');
    }
  }

  async function doGenerate() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/invoices/generate', {
        customer_id: values.customer_id,
        ...periodFromForm(values),
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
        tax_percent: values.tax_percent,
      });
      message.success('Invoice generated');
      setGenOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to generate');
    } finally { setSaving(false); }
  }

  async function changeStatus(id, status) {
    const paid_date = status === 'paid' ? dayjs().format('YYYY-MM-DD') : null;
    await api.patch(`/invoices/${id}/status`, { status, paid_date });
    message.success(`Marked ${status}`);
    load();
  }

  async function openDetail(id) {
    const { data } = await api.get(`/invoices/${id}`);
    setDetail(data);
  }

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', width: 130 },
    { title: 'Customer', dataIndex: 'customer_name', ellipsis: true },
    { title: 'Period', key: 'period', width: 170,
      render: (_, r) => `${dayjs(r.period_start).format('DD MMM')} – ${dayjs(r.period_end).format('DD MMM YYYY')}` },
    { title: 'Date', dataIndex: 'invoice_date', width: 120, render: d => dayjs(d).format('DD MMM YYYY') },
    { title: 'Total', dataIndex: 'total_amount', width: 150, align: 'right', render: fmt },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
    {
      title: '', key: 'actions', width: 220,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openDetail(row.id)}>View</Button>
          {isAdmin && (
            <Select size="small" style={{ width: 110 }} value={row.status}
              onChange={(s) => changeStatus(row.id, s)}
              options={STATUS_FLOW.map(s => ({ value: s, label: s }))} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Invoices</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openGen}>Generate Invoice</Button>}
      </Space>

      <Table dataSource={invoices} columns={columns} rowKey="id" loading={loading} size="small" />

      {/* Generate modal with preview */}
      <Modal title="Generate Monthly Invoice" open={genOpen} onCancel={() => setGenOpen(false)}
        confirmLoading={saving} width={620}
        footer={[
          <Button key="cancel" onClick={() => setGenOpen(false)}>Cancel</Button>,
          <Button key="preview" onClick={doPreview}>Preview</Button>,
          <Button key="gen" type="primary" loading={saving} onClick={doGenerate}
            disabled={!preview || preview.lines.length === 0}>Generate</Button>,
        ]}>
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]} style={{ flex: 1, minWidth: 220 }}>
              <Select showSearch optionFilterProp="label" style={{ width: 220 }}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                onChange={() => setPreview(null)} />
            </Form.Item>
            <Form.Item name="month" label="Month" rules={[{ required: true }]}>
              <DatePicker picker="month" onChange={() => setPreview(null)} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="tax_percent" label="Tax (%)">
              <InputNumber min={0} max={100} />
            </Form.Item>
          </Space>
        </Form>

        {preview && (
          <>
            <Divider>Preview</Divider>
            {preview.missing_rates?.length > 0 && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message={`No rate set for: ${preview.missing_rates.join(', ')} — these are excluded. Set rates in Customers → Rates.`} />
            )}
            {preview.lines.length === 0
              ? <Alert type="info" message="No billable production for this customer in this month." />
              : (
                <Table size="small" pagination={false} rowKey="fabric_type_id"
                  dataSource={preview.lines}
                  columns={[
                    { title: 'Fabric Type', dataIndex: 'fabric_type' },
                    { title: 'Rolls', dataIndex: 'total_rolls', align: 'right' },
                    { title: 'KG', dataIndex: 'total_kg', align: 'right', render: v => Number(v).toLocaleString('id-ID') },
                    { title: 'Rate/kg', dataIndex: 'rate_per_kg', align: 'right', render: fmt },
                    { title: 'Amount', dataIndex: 'amount', align: 'right', render: fmt },
                  ]}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell colSpan={4}><b>Subtotal</b></Table.Summary.Cell>
                      <Table.Summary.Cell align="right"><b>{fmt(preview.subtotal)}</b></Table.Summary.Cell>
                    </Table.Summary.Row>
                  )} />
              )}
          </>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal title={`Invoice ${detail?.invoice_number}`} open={!!detail}
        onCancel={() => setDetail(null)} footer={null} width={640}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Customer">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[detail.status]}>{detail.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Period">{dayjs(detail.period_start).format('DD MMM')} – {dayjs(detail.period_end).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Invoice Date">{dayjs(detail.invoice_date).format('DD MMM YYYY')}</Descriptions.Item>
            </Descriptions>
            <Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="id"
              dataSource={detail.lines}
              columns={[
                { title: 'Fabric Type', dataIndex: 'fabric_type' },
                { title: 'KG', dataIndex: 'total_kg', align: 'right', render: v => Number(v).toLocaleString('id-ID') },
                { title: 'Rate/kg', dataIndex: 'rate_per_kg', align: 'right', render: fmt },
                { title: 'Amount', dataIndex: 'amount', align: 'right', render: fmt },
              ]}
              summary={() => (
                <>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3}>Subtotal</Table.Summary.Cell>
                    <Table.Summary.Cell align="right">{fmt(detail.subtotal)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3}>Tax ({detail.tax_percent}%)</Table.Summary.Cell>
                    <Table.Summary.Cell align="right">{fmt(detail.tax_amount)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3}><b>Total</b></Table.Summary.Cell>
                    <Table.Summary.Cell align="right"><b>{fmt(detail.total_amount)}</b></Table.Summary.Cell>
                  </Table.Summary.Row>
                </>
              )} />
          </>
        )}
      </Modal>
    </>
  );
}
