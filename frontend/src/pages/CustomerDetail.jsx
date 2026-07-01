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
  const { isAdmin, isOwner } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [fabricTypes, setFabricTypes] = useState([]);

  // Unduh PDF per bulan (dengan pratinjau)
  const [dlOpen, setDlOpen] = useState(false);
  const [dlType, setDlType] = useState('yarn'); // 'yarn' | 'production'
  const [dlMonth, setDlMonth] = useState(dayjs());
  const [dlBusy, setDlBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get(`/customers/${id}`).then(r => setCustomer(r.data));
    api.get('/fabric-types').then(r => setFabricTypes(r.data));
  }, [id]);

  function openDownload(type) { setDlType(type); setDlMonth(dayjs()); setPreview(null); setDlOpen(true); }

  // Susun data laporan untuk bulan terpilih (dipakai pratinjau + ekspor)
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
        title: 'Log Benang', customerName: customer?.name || '',
        shortCode: customer?.short_code || customer?.code, monthKey: month, periodLabel,
        summary: monthRow ? [monthRow] : [],
        detailTitle: 'Penerimaan Benang (BENANG MASUK)',
        detailHead: ['Tanggal', 'Sumber', 'Jenis Benang', 'Bal', 'KG'],
        detailBody: sorted.map((r) => [
          dayjs(r.received_date).format('DD MMM YYYY'),
          r.source === 'purchased' ? 'Beli' : 'Pelanggan',
          r.yarn_type, r.bale_count ?? '', fmt(r.quantity_kg),
        ]),
      };
    }
    const det = await api.get('/production', { params: { customer_id: id, month } });
    const sorted = [...det.data].sort((a, b) => dayjs(a.production_date) - dayjs(b.production_date));
    return {
      title: 'Sudah Terkirim', customerName: customer?.name || '',
      shortCode: customer?.short_code || customer?.code, monthKey: month, periodLabel,
      summary: monthRow ? [monthRow] : [],
      detailTitle: 'Log Produksi (HASIL JADI)',
      detailHead: ['Tanggal', 'Kain', 'Roll', 'KG'],
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
        message.warning('Tidak ada data untuk bulan itu'); setPreview(null); return;
      }
      setPreview(rpt);
    } catch (err) {
      message.error(err.response?.data?.error || 'Pratinjau gagal');
    } finally { setDlBusy(false); }
  }

  function doExport() {
    if (preview) exportReport(preview);
    setDlOpen(false);
  }

  const tabItems = [
    { key: 'production', label: 'Sudah Terkirim', children: <ProductionTab customerId={id} fabricTypes={fabricTypes} isAdmin={isAdmin} /> },
    { key: 'yarn',       label: 'Log Benang',     children: <YarnTab customerId={id} isAdmin={isAdmin} /> },
    { key: 'leftover',   label: 'Sisa (SISA)',    children: <LeftoverTab customerId={id} isAdmin={isAdmin} /> },
    // Tarif = data uang -> hanya owner
    ...(isOwner ? [{ key: 'rates', label: 'Tarif Maklon', children: <RatesTab customerId={id} fabricTypes={fabricTypes} /> }] : []),
    { key: 'summary',    label: 'Ringkasan',      children: <SummaryTab customerId={id} /> },
  ];

  return (
    <>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/customers')}>Pelanggan</a> }, { title: customer?.name || '…' }]} />
      <Space style={{ marginBottom: 16 }} align="center" wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')} />
        <Typography.Title level={4} style={{ margin: 0 }}>{customer?.name}</Typography.Title>
        <Tag>{customer?.code}</Tag>
        {customer?.short_code && <Tag color="blue">{customer.short_code}</Tag>}
        <Button icon={<FilePdfOutlined />} onClick={() => openDownload('yarn')}>Unduh Log Benang</Button>
        <Button icon={<FilePdfOutlined />} onClick={() => openDownload('production')}>Unduh Sudah Terkirim</Button>
      </Space>

      <Modal
        title={dlType === 'yarn' ? 'Unduh Log Benang' : 'Unduh Sudah Terkirim'}
        open={dlOpen} onCancel={() => setDlOpen(false)} width={preview ? 760 : 460}
        footer={[
          <Button key="cancel" onClick={() => setDlOpen(false)}>Batal</Button>,
          <Button key="preview" loading={dlBusy} onClick={doPreview}>Pratinjau</Button>,
          <Button key="dl" type="primary" disabled={!preview} onClick={doExport}>Unduh PDF</Button>,
        ]}>
        <Space align="center" wrap style={{ marginBottom: 8 }}>
          <Typography.Text>Bulan:</Typography.Text>
          <DatePicker picker="month" value={dlMonth} allowClear={false}
            onChange={(m) => { setDlMonth(m); setPreview(null); }} />
          <Typography.Text type="secondary">Pilih bulan, lalu Pratinjau.</Typography.Text>
        </Space>

        {preview && (
          <div style={{ marginTop: 12 }}>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>
              {preview.title} — {preview.periodLabel}
            </Typography.Title>
            <Typography.Text strong>Sisa (SISA)</Typography.Text>
            <Table size="small" pagination={false} style={{ marginTop: 4, marginBottom: 16 }}
              dataSource={preview.summary} rowKey="month"
              columns={[
                { title: 'Bulan', dataIndex: 'month', render: m => dayjs(m).format('MMM YYYY') },
                { title: 'Awal', dataIndex: 'opening_kg', align: 'right', render: fmt },
                { title: 'Benang Masuk', dataIndex: 'yarn_in_kg', align: 'right', render: fmt },
                { title: 'Terkirim', dataIndex: 'sent_kg', align: 'right', render: fmt },
                { title: 'Roll', dataIndex: 'sent_rolls', align: 'right', render: fmt },
                { title: 'Selisih', dataIndex: 'net_kg', align: 'right',
                  render: v => <span style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>{fmt(v)}</span> },
                { title: 'Akhir', dataIndex: 'leftover_kg', align: 'right', render: fmt },
              ]}
              locale={{ emptyText: 'Tidak ada baris sisa untuk bulan ini' }} />
            <Typography.Text strong>{preview.detailTitle} ({preview.detailBody.length} baris)</Typography.Text>
            <Table size="small" style={{ marginTop: 4 }} scroll={{ y: 240 }}
              pagination={false}
              dataSource={preview.detailBody.map((row, i) => ({ key: i, row }))}
              columns={preview.detailHead.map((h, ci) => ({
                title: h, dataIndex: 'row',
                align: ci === 0 ? 'left' : 'right',
                render: (row) => row[ci],
              }))}
              locale={{ emptyText: 'Tidak ada baris detail untuk bulan ini' }} />
          </div>
        )}
      </Modal>

      <Tabs defaultActiveKey="production" items={tabItems} />
    </>
  );
}

