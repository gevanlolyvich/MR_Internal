import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Common';
import { StatusBadge, LevelBadge } from '../../components/ui/Badges';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { STATUS, STATUS_LABEL } from '../../constants';

const QUEUE = {
  MR: [STATUS.WAITING_MR_INSTRUCTION, STATUS.WAITING_MR_APPROVAL],
  RISK_OFFICER: [STATUS.WAITING_OFFICER_FOLLOWUP],
};

const ACTION_LABEL = {
  [STATUS.WAITING_MR_INSTRUCTION]: 'Beri Instruksi',
  [STATUS.WAITING_OFFICER_FOLLOWUP]: 'Isi Tindak Lanjut',
  [STATUS.WAITING_MR_APPROVAL]: 'Nilai Bukti & Catatan',
};

export default function FollowUpListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const statuses = QUEUE[user?.role] || [];
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === 'MR') {
        const res = await api.get('/approvals', { params: { page: 1, limit: 100 } });
        setItems(res.data.items || []);
      } else if (user?.role === 'RISK_OFFICER') {
        const res = await api.get('/risk-registers', {
          params: { status: STATUS.WAITING_OFFICER_FOLLOWUP, page: 1, limit: 100 },
        });
        setItems(res.data.items || []);
      } else {
        setItems([]);
      }
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [toast, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  if (!statuses.length) {
    return (
      <Card className="p-8 text-center">
        <p className="font-bold text-jxb-red">Akses ditolak</p>
        <p className="mt-1 text-sm text-slate-500">Menu Tindak Lanjut hanya untuk MR dan Risk Officer.</p>
      </Card>
    );
  }

  const visible = filter === 'ALL' ? items : items.filter((r) => r.status === filter);

  return (
    <div className="pb-10">
      <PageHeader
        title="Tindak Lanjut"
        subtitle={
          user?.role === 'MR'
            ? 'Antrian MR: beri instruksi tindak lanjut, lalu nilai bukti dan catatan dari Officer.'
            : 'Risk Register yang menunggu instruksi MR untuk Anda tindak lanjuti.'
        }
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Memuat...' : 'Muat Ulang'}
          </button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="follow-up-status">
          Status
        </label>
        <select
          id="follow-up-status"
          className="input max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">Semua Antrian</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{visible.length} register ditampilkan</span>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : !visible.length ? (
          <EmptyState
            title="Tidak ada tindak lanjut"
            description="Tidak ada Risk Register yang menunggu proses pada tahap ini."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[900px]">
              <thead>
                <tr>
                  <th>Risk Code</th>
                  <th>Objective</th>
                  <th>Risk Officer</th>
                  <th>Branch</th>
                  <th>After Mitigation</th>
                  <th>Status</th>
                  <th>Diperbarui</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-primary-700">{r.risk_code}</td>
                    <td className="max-w-[280px] text-slate-600">{r.objective}</td>
                    <td>{r.officer_name}</td>
                    <td className="text-xs">{r.branch_name}</td>
                    <td><LevelBadge {...(r.after || {})} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Link className="btn-secondary btn-sm" to={`/risk-registers/${r.id}`}>Lihat Register</Link>
                        <Link className="btn-primary btn-sm" to={`/follow-ups/${r.id}`}>
                          {ACTION_LABEL[r.status] || 'Buka Tindak Lanjut'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
