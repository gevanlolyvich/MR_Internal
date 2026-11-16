import { useCallback, useEffect, useState } from 'react';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field, Tabs } from '../../components/ui/Common';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';

const TYPES = [
  { key: 'categories', label: 'Risk Category', fields: ['code', 'name', 'description', 'status'] },
  { key: 'treatments', label: 'Risk Treatment', fields: ['code', 'name', 'description', 'status'] },
  { key: 'likelihoods', label: 'Likelihood', fields: ['score', 'name', 'description'] },
  { key: 'impacts', label: 'Impact', fields: ['score', 'name', 'description'] },
  { key: 'levels', label: 'Risk Level', fields: ['min_score', 'max_score', 'level', 'color'] },
  { key: 'sources', label: 'Risk Source', fields: ['code', 'name', 'status'] },
  { key: 'severities', label: 'Severity', fields: ['score', 'description', 'rp_value', 'status'] },
  { key: 'tolerance', label: 'Risk Tolerance', fields: ['max_score', 'note'] },
];

const FIELD_LABEL = {
  code: 'Code',
  name: 'Name',
  description: 'Description',
  status: 'Status',
  score: 'Score',
  min_score: 'Min Score',
  max_score: 'Max Score',
  level: 'Level',
  color: 'Color (hex)',
  rp_value: 'Rp Value',
  note: 'Note',
};

const HINTS = {
  score: '1–5',
  min_score: '1–25',
  max_score: '1–25 (maksimum skor dianggap dalam toleransi)',
  color: 'Contoh: #22c55e',
};

