import { useCallback, useEffect, useState } from 'react';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Field, Pagination } from '../../components/ui/Common';
import { useToast } from '../../contexts/ToastContext';

export default function AuditTrailPage() {
  const toast = useToast();
  const [data, setData] = useState({ data: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ action: '', entity: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', { params: { page, limit: 20, ...filter } });
      setData(res.data);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pretty = (v) => {
    if (!v) return '';
    try {
      return JSON.stringify(JSON.parse(v));
    } catch {
      return String(v);
    }
  };

  return (
    <div>
      <PageHeader title="History / Audit Trail" subtitle="Log aktivitas penting sistem (tanpa data sensitif)" />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Action">
            <input
              className="input"
              placeholder="contoh: SUBMIT_RISK_REGISTER"
              value={filter.action}
              onChange={(e) => {
                setFilter((f) => ({ ...f, action: e.target.value }));
                setPage(1);
              }}
            />
          </Field>
          <Field label="Entity">
            <select
              className="input"
              value={filter.entity}
              onChange={(e) => {
                setFilter((f) => ({ ...f, entity: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              <option value="risk_registers">risk_registers</option>
              <option value="users">users</option>
              <option value="branches">branches</option>
              <option value="categories">categories (master)</option>
              <option value="treatments">treatments (master)</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : !data.data?.length ? (
          <EmptyState title="Belum ada audit log" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[900px]">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP</th>
                  <th>Old → New</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                    <td>{a.user_name || a.username || '-'}</td>
                    <td className="text-xs">{a.role || '-'}</td>
                    <td className="font-semibold text-primary-700">{a.action}</td>
                    <td className="text-xs">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                    <td className="text-xs text-slate-400">{a.ip || '-'}</td>
                    <td className="max-w-[340px] text-xs text-slate-500">
                      <span className="break-all">
                        {pretty(a.old_value) && <span>{pretty(a.old_value)} → </span>}
                        {pretty(a.new_value) || '-'}
                      </span>
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
