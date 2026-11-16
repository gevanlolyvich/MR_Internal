import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field, Pagination } from '../../components/ui/Common';
import { StatusBadge, LevelBadge } from '../../components/ui/Badges';
import { useToast } from '../../contexts/ToastContext';
import { RISK_LEVEL_COLORS } from '../../constants';

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const LEVELS = ['Rendah', 'Moderat', 'Tinggi', 'Ekstrem'];

export default function MonitoringPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ year: '', branch: '', category: '', status: '', level: '', owner: '' });
  const [summary, setSummary] = useState([]);
  const [list, setList] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {});
    api.get('/masters/categories').then((r) => setCategories((r.data.data || []).filter((c) => c.status === 'ACTIVE'))).catch(() => {});
    api.get('/users').then((r) => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = clean(filters);
      const [s, l] = await Promise.all([
        api.get('/monitoring/summary', { params }),
        api.get('/monitoring', { params: { ...params, page, limit: 20 } }),
      ]);
      setSummary(s.data.data || []);
      setList(l.data);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const totals = summary.reduce(
    (acc, s) => ({
      risk: acc.risk + Number(s.total_risk || 0),
      active: acc.active + Number(s.active_risk || 0),
      pending: acc.pending + Number(s.waiting_owner || 0) + Number(s.waiting_mr || 0),
      rejected: acc.rejected + Number(s.rejected_risk || 0),
    }),
    { risk: 0, active: 0, pending: 0, rejected: 0 }
  );

  return (
    <div>
      <PageHeader title="Monitoring" subtitle="Pantau risiko per branch, level, status, dan tren mitigasi" />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Branch">
            <select className="input" value={filters.branch} onChange={(e) => setF('branch', e.target.value)}>
              <option value="">Semua</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Year">
            <select className="input" value={filters.year} onChange={(e) => setF('year', e.target.value)}>
              <option value="">Semua</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Risk Category">
            <select className="input" value={filters.category} onChange={(e) => setF('category', e.target.value)}>
              <option value="">Semua</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Risk Owner">
            <select className="input" value={filters.owner} onChange={(e) => setF('owner', e.target.value)}>
              <option value="">Semua</option>
              {users.filter((u) => u.role === 'RISK_OWNER').map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Risk Level">
            <select className="input" value={filters.level} onChange={(e) => setF('level', e.target.value)}>
              <option value="">Semua</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              <option value="">Semua</option>
              {['DRAFT', 'WAITING_OWNER_APPROVAL', 'REJECTED_BY_OWNER', 'WAITING_MR_APPROVAL', 'REJECTED_BY_MR', 'APPROVED'].map((s) => (
                <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Risk', value: totals.risk, color: 'bg-primary-700' },
          { label: 'Active Risk', value: totals.active, color: 'bg-jxb-green' },
          { label: 'Menunggu Approval', value: totals.pending, color: 'bg-amber-500' },
          { label: 'Rejected', value: totals.rejected, color: 'bg-jxb-red' },
        ].map((c) => (
          <div key={c.label} className="card overflow-hidden">
            <div className={`h-1.5 ${c.color}`} />
            <div className="px-4 py-3">
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Total Risk per Branch</h3>
          {loading ? (
            <Spinner />
          ) : !summary.length ? (
            <EmptyState title="Belum ada data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={summary.map((s) => ({ label: s.branch_name, value: Number(s.total_risk) }))} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Risiko Tertinggi per Branch (After Mitigation)</h3>
          {loading ? (
            <Spinner />
          ) : !summary.length ? (
            <EmptyState title="Belum ada data" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={summary.map((s) => ({ label: s.branch_name, value: Number(s.avg_after || 0) }))} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Ringkasan per Branch</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[850px]">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Total</th>
                <th>Active</th>
                <th>Waiting Owner</th>
                <th>Waiting MR</th>
                <th>Rejected</th>
                <th>Inherent (max)</th>
                <th>Residual (max)</th>
                <th>After (max)</th>
                <th>Rata-rata After</th>
              </tr>
            </thead>
            <tbody>
              {!summary.length && (
                <tr><td colSpan="10" className="py-6 text-center text-slate-400">Tidak ada data</td></tr>
              )}
              {summary.map((s) => (
                <tr key={s.branch_id}>
                  <td className="font-semibold">{s.branch_name}</td>
                  <td>{s.total_risk}</td>
                  <td className="text-green-700">{s.active_risk}</td>
                  <td className="text-amber-600">{s.waiting_owner}</td>
                  <td className="text-primary-700">{s.waiting_mr}</td>
                  <td className="text-jxb-red">{s.rejected_risk}</td>
                  <td>{s.inherent ? <LevelBadge level={s.inherent.level} score={s.inherent.score} /> : '-'}</td>
                  <td>{s.residual ? <LevelBadge level={s.residual.level} score={s.residual.score} /> : '-'}</td>
                  <td>{s.after ? <LevelBadge level={s.after.level} score={s.after.score} /> : '-'}</td>
                  <td>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: RISK_LEVEL_COLORS[s.after?.level] || '#94a3b8' }}
                    >
                      {s.avg_after}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Detail Risk Register ({list.total})</h3>
        </div>
        {loading ? (
          <Spinner />
        ) : !list.items.length ? (
          <EmptyState title="Tidak ada Risk Register" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[1000px]">
              <thead>
                <tr>
                  <th>Risk Code</th>
                  <th>Objective</th>
                  <th>Branch</th>
                  <th>Owner</th>
                  <th>Inherent</th>
                  <th>Residual</th>
                  <th>After</th>
                  <th>Mitigation Status</th>
                  <th>Approval Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-primary-700">{r.risk_code}</td>
                    <td className="max-w-[220px] text-slate-600">{r.objective}</td>
                    <td className="text-xs">{r.branch_name}</td>
                    <td className="text-xs">{r.owner_name}</td>
                    <td><LevelBadge {...(r.inherent || {})} /></td>
                    <td><LevelBadge {...(r.residual || {})} /></td>
                    <td><LevelBadge {...(r.after || {})} /></td>
                    <td className="text-xs">
                      {r.status === 'APPROVED' ? 'Selesai' : r.status.includes('REJECTED') ? 'Perlu perbaikan' : 'Berjalan'}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <button className="btn-secondary btn-sm ml-auto" onClick={() => navigate(`/risk-registers/${r.id}`)}>
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={list.page} limit={list.limit} total={list.total} onPage={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
