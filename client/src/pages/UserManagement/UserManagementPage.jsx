import { useCallback, useEffect, useState } from 'react';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field } from '../../components/ui/Common';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { ROLE_LABEL } from '../../constants';

const blank = () => ({
  name: '',
  username: '',
  email: '',
  password: '',
  role: '',
  branch_id: '',
  status: 'ACTIVE',
});

export default function UserManagementPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {mode:'create'|'edit', data}
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ role: '', status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, b] = await Promise.all([
        api.get('/users', { params: filter.role || filter.status ? filter : {} }),
        api.get('/branches'),
      ]);
      setUsers(u.data.data || []);
      setBranches(b.data.data || []);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(blank());
    setErrors([]);
    setModal({ mode: 'create' });
  };

  const openEdit = (u) => {
    setForm({
      name: u.name,
      username: u.username,
      email: u.email,
      password: '',
      role: u.role,
      branch_id: u.branch_id || '',
      status: u.status,
    });
    setErrors([]);
    setModal({ mode: 'edit', id: u.id });
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const body = { ...form };
      if (modal.mode === 'edit' && !body.password) delete body.password;
      body.branch_id = Number(body.branch_id);
      if (modal.mode === 'create') await api.post('/users', body);
      else await api.put(`/users/${modal.id}`, body);
      toast.success(modal.mode === 'create' ? 'User berhasil dibuat' : 'User berhasil diperbarui');
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

  const deactivate = async (u) => {
    if (!window.confirm(`Nonaktifkan user ${u.username}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('User dinonaktifkan');
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const errOf = (f) => errors.find((e) => e.field === f)?.message;

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Kelola user, role, dan branch/unit kerja"
        actions={
          <button className="btn-primary" onClick={openCreate}>+ Tambah User</button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Role">
            <select className="input" value={filter.role} onChange={(e) => setFilter((f) => ({ ...f, role: e.target.value }))}>
              <option value="">Semua role</option>
              <option value="MR">MR</option>
              <option value="RISK_OFFICER">Risk Officer</option>
              <option value="RISK_OWNER">Risk Owner</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Semua status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : !users.length ? (
          <EmptyState title="Belum ada user" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[850px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td>{u.username}</td>
                    <td className="text-xs">{u.email}</td>
                    <td>
                      <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="text-xs">{u.branch_name || '-'}</td>
                    <td>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        u.status === 'ACTIVE' ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-300 bg-slate-100 text-slate-500'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                        {u.status === 'ACTIVE' && (
                          <button className="btn-danger btn-sm" onClick={() => deactivate(u)}>Nonaktifkan</button>
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

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Tambah User' : 'Edit User'}
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
          <Field label="Name" required error={errOf('name')}>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Username" required error={errOf('username')}>
            <input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          </Field>
          <Field label="Email" required error={errOf('email')}>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field
            label={modal?.mode === 'create' ? 'Password' : 'Password (kosongkan jika tidak ganti)'}
            required={modal?.mode === 'create'}
            error={errOf('password')}
            hint="Min 8 karakter, huruf + angka"
          >
            <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="Role" required error={errOf('role')}>
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="">— pilih —</option>
              <option value="MR">MR</option>
              <option value="RISK_OFFICER">Risk Officer</option>
              <option value="RISK_OWNER">Risk Owner</option>
            </select>
          </Field>
          <Field label="Branch" required error={errOf('branch_id')}>
            <select className="input" value={form.branch_id} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
              <option value="">— pilih —</option>
              {branches.filter((b) => b.status === 'ACTIVE' || String(b.id) === String(form.branch_id)).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Risk Owner harus berbranch sama dengan Risk Officer agar dapat dipilih pada Risk Register.
        </p>
      </Modal>
    </div>
  );
}