export default function MasterDataPage() {
  const toast = useToast();
  const [tab, setTab] = useState('categories');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tolerance, setTolerance] = useState({ max_score: 9, note: '' });

  const current = TYPES.find((t) => t.key === tab);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'tolerance') {
        const res = await api.get('/masters/tolerance');
        const t = res.data.data || {};
        setTolerance({ max_score: t.max_score ?? 9, note: t.note || '' });
        setRows([]);
      } else {
        const res = await api.get(`/masters/${tab}`);
        setRows(res.data.data || []);
      }
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    const init = {};
    current.fields.forEach((f) => {
      init[f] = f === 'status' ? 'ACTIVE' : f === 'color' ? '#22c55e' : '';
    });
    setForm(init);
    setErrors([]);
    setModal({ mode: 'create' });
  };

  const openEdit = (row) => {
    const init = {};
    current.fields.forEach((f) => {
      init[f] = row[f] ?? '';
    });
    setForm(init);
    setErrors([]);
    setModal({ mode: 'edit', id: row.id ?? row.score });
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const body = { ...form };
      ['score', 'min_score', 'max_score', 'rp_value'].forEach((k) => {
        if (body[k] !== undefined && body[k] !== '') body[k] = Number(body[k]);
      });
      const isNew = modal.mode === 'create';
      if (tab === 'tolerance') {
        await api.put('/masters/tolerance', {
          max_score: Number(tolerance.max_score),
          note: tolerance.note,
        });
        toast.success('Risk Tolerance diperbarui');
        setModal(null);
        load();
        return;
      }
      if (isNew) await api.post(`/masters/${tab}`, body);
      else await api.put(`/masters/${tab}/${modal.id}`, body);
      toast.success(`${current.label} tersimpan`);
      setModal(null);
      load();
    } catch (err) {
      const p = parseError(err);
      if (p.details?.length) setErrors(p.details);
      else toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Hapus ${current.label} ini?`)) return;
    try {
      await api.delete(`/masters/${tab}/${row.id ?? row.score}`);
      toast.success('Data dihapus');
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const errOf = (f) => errors.find((e) => e.field === f)?.message;
  const hasStatus = current.fields.includes('status');

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Konfigurasi master yang memengaruhi perhitungan & form Risk Register" />

      <Tabs tabs={TYPES.map((t) => ({ key: t.key, label: t.label }))} active={tab} onChange={setTab} />

      <div className="mt-4">
        {tab === 'tolerance' ? (
          <Card className="max-w-xl p-5">
            <p className="mb-4 text-sm text-slate-600">
              Risk Tolerance: skor Risk After Mitigation <b>≤ {tolerance.max_score}</b> dianggap{' '}
              <b>Within Risk Tolerance</b>, selain itu <b>Exceeds Risk Tolerance</b>.
              Threshold ini bersifat konfigurasi, bukan mengubah alur approval.
            </p>
            <div className="grid gap-3">
              <Field label="Max Score (Within Tolerance)" required hint="1–25" error={errOf('max_score')}>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="25"
                  value={tolerance.max_score}
                  onChange={(e) => setTolerance((t) => ({ ...t, max_score: e.target.value }))}
                />
              </Field>
              <Field label="Note">
                <input
                  className="input"
                  value={tolerance.note}
                  onChange={(e) => setTolerance((t) => ({ ...t, note: e.target.value }))}
                />
              </Field>
              <div>
                <button className="btn-primary" onClick={() => setModal({ mode: 'tolerance' })}>
                  Simpan Risk Tolerance
                </button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <button className="btn-primary" onClick={openCreate}>+ Tambah {current.label}</button>
            </div>
            <Card>
              {loading ? (
                <Spinner />
              ) : !rows.length ? (
                <EmptyState title={`Belum ada data ${current.label}`} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base min-w-[650px]">
                    <thead>
                      <tr>
                        {current.fields.map((f) => (
                          <th key={f}>{FIELD_LABEL[f] || f}</th>
                        ))}
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id ?? row.score}>
                          {current.fields.map((f) => (
                            <td key={f}>
                              {f === 'status' ? (
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                  row[f] === 'ACTIVE' ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-300 bg-slate-100 text-slate-500'
                                }`}>
                                  {row[f]}
                                </span>
                              ) : f === 'color' ? (
                                <span className="flex items-center gap-2">
                                  <span className="h-4 w-4 rounded" style={{ backgroundColor: row[f] }} />
                                  {row[f]}
                                </span>
                              ) : f === 'rp_value' ? (
                                row[f] !== null && row[f] !== undefined ? Number(row[f]).toLocaleString('id-ID') : '-'
                              ) : (
                                row[f]
                              )}
                            </td>
                          ))}
                          <td>
                            <div className="flex justify-end gap-1.5">
                              <button className="btn-secondary btn-sm" onClick={() => openEdit(row)}>Edit</button>
                              {!['likelihoods', 'impacts'].includes(tab) && (
                                <button className="btn-danger btn-sm" onClick={() => remove(row)}>Hapus</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? `Edit ${current.label}` : `Tambah ${current.label}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>Batal</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {modal?.mode === 'tolerance' && (
            <p className="sm:col-span-2 text-sm text-slate-600">
              Simpan Risk Tolerance {tolerance.max_score}?
            </p>
          )}
          {modal && modal.mode !== 'tolerance' &&
            current.fields.map((f) => (
              <Field
                key={f}
                label={FIELD_LABEL[f] || f}
                required={['code', 'name', 'level', 'min_score', 'max_score', 'score'].includes(f)}
                error={errOf(f)}
                hint={HINTS[f]}
              >
                {f === 'status' ? (
                  <select className="input" value={form[f]} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                ) : f === 'color' ? (
                  <input
                    className="input"
                    type="color"
                    value={form[f] || '#22c55e'}
                    onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                  />
                ) : f === 'description' || f === 'note' ? (
                  <textarea
                    className="input min-h-[80px]"
                    value={form[f] || ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                  />
                ) : (
                  <input
                    className="input"
                    type={['score', 'min_score', 'max_score', 'rp_value'].includes(f) ? 'number' : 'text'}
                    value={form[f] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
        </div>
      </Modal>
    </div>
  );
}
