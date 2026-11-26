import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { parseError, downloadDocument } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field } from '../../components/ui/Common';
import { useToast } from '../../contexts/ToastContext';
import { STATUS, STATUS_LABEL, FOLLOW_UP_STATUS_LABEL } from '../../constants';

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const LEVELS = ['Rendah', 'Moderat', 'Tinggi', 'Ekstrem'];

const STATUS_CARDS = [
  {
    key: STATUS.WAITING_OWNER_APPROVAL,
    countKey: 'waiting_owner',
    tone: 'bg-amber-500',
    description: 'Menunggu approval Risk Owner.',
  },
  {
    key: STATUS.WAITING_MR_INSTRUCTION,
    countKey: 'waiting_mr_instruction',
    tone: 'bg-blue-500',
    description: 'Owner approved, MR belum memberi instruksi.',
  },
  {
    key: STATUS.WAITING_OFFICER_FOLLOWUP,
    countKey: 'waiting_officer_followup',
    tone: 'bg-cyan-500',
    description: 'Officer mengisi realisasi dan bukti.',
  },
  {
    key: STATUS.WAITING_MR_APPROVAL,
    countKey: 'waiting_mr',
    tone: 'bg-violet-500',
    description: 'MR menilai hasil tindak lanjut.',
  },
  {
    key: STATUS.APPROVED,
    countKey: 'approved',
    tone: 'bg-emerald-500',
    description: 'Semua tindak lanjut sesuai.',
  },
  {
    key: STATUS.REJECTED_BY_OWNER,
    countKey: 'rejected_owner',
    tone: 'bg-orange-500',
    description: 'Dikembalikan oleh Risk Owner.',
  },
  {
    key: STATUS.REJECTED_BY_MR,
    countKey: 'rejected_mr',
    tone: 'bg-red-500',
    description: 'Dikembalikan oleh MR.',
  },
];

const FOLLOW_UP_CLASS = {
  SELESAI: 'bg-green-50 text-green-700 border-green-300',
  BELUM_MEMADAI: 'bg-amber-50 text-amber-700 border-amber-300',
  TIDAK_DAPAT_DITINDAKLANJUTI: 'bg-slate-100 text-slate-600 border-slate-300',
};

export default function MonitoringPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ year: '', branch: '', category: '', level: '', owner: '' });
  const [summary, setSummary] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeStatus, setActiveStatus] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  useEffect(() => {
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {});
    api.get('/masters/categories').then((r) => setCategories((r.data.data || []).filter((c) => c.status === 'ACTIVE'))).catch(() => {});
    api.get('/users').then((r) => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/monitoring/summary', { params: clean(filters) });
      setSummary(res.data.data || []);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeStatus) {
      setFollowUps([]);
      return undefined;
    }
    let cancelled = false;
    setFollowUpsLoading(true);
    api
      .get('/monitoring/follow-ups', { params: { ...clean(filters), status: activeStatus } })
      .then((r) => {
        if (!cancelled) setFollowUps(r.data.items || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(parseError(err).message);
      })
      .finally(() => {
        if (!cancelled) setFollowUpsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStatus, filters, toast]);

  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const sum = (key) => summary.reduce((total, row) => total + Number(row[key] || 0), 0);
  const counts = {
    [STATUS.WAITING_OWNER_APPROVAL]: sum('waiting_owner'),
    [STATUS.WAITING_MR_INSTRUCTION]: sum('waiting_mr_instruction'),
    [STATUS.WAITING_OFFICER_FOLLOWUP]: sum('waiting_officer_followup'),
    [STATUS.WAITING_MR_APPROVAL]: sum('waiting_mr'),
    [STATUS.APPROVED]: sum('active_risk'),
    [STATUS.REJECTED_BY_OWNER]: sum('rejected_owner'),
    [STATUS.REJECTED_BY_MR]: sum('rejected_mr'),
  };

  return (
    <div className="pb-10">
      <PageHeader title="Dashboard Monitoring" subtitle="Pantau status tindak lanjut dan detail item mitigasi per status" />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATUS_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setActiveStatus((prev) => (prev === card.key ? '' : card.key))}
            className={`card overflow-hidden text-left transition hover:shadow-md ${activeStatus === card.key ? 'ring-2 ring-primary-500' : ''}`}
          >
            <div className={`h-1.5 ${card.tone}`} />
            <div className="px-4 py-3">
              <p className="text-2xl font-bold text-slate-800">{loading ? '-' : counts[card.key] || 0}</p>
              <p className="text-xs font-semibold text-slate-700">{STATUS_LABEL[card.key]}</p>
              <p className="mt-1 text-[11px] leading-tight text-slate-400">{card.description}</p>
            </div>
          </button>
        ))}
      </div>

      {activeStatus && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">{STATUS_LABEL[activeStatus]}</h3>
              <p className="text-xs text-slate-400">{followUps.length} item mitigasi</p>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => setActiveStatus('')}>Tutup</button>
          </div>
          {followUpsLoading ? (
            <Spinner />
          ) : !followUps.length ? (
            <EmptyState title="Tidak ada item mitigasi" description="Tidak ada item pada status ini." />
          ) : (
            <div className="overflow-hidden">
              <table className="table-base table-fixed w-full">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[24%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[17%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Risk</th>
                    <th>Mitigasi</th>
                    <th>Bukti</th>
                    <th>Status</th>
                    <th>Keterangan MR Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {followUps.map((row) => (
                    <tr key={row.id}>
                      <td className="break-words">
                        <p className="font-semibold leading-snug text-slate-700">{row.event_name}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-400">{row.category_name}</p>
                      </td>
                      <td className="break-words">
                        <button
                          className="break-words text-left font-semibold text-primary-700 hover:underline"
                          onClick={() => navigate(`/risk-registers/${row.register_id}`)}
                        >
                          {row.risk_code}
                        </button>
                        <p className="mt-0.5 break-words text-xs text-slate-400">{row.branch_name}</p>
                      </td>
                      <td className="break-words leading-relaxed text-slate-600">{row.description}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.documents.length ? (
                            row.documents.map((doc) => (
                              <button
                                key={`${row.id}:${doc.id}`}
                                className="inline-flex max-w-full items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-primary-700 hover:bg-slate-100"
                                title={doc.original_name}
                                onClick={() => downloadDocument(row.register_id, doc.id, doc.original_name)}
                              >
                                <span className="truncate">{doc.original_name}</span>
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${FOLLOW_UP_CLASS[row.follow_up_status] || FOLLOW_UP_CLASS.TIDAK_DAPAT_DITINDAKLANJUTI}`}>
                          {FOLLOW_UP_STATUS_LABEL[row.follow_up_status] || '-'}
                        </span>
                      </td>
                      <td className="whitespace-pre-wrap break-words leading-relaxed text-slate-600">{row.mr_note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
