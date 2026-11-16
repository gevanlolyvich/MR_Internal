import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Pagination, Field } from '../../components/ui/Common';
import { StatusBadge, LevelBadge } from '../../components/ui/Badges';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);
const LEVELS = ['Rendah', 'Moderat', 'Tinggi', 'Ekstrem'];

export default function RiskRegisterListPage() {
  const { can, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 15 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', year: '', status: '', branch: '', category: '', level: '' });
  const [page, setPage] = useState(1);

  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isMR = user?.role === 'MR';

  useEffect(() => {
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {});
    api.get('/masters/categories').then((r) => setCategories((r.data.data || []).filter((x) => x.status === 'ACTIVE'))).catch(() => {});
    if (can('user:manage')) {
      api.get('/users').then((r) => setUsers(r.data.data || [])).catch(() => {});
    }
  }, [can]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      });
      const res = await api.get('/risk-registers', { params });
      setData(res.data);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const canCreate = can('risk-register:create');
  const canEdit = can('risk-register:edit');
  const canSubmit = can('risk-register:submit');

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/risk-registers/${pendingSubmit.id}/submit`);
      toast.success('Risk Register dikirim ke Risk Owner untuk approval');
      setPendingSubmit(null);
      load();
    } catch (err) {
      const p = parseError(err);
      toast.error(p.details?.[0]?.message || p.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onExport = async () => {
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v && k !== 'q') params[k] = v;
      });
      const res = await api.get('/export/risk-register', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Risk-Register-${filters.year || CURRENT_YEAR}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Export Excel berhasil');
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Risk Register"
        subtitle={`${data.total} data ditemukan`}
        actions={
          <>
            {can('export:run') && (
              <button className="btn-secondary" onClick={onExport}>
                Export Excel
              </button>
            )}
            {canCreate && (
              <button className="btn-primary" onClick={() => navigate('/risk-registers/new')}>
                + Buat Risk Register
              </button>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search">
            <input
              className="input"
              placeholder="Kode, objective, risk event..."
              value={filters.q}
              onChange={(e) => setF('q', e.target.value)}
            />
          </Field>
          <Field label="Year">
            <select className="input" value={filters.year} onChange={(e) => setF('year', e.target.value)}>
              <option value="">Semua tahun</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Branch">
            <select className="input" value={filters.branch} onChange={(e) => setF('branch', e.target.value)}>
              <option value="">Semua branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Risk Category">
            <select className="input" value={filters.category} onChange={(e) => setF('category', e.target.value)}>
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              <option value="">Semua status</option>
              {['DRAFT', 'WAITING_OWNER_APPROVAL', 'REJECTED_BY_OWNER', 'WAITING_MR_APPROVAL', 'REJECTED_BY_MR', 'APPROVED', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Risk Level">
            <select className="input" value={filters.level} onChange={(e) => setF('level', e.target.value)}>
              <option value="">Semua level</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          {isMR && (
            <>
              <Field label="Risk Owner">
                <select className="input" value={filters.owner} onChange={(e) => setF('owner', e.target.value)}>
                  <option value="">Semua owner</option>
                  {users.filter((u) => u.role === 'RISK_OWNER').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Risk Officer">
                <select className="input" value={filters.officer} onChange={(e) => setF('officer', e.target.value)}>
                  <option value="">Semua officer</option>
                  {users.filter((u) => u.role === 'RISK_OFFICER').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : !data.items.length ? (
          <EmptyState title="Belum ada Risk Register" description="Klik 'Buat Risk Register' untuk memulai." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[1100px]">
              <thead>
                <tr>
                  <th>Risk Code</th>
                  <th>Objective</th>
                  <th>Category</th>
                  <th>Risk Owner</th>
                  <th>Risk Officer</th>
                  <th>Branch</th>
                  <th>Inherent</th>
                  <th>Residual</th>
                  <th>After Mitigation</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => {
                  const editable = canEdit && ['DRAFT', 'REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(r.status) && (user.role !== 'RISK_OFFICER' || r.risk_officer_id === user.id);
                  const submittable = canSubmit && editable;
                  return (
                    <tr key={r.id}>
                      <td className="font-semibold text-primary-700">{r.risk_code}</td>
                      <td className="max-w-[220px] text-slate-600">{r.objective}</td>
                      <td className="max-w-[160px] text-xs text-slate-500">{r.category_names || '-'}</td>
                      <td>{r.owner_name}</td>
                      <td>{r.officer_name}</td>
                      <td className="text-xs">{r.branch_name}</td>
                      <td><LevelBadge {...(r.inherent || {})} /></td>
                      <td><LevelBadge {...(r.residual || {})} /></td>
                      <td><LevelBadge {...(r.after || {})} /></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button className="btn-secondary btn-sm" onClick={() => navigate(`/risk-registers/${r.id}`)}>
                            Detail
                          </button>
                          {editable && (
                            <button className="btn-secondary btn-sm" onClick={() => navigate(`/risk-registers/${r.id}/edit`)}>
                              Edit
                            </button>
                          )}
                          {submittable && (
                            <button className="btn-primary btn-sm" onClick={() => setPendingSubmit(r)}>
                              Submit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingSubmit}
        onClose={() => setPendingSubmit(null)}
        onConfirm={doSubmit}
        loading={submitting}
        title="Submit Risk Register"
        message={`Kirim ${pendingSubmit?.risk_code} ke Risk Owner untuk approval?`}
        confirmLabel="Ya, Submit"
      />
    </div>
  );
}