// ---------------- Tab Produksi (Sudah Terkirim) ----------------
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
      message.success(editing ? 'Diperbarui' : 'Ditambahkan'); setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }
  async function del(rid) {
    try { await api.delete(`/production/${rid}`); message.success('Dihapus'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const columns = [
    { title: 'Tanggal', dataIndex: 'production_date', width: 120,
      render: d => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.production_date).valueOf() - dayjs(b.production_date).valueOf() },
    { title: 'Kain (NAMA KAIN)', dataIndex: 'fabric_type', width: 160 },
    { title: 'Roll', dataIndex: 'roll_count', width: 80, align: 'right', render: fmt },
    { title: 'KG', dataIndex: 'fabric_kg', width: 110, align: 'right', render: fmt },
    { title: 'Catatan', dataIndex: 'notes', ellipsis: true },
    ...(isAdmin ? [{ title: '', key: 'a', width: 90, render: (_, row) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        <Popconfirm title="Hapus?" okText="Hapus" cancelText="Batal" onConfirm={() => del(row.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>) }] : []),
  ];

  const totKg = rows.reduce((s, r) => s + Number(r.fabric_kg), 0);
  const totRoll = rows.reduce((s, r) => s + Number(r.roll_count), 0);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Tambah Produksi</Button>}
        <DatePicker picker="month" placeholder="Filter bulan" value={month} onChange={setMonth} />
        <Typography.Text type="secondary">{rows.length} baris · {fmt(totRoll)} roll · {fmt(totKg)} kg</Typography.Text>
      </Space>
      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? 'Ubah Produksi' : 'Tambah Produksi'} open={open} onOk={save} onCancel={() => setOpen(false)} okText="Simpan" cancelText="Batal">
        <Form form={form} layout="vertical">
          <Form.Item name="production_date" label="Tanggal" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fabric_type_id" label="Jenis Kain" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={fabricTypes.map(f => ({ value: f.id, label: f.name }))} />
          </Form.Item>
          <Form.Item name="roll_count" label="Jumlah Roll (gulungan)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fabric_kg" label="Berat Kain (KG)" rules={[{ required: true }]}><InputNumber min={0.001} step={0.001} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Catatan"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ---------------- Tab Benang ----------------
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
      message.success(editing ? 'Diperbarui' : 'Dicatat'); setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }
  async function del(rid) {
    try { await api.delete(`/yarn-receipts/${rid}`); message.success('Dihapus'); load(); }
    catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const columns = [
    { title: 'Tanggal', dataIndex: 'received_date', width: 115,
      render: d => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.received_date).valueOf() - dayjs(b.received_date).valueOf() },
    { title: 'Sumber', dataIndex: 'source', width: 100, render: s => <Tag color={s === 'purchased' ? 'orange' : 'blue'}>{s === 'purchased' ? 'Beli' : 'Pelanggan'}</Tag> },
    { title: 'Benang (BENANG MASUK)', dataIndex: 'yarn_type', width: 220, ellipsis: true },
    { title: 'Bal', dataIndex: 'bale_count', width: 90, align: 'right', render: v => v ?? '—' },
    { title: 'KG', dataIndex: 'quantity_kg', width: 120, align: 'right', render: fmt },
    { title: 'DO/Challan', dataIndex: 'delivery_note', ellipsis: true, render: v => v || '—' },
    ...(isAdmin ? [{ title: '', key: 'a', width: 90, render: (_, row) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        <Popconfirm title="Hapus?" okText="Hapus" cancelText="Batal" onConfirm={() => del(row.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>) }] : []),
  ];

  const totKg = rows.reduce((s, r) => s + Number(r.quantity_kg), 0);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Catat Benang</Button>}
        <DatePicker picker="month" placeholder="Filter bulan" value={month} onChange={setMonth} />
        <Typography.Text type="secondary">{rows.length} penerimaan · {fmt(totKg)} kg</Typography.Text>
      </Space>
      <Table dataSource={rows} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? 'Ubah Penerimaan Benang' : 'Catat Penerimaan Benang'} open={open} onOk={save} onCancel={() => setOpen(false)} okText="Simpan" cancelText="Batal">
        <Form form={form} layout="vertical">
          <Form.Item name="received_date" label="Tanggal Terima" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="source" label="Sumber">
            <Select options={[{ value: 'customer', label: 'Dikirim pelanggan' }, { value: 'purchased', label: 'Dibeli pabrik (BELI BENANG)' }]} />
          </Form.Item>
          <Form.Item name="yarn_type" label="Jenis Benang" rules={[{ required: true }]}><Input placeholder="mis. PE 30S, DTY 75/36" /></Form.Item>
          <Form.Item name="bale_count" label="Jumlah Bal / Cone"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="quantity_kg" label="Jumlah (kg)" rules={[{ required: true }]}><InputNumber min={0.001} step={0.001} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="delivery_note" label="No. DO / Challan"><Input /></Form.Item>
          <Form.Item name="notes" label="Catatan"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ---------------- Tab Tarif (hanya owner) ----------------
