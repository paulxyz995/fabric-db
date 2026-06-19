import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, InputNumber, Select, DatePicker,
  Space, Typography, message, Tag, Descriptions,
} from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLOR = {
  pending: 'default', in_progress: 'blue', completed: 'green',
  dispatched: 'purple', cancelled: 'red',
};

export default function ProductionJobs() {
  const [jobs, setJobs]             = useState([]);
  const [receipts, setReceipts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [jobModal, setJobModal]     = useState(false);
  const [outputModal, setOutputModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form] = Form.useForm();
  const [outputForm] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/production-jobs'),
      api.get('/yarn-receipts'),
      api.get('/customers'),
    ])
      .then(([j, r, c]) => { setJobs(j.data); setReceipts(r.data); setCustomers(c.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function createJob() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/production-jobs', { ...values, start_date: values.start_date?.format('YYYY-MM-DD') });
      message.success('Job created');
      setJobModal(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  }

  async function logOutput() {
    const values = await outputForm.validateFields();
    setSaving(true);
    try {
      await api.post(`/production-jobs/${selectedJob}/outputs`, {
        ...values,
        output_date: values.output_date?.format('YYYY-MM-DD'),
      });
      message.success('Output logged');
      setOutputModal(false);
      outputForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  }

  const columns = [
    { title: 'Job #',      dataIndex: 'job_number',      width: 140 },
    { title: 'Customer',   dataIndex: 'customer_name',   ellipsis: true },
    { title: 'Yarn',       dataIndex: 'yarn_type' },
    { title: 'Yarn In (kg)', dataIndex: 'yarn_received_kg', width: 120, render: v => Number(v).toLocaleString('id-ID') },
    { title: 'Fabric Out (kg)', dataIndex: 'total_fabric_kg', width: 130, render: v => Number(v).toLocaleString('id-ID') },
    { title: 'Wastage (kg)', dataIndex: 'total_wastage_kg', width: 120, render: v => Number(v).toLocaleString('id-ID') },
    { title: 'Yield %',   dataIndex: 'yield_percent',   width: 90, render: v => `${v}%` },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{s.replace('_', ' ')}</Tag>,
    },
    {
      title: '', key: 'actions', width: 80,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={async () => {
            const { data } = await api.get(`/production-jobs/${row.id}`);
            setDetailModal(data);
          }} />
          {isAdmin && (
            <Button size="small" type="primary" onClick={() => { setSelectedJob(row.id); setOutputModal(true); }}>
              + Output
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>Production Jobs</Typography.Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setJobModal(true)}>
            New Job
          </Button>
        )}
      </Space>

      <Table dataSource={jobs} columns={columns} rowKey="id" loading={loading} size="small" />

      {/* New job modal */}
      <Modal title="New Production Job" open={jobModal} onOk={createJob}
        onCancel={() => { setJobModal(false); form.resetFields(); }} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="yarn_receipt_id" label="Yarn Receipt" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              options={receipts.map(r => ({ value: r.id, label: `${r.receipt_number} — ${r.customer_name} (${r.yarn_type})` }))}
            />
          </Form.Item>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select options={customers.map(c => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="start_date" label="Start Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Form.Item name="notes"><span /></Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      {/* Log output modal */}
      <Modal title="Log Production Output" open={outputModal} onOk={logOutput}
        onCancel={() => { setOutputModal(false); outputForm.resetFields(); }} confirmLoading={saving}>
        <Form form={outputForm} layout="vertical" initialValues={{ output_date: dayjs(), wastage_kg: 0 }}>
          <Form.Item name="output_date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fabric_kg" label="Fabric Produced (kg)" rules={[{ required: true }]}>
            <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="yarn_consumed_kg" label="Yarn Consumed (kg)" rules={[{ required: true }]}>
            <InputNumber min={0.001} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="wastage_kg" label="Wastage (kg)">
            <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Form.Item name="notes"><span /></Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail modal */}
      <Modal title={`Job ${detailModal?.job_number}`} open={!!detailModal}
        onCancel={() => setDetailModal(null)} footer={null} width={640}>
        {detailModal && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Customer">{detailModal.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[detailModal.status]}>{detailModal.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Yarn Type">{detailModal.yarn_type}</Descriptions.Item>
              <Descriptions.Item label="Yarn Received">{Number(detailModal.yarn_received_kg).toLocaleString('id-ID')} kg</Descriptions.Item>
              <Descriptions.Item label="Fabric Out">{Number(detailModal.total_fabric_kg).toLocaleString('id-ID')} kg</Descriptions.Item>
              <Descriptions.Item label="Wastage">{Number(detailModal.total_wastage_kg).toLocaleString('id-ID')} kg</Descriptions.Item>
              <Descriptions.Item label="Yield">{detailModal.yield_percent}%</Descriptions.Item>
            </Descriptions>
            {detailModal.outputs?.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginTop: 16 }}>Output Batches</Typography.Title>
                <Table
                  dataSource={detailModal.outputs}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Date',         dataIndex: 'output_date',       render: d => dayjs(d).format('DD MMM YYYY') },
                    { title: 'Fabric (kg)',  dataIndex: 'fabric_kg',         render: v => Number(v).toLocaleString('id-ID') },
                    { title: 'Yarn (kg)',    dataIndex: 'yarn_consumed_kg',  render: v => Number(v).toLocaleString('id-ID') },
                    { title: 'Wastage (kg)', dataIndex: 'wastage_kg',       render: v => Number(v).toLocaleString('id-ID') },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
