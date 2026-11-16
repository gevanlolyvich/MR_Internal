import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Tabs, Field, CollapsibleSection } from '../../components/ui/Common';
import { StatusBadge, LevelBadge, ToleranceBadge } from '../../components/ui/Badges';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'assessment', label: 'Risk Assessment' },
  { key: 'treatment', label: 'Risk Treatment' },
  { key: 'approval', label: 'Approval History' },
  { key: 'mitigation', label: 'Mitigation History' },
  { key: 'audit', label: 'Audit Trail' },
];

const ACTION_LABEL = {
  SUBMIT: 'Risk Officer submitted',
  APPROVE_OWNER: 'Risk Owner approved',
  REJECT_OWNER: 'Risk Owner rejected',
  APPROVE_MR: 'MR approved',
  REJECT_MR: 'MR rejected',
  ARCHIVE: 'Diarsipkan',
  CREATE: 'Dibuat',
  UPDATE_MITIGATION: 'Mitigation diperbarui',
};

function KeyValue({ k, v }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="text-sm text-slate-700">{v || '-'}</dd>
    </div>
  );
}

export default function RiskRegisterDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openVersions, setOpenVersions] = useState(null);

  const load = useCallback(async () => {
    try {
      const [detail, hist] = await Promise.all([
        api.get(`/risk-registers/${id}`),
        api.get(`/risk-registers/${id}/history`),
      ]);
      setData(detail.data.data);
      setHistory(hist.data.data);
    } catch (err) {
      toast.error(parseError(err).message);
      navigate('/risk-registers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Data tidak ditemukan" />;

  const isOwner = user?.role === 'RISK_OWNER';
  const isMR = user?.role === 'MR';
  const canApproveOwner = isOwner && data.status === 'WAITING_OWNER_APPROVAL' && data.risk_owner_id === user.id;
  const canApproveMR = isMR && data.status === 'WAITING_MR_APPROVAL';
  const approvable = canApproveOwner || canApproveMR;
  const canEditBtn =
    can('risk-register:edit') &&
    ['DRAFT', 'REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(data.status) &&
    (isMR || data.risk_officer_id === user?.id);

  const doApprove = async () => {
    setBusy(true);
    try {
      await api.post(`/approvals/${id}/approve`);
      toast.success('Risk Register disetujui');
      setApproveOpen(false);
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Alasan Reject wajib diisi');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/approvals/${id}/reject`, { reason: rejectReason.trim() });
      toast.success('Risk Register ditolak dan dikembalikan ke Risk Officer');
      setRejectOpen(false);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const rejectedNote =
    data.status === 'REJECTED_BY_OWNER' || data.status === 'REJECTED_BY_MR'
      ? (history?.approvals || []).slice().reverse().find((a) => a.action?.startsWith('REJECT'))
      : null;

  return (
    <div className="pb-10">
      <PageHeader
        title={data.risk_code}
        subtitle={data.objective}
        actions={
          <>
            <Link to="/risk-registers" className="btn-secondary">← Kembali</Link>
            {canEditBtn && (
              <Link to={`/risk-registers/${id}/edit`} className="btn-secondary">Edit</Link>
            )}
            {approvable && (
              <>
                <button className="btn-danger" onClick={() => setRejectOpen(true)}>Reject</button>
                <button className="btn-success" onClick={() => setApproveOpen(true)}>Approve</button>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={data.status} />
        {data.aggregates?.after && (
          <LevelBadge level={data.aggregates.after.level} score={data.aggregates.after.score} />
        )}
        {data.aggregates?.after?.tolerance && (
          <ToleranceBadge status={data.aggregates.after.tolerance} />
        )}
        <span className="text-xs text-slate-400">Versi {data.current_version}</span>
      </div>

      {rejectedNote && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">
            Rejected By: {rejectedNote.actor_role === 'MR' ? 'MR' : 'Risk Owner'}
          </p>
          <p className="mt-1"><span className="font-semibold">Reason:</span> {rejectedNote.reason || '-'}</p>
        </div>
      )}

      <Card className="mb-4 p-0">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        <div className="p-4">
          {tab === 'overview' && (
            <div className="grid gap-x-8 md:grid-cols-2">
              <dl>
                <KeyValue k="Risk Code" v={data.risk_code} />
                <KeyValue k="Objective" v={data.objective} />
                <KeyValue k="Risk Category" v={(data.categories || []).map((c) => c.category_name).join(', ')} />
                <KeyValue k="Branch" v={data.branch_name} />
                <KeyValue k="Year" v={data.year} />
              </dl>
              <dl>
                <KeyValue k="Risk Officer" v={data.officer_name} />
                <KeyValue k="Risk Owner" v={data.owner_name} />
                <KeyValue k="Status" v={<StatusBadge status={data.status} />} />
                <KeyValue k="Created" v={new Date(data.created_at).toLocaleString('id-ID')} />
                <KeyValue k="Updated" v={new Date(data.updated_at).toLocaleString('id-ID')} />
              </dl>
            </div>
          )}

          {tab === 'assessment' && (
            <div className="space-y-3">
              {!data.categories?.length && <EmptyState title="Belum ada data" />}
              {(data.categories || []).map((cat) =>
                cat.events.map((ev) =>
                  ev.causes.map((cs) => (
                    <div key={cs.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">{cat.category_name}</p>
                          <p className="text-sm font-semibold text-slate-700">{ev.name}</p>
                          <p className="text-sm text-slate-600">Cause: {cs.name}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>Sumber: <b>{cs.source_name || '-'}</b></p>
                          <p>Severity: <b>{cs.severity_label || cs.severity_description || '-'}</b></p>
                          <p>Rp: <b>{cs.rp_amount ? Number(cs.rp_amount).toLocaleString('id-ID') : '-'}</b></p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <AssessBox title="Inherent Risk" d={cs.inherent} />
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-bold uppercase text-slate-500">Existing Control</p>
                          <p className="text-sm">Ada/Tidak: <b>{cs.control_present}</b></p>
                          <p className="text-sm">Memadai: <b>{cs.control_adequacy}</b></p>
                          <p className="text-sm">Dijalankan: <b>{cs.control_implementation_pct}%</b></p>
                        </div>
                        <AssessBox title="Residual Risk" d={cs.residual} />
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          )}

          {tab === 'treatment' && (
            <div className="space-y-3">
              {!data.categories?.length && <EmptyState title="Belum ada data" />}
              {(data.categories || []).map((cat) =>
                cat.events.map((ev) =>
                  ev.causes.map((cs) => (
                    <div key={cs.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">
                          {cat.category_name} / {ev.name} / {cs.name}
                        </p>
                        <LevelBadge level={cs.after?.level} score={cs.after?.score} />
                      </div>
                      <p className="text-xs font-semibold uppercase text-slate-400">Risk Treatment</p>
                      <p className="text-sm font-semibold text-primary-700">{cs.treatment_name || '-'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{cs.mitigation_description || '-'}</p>
                    </div>
                  ))
                )
              )}
            </div>
          )}

          {tab === 'approval' && (
            <ol className="relative ml-3 space-y-5 border-l border-slate-200">
              {!(history?.approvals || []).length && <li className="text-sm text-slate-400">Belum ada aktivitas approval.</li>}
              {(history?.approvals || []).map((a) => (
                <li key={a.id} className="ml-4">
                  <span
                    className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${
                      a.action.includes('REJECT') ? 'bg-jxb-red' : a.action.includes('APPROVE') ? 'bg-jxb-green' : 'bg-primary-600'
                    }`}
                  />
                  <p className="text-sm font-semibold text-slate-700">{ACTION_LABEL[a.action] || a.action}</p>
                  <p className="text-xs text-slate-500">
                    {a.actor_name} · {new Date(a.created_at).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.from_status} → {a.to_status}
                  </p>
                  {a.reason && (
                    <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Reason: {a.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {tab === 'mitigation' && (
            <div className="space-y-3">
              {!(history?.mitigations || []).length && <EmptyState title="Belum ada history mitigasi" />}
              {(history?.mitigations || []).map((m) => (
                <CollapsibleSection
                  key={m.id}
                  no={`v${m.version}`}
                  title={`${ACTION_LABEL[m.action] || m.action} — ${m.approval_status.replaceAll('_', ' ')}`}
                  defaultOpen={openVersions === m.id}
                  onToggle={() => setOpenVersions(openVersions === m.id ? null : m.id)}
                >
                  <p className="text-xs text-slate-400">
                    {m.creator_name} · {new Date(m.created_at).toLocaleString('id-ID')}
                  </p>
                  {m.rejection_reason && (
                    <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
                      Alasan reject: {m.rejection_reason}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {(() => {
                      let snap = null;
                      try {
                        snap = JSON.parse(m.snapshot);
                      } catch {
                        snap = null;
                      }
                      if (!snap?.items?.length) return <p className="text-sm text-slate-400">Snapshot tidak tersedia.</p>;
                      return snap.items.map((it, i) => (
                        <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="text-xs text-slate-400">{it.category} / {it.event}</p>
                          <p className="font-semibold text-slate-700">{it.cause}</p>
                          <p className="text-primary-700"><b>{it.treatment}</b></p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{it.mitigation_description}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Risk After Mitigation: {it.after?.likelihood} × {it.after?.impact} = {it.after?.score}
                          </p>
                        </div>
                      ));
                    })()}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          )}

          {tab === 'audit' && (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[700px]">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {!(history?.audit || []).length && (
                    <tr><td colSpan="5" className="py-6 text-center text-slate-400">Belum ada audit log</td></tr>
                  )}
                  {(history?.audit || []).map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                      <td>{a.user_name || '-'}</td>
                      <td className="text-xs">{a.role || '-'}</td>
                      <td className="font-semibold text-primary-700">{a.action}</td>
                      <td className="max-w-[320px] text-xs text-slate-500">
                        {a.old_value || a.new_value ? (
                          <pre className="whitespace-pre-wrap break-all">{[a.old_value, a.new_value].filter(Boolean).join(' → ')}</pre>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={doApprove}
        loading={busy}
        title="Approve Risk Register"
        message="Apakah Anda yakin ingin menyetujui Risk Register ini?"
        confirmLabel="Ya, Approve"
      />

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Risk Register"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRejectOpen(false)} disabled={busy}>Batal</button>
            <button className="btn-danger" onClick={doReject} disabled={busy}>
              {busy ? 'Memproses...' : 'Reject'}
            </button>
          </>
        }
      >
        <Field label="Alasan Reject" required>
          <textarea
            className="input min-h-[110px]"
            placeholder="Contoh: Mitigasi belum menjelaskan tindakan preventif secara detail."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </Field>
        <p className="mt-2 text-xs text-slate-400">
          Risk Register akan dikembalikan ke Risk Officer untuk memperbaiki Risk Treatment.
        </p>
      </Modal>
    </div>
  );
}

function AssessBox({ title, d }) {
  if (!d) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">{title}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          L {d.likelihood} × I {d.impact} = <b>{d.score}</b>
        </p>
        <LevelBadge level={d.level} score={d.score} showScore={false} />
      </div>
    </div>
  );
}
