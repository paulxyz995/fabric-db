import React, { useEffect, useState } from 'react';
import {
  Table, Button, Drawer, Modal, Form, Input, Select, DatePicker,
  Space, Typography, message, Tag, Popconfirm, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FilePdfOutlined,
  PrinterOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { exportSuratJalan, rincianGrid } from '../utils/suratJalanPdf';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');

// Parse a free-text rincian box ("22.05 22.50, 22.3 ...") into clean weights.
function parseItems(text) {
  if (!text) return [];
  return String(text)
    .split(/[\s,;]+/)
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n * 1000) / 1000);
}
const itemsToText = (items) =>
  (Array.isArray(items) ? items : [])
    .map((v) => (typeof v === 'object' && v !== null ? v.kg : v))
    .join('\n');

// ---------- On-screen rendering of the surat jalan (mirrors the PDF) ----------
function SuratJalanDoc({ sj, company = 'MAKLOON' }) {
  const { matrix } = rincianGrid(sj.items);
  const cellStyle = { border: '1px solid #888', padding: '4px 8px', textAlign: 'center', minWidth: 60 };
  const fieldLabel = { fontWeight: 600, paddingRight: 6, whiteSpace: 'nowrap' };
  return (
    <div style={{ background: '#fff', color: '#000', padding: 24, fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>SURAT JALAN</div>
        <div style={{ fontSize: 12 }}>{company}</div>
      </div>
      <hr style={{ border: 0, borderTop: '1px solid #999', margin: '8px 0 14px' }} />

      <table style={{ width: '100%', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={fieldLabel}>Surat Jalan No</td>
            <td style={{ width: '40%' }}>: <b>{sj.number || '—'}</b></td>
            <td style={fieldLabel}>Tanggal</td>
            <td>: {sj.tanggal ? dayjs(sj.tanggal).format('DD MMMM YYYY') : '—'}</td>
          </tr>
          <tr>
            <td style={fieldLabel}>Jenis Kain</td>
            <td>: {sj.jenis_kain || '—'}</td>
            <td style={fieldLabel}>Kepada</td>
            <td>: {sj.kepada || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginBottom: 6 }}>Rincian (kg)</div>
      <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
        <tbody>
          {matrix.map((line, r) => (
            <tr key={r}>
              {line.map((v, c) => (
                <td key={c} style={cellStyle}>{v == null ? '' : fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 24 }}>
        <span style={{ marginRight: 32 }}>Total</span>
        <span style={{ marginRight: 32 }}>{fmt(sj.total_rolls)} ROLL</span>
        <span>{fmt(sj.total_kg)} KG</span>
      </div>

      {sj.notes ? <div style={{ marginBottom: 16 }}>Catatan: {sj.notes}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div>Tanda Terima,</div>
          <div style={{ marginTop: 48 }}>(________________)</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div>Hormat Kami,</div>
          <div style={{ marginTop: 48 }}>(________________)</div>
        </div>
      </div>
    </div>
  );
}

export default function SuratJalan() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nextNumber, setNextNumber] = useState('');
  const [rincianText, setRincianText] = useState('');
  const [form] = Form.useForm();

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewMode, setPreviewMode] = useState('form'); // 'form' | 'reprint'

  const load = () => {
    setLoading(true);
    api.get('/surat-jalan').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get('/customers').then((r) => setCustomers(r.data));
  }, []);

  const items = parseItems(rincianText);
  const totalRolls = items.length;
  const totalKg = Math.round(items.reduce((s, n) => s + n, 0) * 1000) / 1000;

  function openNew() {
    setEditing(null);
    setRincianText('');
    setNextNumber('');
    form.resetFields();
    form.setFieldsValue({ tanggal: dayjs() });
    setOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setRincianText(itemsToText(row.items));
    setNextNumber(row.number);
    form.setFieldsValue({
      customer_id: row.customer_id ?? undefined,
      prefix: row.prefix,
      jenis_kain: row.jenis_kain,
      kepada: row.kepada,
      tanggal: row.tanggal ? dayjs(row.tanggal) : dayjs(),
      notes: row.notes,
    });
    setOpen(true);
  }

  async function onCustomerChange(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    const prefix = (c.short_code || c.code || '').toUpperCase();
    form.setFieldsValue({ prefix });
    if (!form.getFieldValue('kepada')) form.setFieldsValue({ kepada: c.name });
    if (!editing && prefix) {
      try {
        const r = await api.get('/surat-jalan/next-number', { params: { prefix } });
        setNextNumber(r.data.number);
      } catch { setNextNumber(''); }
    }
  }

  // Build a doc object from the current form for preview
  async function openPreviewFromForm() {
    const v = await form.validateFields();
    if (items.length === 0) { message.warning('Add at least one roll weight in Rincian'); return; }
    setPreviewData({
      number: editing ? editing.number : (nextNumber || `${v.prefix}-…`),
      tanggal: v.tanggal?.format('YYYY-MM-DD'),
      jenis_kain: v.jenis_kain,
      kepada: v.kepada,
      items,
      total_rolls: totalRolls,
      total_kg: totalKg,
      notes: v.notes,
    });
    setPreviewMode('form');
    setOpen(false);        // close drawer so the preview sits cleanly on top
    setPreviewOpen(true);
  }

  function openPreviewFromRow(row) {
    setPreviewData(row);
    setPreviewMode('reprint');
    setPreviewOpen(true);
  }

  async function issueAndPrint() {
    const v = await form.validateFields();
    if (items.length === 0) { message.warning('Add at least one roll weight in Rincian'); return; }
    setSaving(true);
    try {
      const payload = {
        prefix: v.prefix,
        customer_id: v.customer_id || null,
        jenis_kain: v.jenis_kain,
        tanggal: v.tanggal?.format('YYYY-MM-DD'),
        kepada: v.kepada,
        items,
        notes: v.notes,
      };
      let saved;
      if (editing) {
        saved = (await api.put(`/surat-jalan/${editing.id}`, payload)).data;
        message.success(`Updated ${saved.number}`);
      } else {
        saved = (await api.post('/surat-jalan/issue', payload)).data;
        message.success(`Issued ${saved.number}`);
      }
      exportSuratJalan(saved);
      setPreviewOpen(false);
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to issue');
    } finally { setSaving(false); }
  }

  async function del(id) {
    try { await api.delete(`/surat-jalan/${id}`); message.success('Deleted'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  }

  const columns = [
    { title: 'No. Surat Jalan', dataIndex: 'number', width: 150, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Tanggal', dataIndex: 'tanggal', width: 130, render: (d) => dayjs(d).format('DD MMM YYYY') },
    { title: 'Kepada (Tujuan)', dataIndex: 'kepada', ellipsis: true, render: (v) => v || '—' },
    { title: 'Jenis Kain', dataIndex: 'jenis_kain', width: 150, ellipsis: true, render: (v) => v || '—' },
    { title: 'Roll', dataIndex: 'total_rolls', width: 80, align: 'right', render: fmt },
    { title: 'KG', dataIndex: 'total_kg', width: 110, align: 'right', render: fmt },
    {
      title: '', key: 'a', width: 170, align: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openPreviewFromRow(row)} />
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => exportSuratJalan(row)} />
          {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
          {isAdmin && (
            <Popconfirm title="Delete this surat jalan?" onConfirm={() => del(row.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Surat Jalan</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>New Surat Jalan</Button>}
      </Space>

      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Drawer
        title={editing ? `Edit ${editing.number}` : 'New Surat Jalan'}
        width={620} open={open} onClose={() => setOpen(false)}
        extra={
          <Button type="primary" icon={<EyeOutlined />} onClick={openPreviewFromForm}>
            Preview
          </Button>
        }
      >
        {nextNumber && (
          <Alert
            style={{ marginBottom: 16 }} type="info" showIcon
            message={<>Nomor Surat Jalan: <b>{nextNumber}</b></>}
            description={editing ? 'Number stays the same when you save.' : 'Assigned automatically when you Issue & Print. Pick a customer to change the prefix.'}
          />
        )}
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="customer_id" label="Customer (sets prefix)" style={{ flex: 1, minWidth: 260 }}>
              <Select
                showSearch optionFilterProp="label" allowClear
                placeholder="Pick customer"
                onChange={onCustomerChange}
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.short_code || c.code} — ${c.name}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="prefix" label="Prefix (nickname)" rules={[{ required: true, message: 'prefix required' }]} style={{ width: 140 }}
              tooltip="Used as the surat jalan number prefix, e.g. LYB-000001">
              <Input placeholder="LYB" maxLength={20} style={{ textTransform: 'uppercase' }}
                onChange={(e) => {
                  const p = e.target.value.toUpperCase();
                  form.setFieldsValue({ prefix: p });
                  if (!editing && p) api.get('/surat-jalan/next-number', { params: { prefix: p } })
                    .then((r) => setNextNumber(r.data.number)).catch(() => {});
                }} />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]} style={{ width: 180 }}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
            </Form.Item>
            <Form.Item name="jenis_kain" label="Jenis Kain" style={{ flex: 1, minWidth: 240 }}>
              <Input placeholder='e.g. BABYTERRY, Hyget 24"' />
            </Form.Item>
          </Space>

          <Form.Item name="kepada" label="Kepada (Tujuan)" tooltip="Destination / recipient — edit freely">
            <Input placeholder="e.g. CV Tekad Jaya" />
          </Form.Item>

          <Form.Item label={`Rincian — roll weights in kg (${totalRolls} rolls · ${fmt(totalKg)} kg)`}
            tooltip="One weight per roll. Separate with spaces, commas, or new lines. You can paste a column straight from Excel.">
            <Input.TextArea
              rows={8}
              value={rincianText}
              onChange={(e) => setRincianText(e.target.value)}
              placeholder={'22.05\n22.50\n22.30\n...'}
            />
          </Form.Item>

          <Form.Item name="notes" label="Catatan (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="Preview Surat Jalan"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={800}
        zIndex={1100}
        footer={
          previewMode === 'reprint'
            ? [
                <Button key="close" onClick={() => setPreviewOpen(false)}>Close</Button>,
                <Button key="dl" type="primary" icon={<FilePdfOutlined />}
                  onClick={() => { exportSuratJalan(previewData); setPreviewOpen(false); }}>
                  Download PDF
                </Button>,
              ]
            : [
                <Button key="back" onClick={() => { setPreviewOpen(false); setOpen(true); }}>Back to edit</Button>,
                <Button key="print" type="primary" icon={<PrinterOutlined />} loading={saving}
                  onClick={issueAndPrint}>
                  {editing ? 'Save & Print' : 'Issue & Print'}
                </Button>,
              ]
        }
      >
        {previewData && (
          <div style={{ border: '1px solid #eee', maxHeight: '70vh', overflow: 'auto' }}>
            <SuratJalanDoc sj={previewData} />
          </div>
        )}
      </Modal>
    </>
  );
}
