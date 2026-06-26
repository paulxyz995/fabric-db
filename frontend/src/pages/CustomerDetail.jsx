import React, { useEffect, useState } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  Space, Typography, message, Tag, Popconfirm, Breadcrumb,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { exportReport } from '../utils/pdf';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');
const money = (v) => `Rp ${fmt(v)}`;

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [fabricTypes, setFabricTypes] = useState([]);

  // Per-month PDF download (with preview)
  const [dlOpen, setDlOpen] = useState(false);
  const [dlType, setDlType] = useState('yarn'); // 'yarn' | 'production'
  const [dlMonth, setDlMonth] = useState(dayjs());
  const [dlBusy, setDlBusy] = useState(false);
  const [preview, setPreview] = useState(null); // report payload, set after Preview

  useEffect(() => {
    api.get(`/customers/${id}`).then(r => setCustomer(r.data));
    api.get('/fabric-types').then(r => setFabricTypes(r.data));
  }, [id]);

  function openDownload(type) { setDlType(type); setDlMonth(dayjs()); setPreview(null); setDlOpen(true); }

  // Build the report payload for the chosen month (used by preview + export)
  async function buildReport() {
    const month = dlMonth.format('YYYY-MM');
    const periodLabel = dlMonth.format('MMMM YYYY');
    const from = dlMonth.startOf('month').format('YYYY-MM-DD');
    const to = dlMonth.endOf('month').format('YYYY-MM-DD');

    const summaryRes = await api.get(`/customers/${id}/monthly-summary`);
    const monthRow = summaryRes.data.find((r) => dayjs(r.month).format('YYYY-MM') === month);

    if (dlType === 'yarn') {
      const det = await api.get('/yarn-receipts', { params: { customer_id: id, from, to } });
      const sorted = [...det.data].sort((a, b) => dayjs(a.received_date) - dayjs(b.received_date));
      return {
        title: 'Yarn Log', customerName: customer?.name || '',
        shortCode: customer?.short_code || customer?.code, monthKey: month, periodLabel,
        summary: monthRow ? [monthRow] : [],
        detailTitle: 'Yarn Receipts (BENANG MASUK)',
        detailHead: ['Date', 'Source', 'Yarn Type', 'Bales', 'KG'],
        detailBody: sorted.map((r) => [
          dayjs(r.received_date).format('DD MMM YYYY'),
          r.source === 'purchased' ? 'Bought' : 'Customer',
          r.yarn_type, r.bale_count ?? '', fmt(r.quantity_kg),
        ]),
      };
    }
    const det = await api.get('/production', { params: { customer_id: id, month } });
    const sorted = [...det.data].sort((a, b) => dayjs(a.production_date) - dayjs(b.production_date));
    return {
      title: 'Already Sent', customerName: customer?.name || '',
      shortCode: customer?.short_code || customer?.code, monthKey: month, periodLabel,
      summary: monthRow ? [monthRow] : [],
      detailTitle: 'Production Log (HASIL JADI)',
      detailHead: ['Date', 'Fabric', 'Rolls', 'KG'],
      detailBody: sorted.map((r) => [
        dayjs(r.production_date).format('DD MMM YYYY'), r.fabric_type,
        fmt(r.roll_count), fmt(r.fabric_kg),
      ]),
    };
  }

  async function doPreview() {
    setDlBusy(true);
    try {
      const rpt = await buildReport();
      if (rpt.detailBody.length === 0 && rpt.summary.length === 0) {
        message.warning('No data for that month'); setPreview(null); return;
      }
      setPreview(rpt);
    } catch (err) {
      message.error(err.response?.data?.error || 'Preview failed');
    } finally { setDlBusy(false); }
  }

  function doExport() {
    if (preview) exportReport(preview);
    setDlOpen(false);
  }

  return (
    <>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/customers')}>Customers</a> }, { title: customer?.name || '…' }]} />
      <Space style={{ marginBottom: 16 }} align="center" wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')} />
        <Typography.Title level={4} style={{ margin: 0 }}>{customer?.name}</Typography.Title>
        <Tag>{customer?.code}</Tag>
        {customer?.short_code && <Tag color="blue">{customer.short_code}</Tag>}
        <Button icon={<FilePdfOutlined />} onClick={() => openDownload('yarn')}>Download Yarn Log</Button>
        <Button icon={<FilePdfOutlined />} onClick={() => openDownload('production')}>Download Already sent</Button>
      </Space>

      <Modal
        title={dlType === 'yarn' ? 'Download Yarn Log' : 'Download Already Sent'}
        open={dlOpen} onCancel={() => setDlOpen(false)} width={preview ? 760 : 460}
        footer={[
          <Button key="cancel" onClick={() => setDlOpen(false)}>Cancel</Button>,
          <Button key="preview" loading={dlBusy} onClick={doPreview}>Preview</Button>,
          <Button key="dl" type="primary" disabled={!preview} onClick={doExport}>Download PDF</Button>,
        ]}>
        <Space align="center" wrap style={{ marginBottom: 8 }}>
          <Typography.Text>Month:</Typography.Text>
          <DatePicker picker="month" value={dlMonth} allowClear={false}
            onChange={(m) => { setDlMonth(m); setPreview(null); }} />
          <Typography.Text type="secondary">Pick a month, then Preview.</Typography.Text>
        </Space>

        {preview && (
          <div style={{ marginTop: 12 }}>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>
              {preview.title} — {preview.periodLabel}
            </Typography.Title>
            <Typography.Text strong>Leftover (SISA)</Typography.Text>
            <Table size="small" pagination={false} style={{ marginTop: 4, marginBottom: 16 }}
              dataSource={preview.summary} rowKey="month"
              columns={[
                { title: 'Month', dataIndex: 'month', render: m => dayjs(m).format('MMM YYYY') },
                { title: 'Opening', dataIndex: 'opening_kg', align: 'right', render: fmt },
                { title: 'Yarn In', dataIndex: 'yarn_in_kg', align: 'right', render: fmt },
                { title: 'Sent', dataIndex: 'sent_kg', align: 'right', render: fmt },
                { title: 'Rolls', dataIndex: 'sent_rolls', align: 'right', render: fmt },
                { title: 'Net', dataIndex: 'net_kg', align: 'right',
                  render: v => <span style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>{fmt(v)}</span> },
                { title: 'Closing', dataIndex: 'leftover_kg', align: 'right', render: fmt },
              ]}
              locale={{ emptyText: 'No leftover row for this month' }} />
            <Typography.Text strong>{preview.detailTitle} ({preview.detailBody.length} rows)</Typography.Text>
            <Table size="small" style={{ marginTop: 4 }} scroll={{ y: 240 }}
              pagination={false}
              dataSource={preview.detailBody.map((row, i) => ({ key: i, row }))}
              columns={preview.detailHead.map((h, ci) => ({
                title: h, dataIndex: 'row',
                align: ci === 0 ? 'left' : 'right',
                render: (row) => row[ci],
              }))}
              locale={{ emptyText: 'No detail rows for this month' }} />
          </div>
        )}
      </Modal>

      <Tabs defaultActiveKey="production" items={[
        { key: 'production', label: 'Already sent',  children: <ProductionTab customerId={id} customerName={customer?.name} fabricTypes={fabricTypes} isAdmin={isAdmin} /> },
        { key: 'yarn',       label: 'Yarn Log',      children: <YarnTab customerId={id} customerName={customer?.name} isAdmin={isAdmin} /> },
        { key: 'leftover',   label: 'Leftover (SISA)', children: <LeftoverTab customerId={id} isAdmin={isAdmin} /> },
        { key: 'rates',      label: 'Maklon Rates',  children: <RatesTab customerId={id} fabricTypes={fabricTypes} isAdmin={isAdmin} /> },
        { key: 'summary',    label: 'Summary',       children: <SummaryTab customerId={id} /> },
      ]} />
    </>
  );
}