function RatesTab({ customerId, fabricTypes }) {
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
      message.success('Tarif ditambahkan'); form.resetFields(); form.setFieldsValue({ effective_from: dayjs() }); load();
    } catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const columns = [
    { title: 'Jenis Kain', dataIndex: 'fabric_type_name', render: v => v || <i>Semua jenis</i> },
    { title: 'Tarif/kg', dataIndex: 'rate_per_kg', align: 'right', render: money },
    { title: 'Berlaku Dari', dataIndex: 'effective_from', render: d => dayjs(d).format('DD MMM YYYY') },
    { title: 'Sampai', dataIndex: 'effective_to', render: d => d ? dayjs(d).format('DD MMM YYYY') : <Tag color="green">Aktif</Tag> },
  ];

  return (
    <>
      <Form form={form} layout="inline" style={{ marginBottom: 16, rowGap: 8, flexWrap: 'wrap' }}>
        <Form.Item name="fabric_type_id" label="Kain">
          <Select allowClear placeholder="Semua jenis" style={{ width: 160 }} options={fabricTypes.map(f => ({ value: f.id, label: f.name }))} />
        </Form.Item>
        <Form.Item name="rate_per_kg" label="Tarif/kg" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 120 }} /></Form.Item>
        <Form.Item name="effective_from" label="Berlaku Dari"><DatePicker /></Form.Item>
        <Form.Item><Button type="primary" onClick={add}>Tambah Tarif</Button></Form.Item>
      </Form>
      <Table dataSource={rates} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
    </>
  );
}

