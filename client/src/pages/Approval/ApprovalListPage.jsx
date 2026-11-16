import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Pagination } from '../../components/ui/Common';
import { StatusBadge, LevelBadge } from '../../components/ui/Badges';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function ApprovalListPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 15 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const isMR = user?.role === 'MR';
  const allowed = can('approval:owner') || can('approval:mr');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/approvals', { params: { page, limit: 15 } });
      setData(res.data);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [load, allowed]);

  if (!allowed) {
    return (
      <Card className="p-8 text-center">
        <p className="font-bold text-jxb-red">Akses ditolak</p>
        <p className="mt-1 text-sm text-slate-500">Menu Approval hanya untuk Risk Owner dan MR.</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Approval"
        subtitle={
          isMR
            ? 'Risk Register yang telah disetujui Risk Owner dan menunggu approval MR'
            : 'Risk Register yang menunggu approval Anda sebagai Risk Owner'
        }
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : !data.items.length ? (
          <EmptyState
            title="Tidak ada antrian approval"
            description={isMR ? 'Belum ada Risk Owner yang menyetujui Risk Register.' : 'Belum ada Risk Register yang disubmit ke Anda.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[900px]">
              <thead>
                <tr>
                  <th>Risk Code</th>
                  <th>Objective</th>
                  <th>Category</th>
                  <th>Risk Officer</th>
                  <th>Branch</th>
                  <th>After Mitigation</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-primary-700">{r.risk_code}</td>
                    <td className="max-w-[240px] text-slate-600">{r.objective}</td>
                    <td className="max-w-[170px] text-xs text-slate-500">{r.category_names || '-'}</td>
                    <td>{r.officer_name}</td>
                    <td className="text-xs">{r.branch_name}</td>
                    <td><LevelBadge {...(r.after || {})} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => navigate(`/risk-registers/${r.id}`)}
                        >
                          Lihat Detail
                        </button>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => navigate(`/risk-registers/${r.id}`)}
                        >
                          Proses Approval
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