// ---------------- Production tab ----------------
function ProductionTab({ customerId, fabricTypes, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    const params = { customer_id: customerId };
    if (month) params.month = month.format('YYYY-MM');
    api.get('/production', { params }).then(r => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [customerId, month]);

  function openAdd() { setEditing(null); form.resetFields(); form.setFieldsValue({ production_date: dayjs(), roll_count: 0 }); setOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue({ ...row, production_date: dayjs(row.production_date) }); setOpen(true); }

  async function save() {
    const v = await form.validateFields();
    const payload = { ...v, customer_id: Number(customerId), production_date: v.production_date?.format('YYYY-MM-DD') };
    try {
      if (editing) await api.put(`/production/${editing.id}`, payload);
      else await api.post('/production', payload);
      message.success(editing ? 'Updated' : 'Added'); setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }
  async function del(rid) {
    try { await api.delete(`/production/${rid}`); message.success('Deleted'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }

  const columns = [
    { title: 'Date', dataIndex: 'production_date', width: 120,
      render: d => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.production_date).valueOf() - dayjs(b.production_date).valueOf() },
    { title: 'Fabric (NAMA KAIN)', dataIndex: 'fabric_type', width: 160 },
    { title: 'Roll', dataIndex: 'roll_count', width: 80, align: 'right', render: fmt },
    { title: 'KG', dataIndex: 'fabric_kg', width: 110, align: 'right', render: fmt },
    { title: 'Notes', dataIndex: 'notes', ellipsis: true },
    ...(isAdmin ? [{ title: '', key: 'a', width: 90, render: (_, row) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        <Popconfirm title="Delete?" onConfirm={() => del(row.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>) }] : []),
  ];

  const totKg = rows.reduce((s, r) => s + Number(r.fabric_kg), 0);
  const totRoll = rows.reduce((s, r) => s + Number(r.roll_count), 0);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Production</Button>}
        <DatePicker picker="month" placeholder="Filter month" value={month} onChange={setMonth} />
        <Typography.Text type="secondary">{rows.length} rows · {fmt(totRoll)} rolls · {fmt(totKg)} kg</Typography.Text>
      </Space>
      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? 'Edit Production' : 'Add Production'} open={open} onOk={save} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="production_date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fabric_type_id" label="Fabric Type" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={fabricTypes.map(f => ({ value: f.id, label: f.name }))} />
          </Form.Item>
          <Form.Item name="roll_count" label="Roll Count (gulungan)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fabric_kg" label="Fabric KG" rules={[{ required: true }]}><InputNumber min={0.001} step={0.001} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ---------------- Yarn tab ----------------
function YarnTab({ customerId, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    const params = { customer_id: customerId };
    if (month) {
      params.from = month.startOf('month').format('YYYY-MM-DD');
      params.to = month.endOf('month').format('YYYY-MM-DD');
    }
    api.get('/yarn-receipts', { params }).then(r => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [customerId, month]);

  function openAdd() { setEditing(null); form.resetFields(); form.setFieldsValue({ received_date: dayjs(), source: 'customer' }); setOpen(true); }
  function openEdit(row) { setEditing(row); form.setFieldsValue({ ...row, received_date: dayjs(row.received_date) }); setOpen(true); }

  async function save() {
    const v = await form.validateFields();
    const payload = { ...v, customer_id: Number(customerId), received_date: v.received_date?.format('YYYY-MM-DD') };
    try {
      if (editing) await api.put(`/yarn-receipts/${editing.id}`, payload);
      else await api.post('/yarn-receipts', payload);
      message.success(editing ? 'Updated' : 'Logged'); setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }
  async function del(rid) {
    try { await api.delete(`/yarn-receipts/${rid}`); message.success('Deleted'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }

  const columns = [
    { title: 'Date', dataIndex: 'received_date', width: 115,
      render: d => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.received_date).valueOf() - dayjs(b.received_date).valueOf() },
    { title: 'Source', dataIndex: 'source', width: 100, render: s => <Tag color={s === 'purchased' ? 'orange' : 'blue'}>{s === 'purchased' ? 'Bought' : 'Customer'}</Tag> },
    { title: 'Yarn (BENANG MASUK)', dataIndex: 'yarn_type', width: 220, ellipsis: true },
    { title: 'Bales', dataIndex: 'bale_count', width: 90, align: 'right', render: v => v ?? '—' },
    { title: 'KG', dataIndex: 'quantity_kg', width: 120, align: 'right', render: fmt },
    { title: 'DO/Challan', dataIndex: 'delivery_note', ellipsis: true, render: v => v || '—' },
    ...(isAdmin ? [{ title: '', key: 'a', width: 90, render: (_, row) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        <Popconfirm title="Delete?" onConfirm={() => del(row.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>) }] : []),
  ];

  const totKg = rows.reduce((s, r) => s + Number(r.quantity_kg), 0);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Log Yarn</Button>}
        <DatePicker picker="month" placeholder="Filter month" value={month} onChange={setMonth} />
        <Typography.Text type="secondary">{rows.length} receipts · {fmt(totKg)} kg</Typography.Text>
      </Space>
      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? 'Edit Yarn Receipt' : 'Log Yarn Receipt'} open={open} onOk={save} onCancel={() => setOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="received_date" label="Received Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="source" label="Source">
            <Select options={[{ value: 'customer', label: 'Sent by customer' }, { value: 'purchased', label: 'Bought by factory (BELI BENANG)' }]} />
          </Form.Item>
          <Form.Item name="yarn_type" label="Yarn Type" rules={[{ required: true }]}><Input placeholder="e.g. PE 30S, DTY 75/36" /></Form.Item>
          <Form.Item name="bale_count" label="Bale / Cone Count"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="quantity_kg" label="Quantity (kg)" rules={[{ required: true }]}><InputNumber min={0.001} step={0.001} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="delivery_note" label="DO / Challan No."><Input /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ---------------- Rates tab ----------------
function RatesTab({ customerId, fabricTypes, isAdmin }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get(`/customers/${customerId}/rates`).then(r => setRates(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [customerId]);
  useEffect(() => { form.setFieldsValue({ effective_from: dayjs() }); }, []);

  async function add() {
    const v = await form.validateFields();
    try {
      await api.post(`/customers/${customerId}/rates`, { ...v, effective_from: v.effective_from?.format('YYYY-MM-DD') });
      message.success('Rate added'); form.resetFields(); form.setFieldsValue({ effective_from: dayjs() }); load();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }

  const columns = [
    { title: 'Fabric Type', dataIndex: 'fabric_type_name', render: v => v || <i>All types</i> },
    { title: 'Rate/kg', dataIndex: 'rate_per_kg', align: 'right', render: money },
    { title: 'From', dataIndex: 'effective_from', render: d => dayjs(d).format('DD MMM YYYY') },
    { title: 'To', dataIndex: 'effective_to', render: d => d ? dayjs(d).format('DD MMM YYYY') : <Tag color="green">Active</Tag> },
  ];

  return (
    <>
      {isAdmin && (
        <Form form={form} layout="inline" style={{ marginBottom: 16, rowGap: 8, flexWrap: 'wrap' }}>
          <Form.Item name="fabric_type_id" label="Fabric">
            <Select allowClear placeholder="All types" style={{ width: 160 }} options={fabricTypes.map(f => ({ value: f.id, label: f.name }))} />
          </Form.Item>
          <Form.Item name="rate_per_kg" label="Rate/kg" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 120 }} /></Form.Item>
          <Form.Item name="effective_from" label="From"><DatePicker /></Form.Item>
          <Form.Item><Button type="primary" onClick={add}>Add Rate</Button></Form.Item>
        </Form>
      )}
      <Table dataSource={rates} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
    </>
  );
}

// ---------------- Summary tab ----------------
function SummaryTab({ customerId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/production/summary', { params: { customer_id: customerId } })
      .then(r => setRows(r.data)).finally(() => setLoading(false));
  }, [customerId]);

  const columns = [
    { title: 'Month', dataIndex: 'period_month', width: 140, render: d => dayjs(d).format('MMM YYYY') },
    { title: 'Fabric Type', dataIndex: 'fabric_type' },
    { title: 'Entries', dataIndex: 'entry_count', align: 'right', width: 90 },
    { title: 'Rolls', dataIndex: 'total_rolls', align: 'right', width: 100, render: fmt },
    { title: 'Total KG', dataIndex: 'total_kg', align: 'right', width: 120, render: fmt },
  ];

  return <Table dataSource={rows} columns={columns} rowKey={(r) => `${r.period_month}-${r.fabric_type_id}`}
    loading={loading} size="small" />;
}

// ---------------- Leftover (SISA) tab ----------------
function LeftoverTab({ customerId, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get(`/customers/${customerId}/monthly-summary`)
      .then(r => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [customerId]);

  function openSet() {
    form.resetFields();
    form.setFieldsValue({ month: dayjs(), opening_kg: 0 });
    setOpen(true);
  }
  async function saveOpening() {
    const v = await form.validateFields();
    try {
      await api.post(`/customers/${customerId}/opening`, {
        month: v.month.format('YYYY-MM'), opening_kg: v.opening_kg,
      });
      message.success('Opening SISA set');
      setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }
  async function clearOpening(month) {
    try {
      await api.delete(`/customers/${customerId}/opening/${dayjs(month).format('YYYY-MM')}`);
      message.success('Opening override removed'); load();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }

  const columns = [
    { title: 'Month', dataIndex: 'month', width: 110, render: m => dayjs(m).format('MMM YYYY') },
    { title: 'Opening', dataIndex: 'opening_kg', align: 'right',
      render: (v, row) => row.is_opening_set
        ? <span><b>{fmt(v)}</b> <Tag color="gold" style={{ marginLeft: 4 }}>set</Tag></span>
        : fmt(v) },
    { title: 'Yarn In', dataIndex: 'yarn_in_kg', align: 'right', render: fmt },
    { title: 'Sent (kg)', dataIndex: 'sent_kg', align: 'right', render: fmt },
    { title: 'Rolls', dataIndex: 'sent_rolls', align: 'right', render: fmt },
    { title: 'Net', dataIndex: 'net_kg', align: 'right',
      render: v => <span style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>{fmt(v)}</span> },
    { title: 'Closing (SISA)', dataIndex: 'leftover_kg', align: 'right',
      render: v => <b style={{ color: v < 0 ? '#ff4d4f' : '#1677ff' }}>{fmt(v)}</b> },
    ...(isAdmin ? [{ title: '', key: 'a', width: 70,
      render: (_, row) => row.is_opening_set
        ? <Popconfirm title="Remove this opening override?" onConfirm={() => clearOpening(row.month)}>
            <Button size="small" type="link" danger>clear</Button>
          </Popconfirm>
        : null }] : []),
  ];

  return (
    <>
      <Typography.Paragraph type="secondary">
        <b>Opening</b> = leftover yarn carried from last month (auto-carried, or admin-set as a baseline).
        <b> Closing (SISA)</b> = opening + yarn in − sent, carried into next month.
      </Typography.Paragraph>
      {isAdmin && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openSet} style={{ marginBottom: 12 }}>
          Set Opening SISA
        </Button>
      )}
      <Table dataSource={rows} columns={columns} rowKey="month" loading={loading} size="small" pagination={false} />

      <Modal title="Set Opening SISA (leftover yarn)" open={open} onOk={saveOpening} onCancel={() => setOpen(false)} okText="Save">
        <Typography.Paragraph type="secondary">
          Enter the leftover yarn carried into the start of this month. It becomes the baseline and carries forward.
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item name="month" label="Month" rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
          <Form.Item name="opening_kg" label="Opening SISA (kg)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
