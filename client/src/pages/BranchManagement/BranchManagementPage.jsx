import { useCallback, useEffect, useState } from 'react';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field } from '../../components/ui/Common';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';

const blank = () => ({ code: '', name: '', description: '', status: 'ACTIVE' });

export default function BranchManagementPage() {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/branches');
      setBranches(res.data.data || []);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(blank());
    setErrors([]);
    setModal({ mode: 'create' });
  };

  const openEdit = (b) => {
    setForm({ code: b.code, name: b.name, description: b.description || '', status: b.status });
    setErrors([]);
    setModal({ mode: 'edit', id: b.id });
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      if (modal.mode === 'create') await api.post('/branches', form);
      else await api.put(`/branches/${modal.id}`, form);
      toast.success('Branch tersimpan');
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

  const toggleStatus = async (b) => {
    try {
      await api.put(`/branches/${b.id}`, { status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      toast.success('Status branch diperbarui');
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const errOf = (f) => errors.find((e) => e.field === f)?.message;

  return (
    <div>
      <PageHeader
        title="Branch Management"
        subtitle="Kelola branch / unit kerja — branch nonaktif tidak dapat dipakai user baru"
        actions={<button className="btn-primary" onClick={openCreate}>+ Tambah Branch</button>}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : !branches.length ? (
          <EmptyState title="Belum ada branch" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[700px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Branch Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold text-primary-700">{b.code}</td>
                    <td>{b.name}</td>
                    <td className="text-xs text-slate-500">{b.description || '-'}</td>
                    <td>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        b.status === 'ACTIVE' ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-300 bg-slate-100 text-slate-500'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-secondary btn-sm" onClick={() => openEdit(b)}>Edit</button>
                        <button
                          className={b.status === 'ACTIVE' ? 'btn-danger btn-sm' : 'btn-success btn-sm'}
                          onClick={() => toggleStatus(b)}
                        >
                          {b.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Tambah Branch' : 'Edit Branch'}
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
          <Field label="Branch Code" required error={errOf('code')}>
            <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </Field>
          <Field label="Branch Name" required error={errOf('name')}>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