// ---------------- Tab Ringkasan ----------------
function SummaryTab({ customerId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/production/summary', { params: { customer_id: customerId } })
      .then(r => setRows(r.data)).finally(() => setLoading(false));
  }, [customerId]);

  const columns = [
    { title: 'Bulan', dataIndex: 'period_month', width: 140, render: d => dayjs(d).format('MMM YYYY') },
    { title: 'Jenis Kain', dataIndex: 'fabric_type' },
    { title: 'Entri', dataIndex: 'entry_count', align: 'right', width: 90 },
    { title: 'Roll', dataIndex: 'total_rolls', align: 'right', width: 100, render: fmt },
    { title: 'Total KG', dataIndex: 'total_kg', align: 'right', width: 120, render: fmt },
  ];

  return <Table dataSource={rows} columns={columns} rowKey={(r) => `${r.period_month}-${r.fabric_type_id}`}
    loading={loading} size="small" />;
}

// ---------------- Tab Sisa (SISA) ----------------
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
      message.success('Sisa awal disimpan');
      setOpen(false); load();
    } catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }
  async function clearOpening(month) {
    try {
      await api.delete(`/customers/${customerId}/opening/${dayjs(month).format('YYYY-MM')}`);
      message.success('Sisa awal dihapus'); load();
    } catch (err) { message.error(err.response?.data?.error || 'Gagal'); }
  }

  const columns = [
    { title: 'Bulan', dataIndex: 'month', width: 110, render: m => dayjs(m).format('MMM YYYY') },
    { title: 'Awal', dataIndex: 'opening_kg', align: 'right',
      render: (v, row) => row.is_opening_set
        ? <span><b>{fmt(v)}</b> <Tag color="gold" style={{ marginLeft: 4 }}>diset</Tag></span>
        : fmt(v) },
    { title: 'Benang Masuk', dataIndex: 'yarn_in_kg', align: 'right', render: fmt },
    { title: 'Terkirim (kg)', dataIndex: 'sent_kg', align: 'right', render: fmt },
    { title: 'Roll', dataIndex: 'sent_rolls', align: 'right', render: fmt },
    { title: 'Selisih', dataIndex: 'net_kg', align: 'right',
      render: v => <span style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>{fmt(v)}</span> },
    { title: 'Sisa Akhir (SISA)', dataIndex: 'leftover_kg', align: 'right',
      render: v => <b style={{ color: v < 0 ? '#ff4d4f' : '#1677ff' }}>{fmt(v)}</b> },
    ...(isAdmin ? [{ title: '', key: 'a', width: 70,
      render: (_, row) => row.is_opening_set
        ? <Popconfirm title="Hapus sisa awal ini?" okText="Hapus" cancelText="Batal" onConfirm={() => clearOpening(row.month)}>
            <Button size="small" type="link" danger>hapus</Button>
          </Popconfirm>
        : null }] : []),
  ];

  return (
    <>
      <Typography.Paragraph type="secondary">
        <b>Awal</b> = sisa benang dari bulan lalu (terbawa otomatis, atau diset admin sebagai patokan).
        <b> Sisa Akhir (SISA)</b> = awal + benang masuk − terkirim, dibawa ke bulan berikutnya.
      </Typography.Paragraph>
      {isAdmin && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openSet} style={{ marginBottom: 12 }}>
          Set Sisa Awal
        </Button>
      )}
      <Table dataSource={rows} columns={columns} rowKey="month" loading={loading} size="small" pagination={false} />

      <Modal title="Set Sisa Awal (sisa benang)" open={open} onOk={saveOpening} onCancel={() => setOpen(false)} okText="Simpan" cancelText="Batal">
        <Typography.Paragraph type="secondary">
          Masukkan sisa benang yang terbawa ke awal bulan ini. Nilai ini jadi patokan dan terbawa terus.
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item name="month" label="Bulan" rules={[{ required: true }]}>
            <DatePicker picker="month" style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
          <Form.Item name="opening_kg" label="Sisa Awal (kg)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
