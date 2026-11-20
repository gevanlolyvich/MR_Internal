import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { parseError, downloadDocument } from '../../api/client';
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

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'BELUM_MEMADAI', label: 'Belum Memadai' },
  { value: 'TIDAK_DAPAT_DITINDAKLANJUTI', label: 'Tidak Dapat Ditindaklanjuti' },
  { value: 'SELESAI', label: 'Selesai' },
];

const statusLabel = (value) => FOLLOW_UP_STATUS_OPTIONS.find((o) => o.value === value)?.label || value || '-';

const parseMitigations = (raw) => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
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
  const [levels, setLevels] = useState([]);
  const [followUpDraft, setFollowUpDraft] = useState({});

  const load = useCallback(async () => {
    try {
      const [detail, hist] = await Promise.all([
        api.get(`/risk-registers/${id}`),
        api.get(`/risk-registers/${id}/history`),
      ]);
      setData(detail.data.data);
      setHistory(hist.data.data);
      setOpenVersions(hist.data.data?.mitigations?.[0]?.id ?? null);
      const drafts = {};
      (detail.data.data.categories || []).forEach((c) =>
        (c.events || []).forEach((e) =>
          parseMitigations(e.mitigation_items).forEach((it) => {
            if (it?.id && it.follow_up_status) drafts[it.id] = it.follow_up_status;
          })
        )
      );
      setFollowUpDraft(drafts);
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

  useEffect(() => {
    api.get('/masters/levels').then((r) => setLevels(r.data.data || [])).catch(() => {});
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Data tidak ditemukan" />;

  const levelOfScore = (s) => levels.find((l) => s != null && s >= l.min_score && s <= l.max_score)?.level;

  const isOwner = user?.role === 'RISK_OWNER';
  const isMR = user?.role === 'MR';
  const canApproveOwner = isOwner && data.status === 'WAITING_OWNER_APPROVAL' && data.risk_owner_id === user.id;
  const canApproveMR = isMR && data.status === 'WAITING_MR_APPROVAL';
  const approvable = canApproveOwner || canApproveMR;
  const canEditBtn =
    can('risk-register:edit') &&
    ['DRAFT', 'REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(data.status) &&
    (isMR || data.risk_officer_id === user?.id);

  const canSetFollowUpStatus = isMR && data.status === 'WAITING_MR_APPROVAL';
  const allMitigationItems = (data.categories || []).flatMap((c) =>
    (c.events || []).flatMap((e) =>
      parseMitigations(e.mitigation_items).map((it) => ({ ...it, eventName: e.name }))
    )
  );
  const statusOf = (it) => followUpDraft[it.id] || it.follow_up_status;
  const statusesComplete =
    allMitigationItems.length > 0 && allMitigationItems.every((it) => !!statusOf(it));
  const mrNeedsStatus = canSetFollowUpStatus && !statusesComplete;

  const saveFollowUpStatuses = async () => {
    const items = allMitigationItems
      .map((it) => ({ itemId: it.id, status: statusOf(it) }))
      .filter((x) => x.itemId && x.status);
    if (!items.length) {
      toast.error('Belum ada status tindak lanjut yang diisi');
      return;
    }
    setBusy(true);
    try {
      await api.put(`/approvals/${id}/follow-up-status`, { items });
      toast.success('Status tindak lanjut disimpan');
      await load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

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
                <button
                  className="btn-danger"
                  disabled={mrNeedsStatus}
                  title={mrNeedsStatus ? 'Lengkapi status tindak lanjut terlebih dahulu' : undefined}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </button>
                <button
                  className="btn-success"
                  disabled={mrNeedsStatus}
                  title={mrNeedsStatus ? 'Lengkapi status tindak lanjut terlebih dahulu' : undefined}
                  onClick={() => setApproveOpen(true)}
                >
                  Approve
                </button>
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
                (cat.events || []).map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">{cat.category_name}</p>
                        <p className="text-sm font-semibold text-slate-700">{ev.name}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>Causes: <b>{(ev.causes || []).map((c) => c.name).join('; ') || '-'}</b></p>
                      </div>
                    </div>
                    <div className="mb-3 space-y-1">
                      {(ev.causes || []).map((cs) => (
                        <div key={cs.id} className="flex flex-wrap justify-between gap-2 rounded bg-white px-2 py-1 text-xs text-slate-600">
                          <span>Cause: <b>{cs.name}</b>{cs.source_name ? ` · Sumber: ${cs.source_name}` : ''}</span>
                          <span>
                            Severity: <b>{cs.severity_description || '-'}</b> · Rp:{' '}
                            <b>{cs.rp_amount != null ? Number(cs.rp_amount).toLocaleString('id-ID') : '-'}</b>
                            {' · '}Unit: <b>{cs.work_unit || '-'}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <AssessBox
                        title="Inherent Risk"
                        d={{ likelihood: ev.inherent_likelihood, impact: ev.inherent_impact, score: ev.inherent_score, level: levelOfScore(ev.inherent_score) }}
                      />
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-bold uppercase text-slate-500">Existing Control</p>
                        <p className="text-sm">Ada/Tidak: <b>{ev.control_present || '-'}</b></p>
                        <p className="text-sm">Memadai: <b>{ev.control_adequacy || '-'}</b></p>
                        <p className="text-sm">Dijalankan: <b>{ev.control_implementation_pct != null ? `${ev.control_implementation_pct}%` : '-'}</b></p>
                      </div>
                      <AssessBox
                        title="Residual Risk"
                        d={{ likelihood: ev.residual_likelihood, impact: ev.residual_impact, score: ev.residual_score, level: levelOfScore(ev.residual_score) }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'treatment' && (
            <div className="space-y-3">
              {!data.categories?.length && <EmptyState title="Belum ada data" />}
              {canSetFollowUpStatus && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Penilaian Tindak Lanjut</p>
                  <p className="mt-1 text-xs">
                    Isi status untuk {allMitigationItems.length} tindakan mitigasi sebelum Approve/Reject.
                    {!statusesComplete && ` Belum diisi: ${allMitigationItems.filter((it) => !statusOf(it)).length} item.`}
                  </p>
                  <button
                    className="btn-primary btn-sm mt-2"
                    disabled={!statusesComplete || busy}
                    onClick={saveFollowUpStatuses}
                  >
                    {busy ? 'Menyimpan...' : 'Simpan Status Tindak Lanjut'}
                  </button>
                </div>
              )}
              {(data.categories || []).map((cat) =>
                (cat.events || []).map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">{cat.category_name} / {ev.name}</p>
                      <LevelBadge level={levelOfScore(ev.after_score)} score={ev.after_score} />
                    </div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Risk Treatment (Mitigasi)</p>
                    {(() => {
                      const items = parseMitigations(ev.mitigation_items);
                      if (!items.length) return <p className="mt-1 text-sm text-slate-400">-</p>;
                      return (
                        <ol className="mt-1 list-decimal space-y-3 pl-5 text-sm text-slate-600">
                          {items.map((it, i) => (
                            <li key={it.id || i} className="space-y-1">
                              <div className="font-medium">{it.description}</div>
                              {it.follow_up && (
                                <div className="text-xs text-slate-500">Tindak lanjut: {it.follow_up}</div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-slate-500">Status:</span>
                                {canSetFollowUpStatus ? (
                                  <select
                                    className="input w-auto py-1 text-xs"
                                    value={statusOf(it) || ''}
                                    onChange={(e) => setFollowUpDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                                  >
                                    <option value="">- pilih -</option>
                                    {FOLLOW_UP_STATUS_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={it.follow_up_status ? 'font-semibold text-primary-700' : 'text-slate-400'}>
                                    {it.follow_up_status ? statusLabel(it.follow_up_status) : 'Belum dinilai'}
                                  </span>
                                )}
                              </div>
                              {(it.documents || []).length > 0 && (
                                <div className="text-xs">
                                  <span className="font-semibold text-slate-500">Bukti:</span>{' '}
                                  {it.documents.map((d) => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      className="mr-2 text-primary-700 hover:underline"
                                      onClick={() => downloadDocument(id, d.id, d.original_name)}
                                    >
                                      {d.original_name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {(it.follow_up_history || []).length > 0 && (
                                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                                  <p className="font-semibold text-slate-500">Riwayat Tindak Lanjut</p>
                                  {it.follow_up_history.map((h, hi) => (
                                    <div key={hi} className="mt-1 border-t border-slate-200 pt-1 first:border-0 first:pt-0">
                                      <p>
                                        Tindak lanjut: {h.follow_up || '-'} · Status:{' '}
                                        {h.follow_up_status ? statusLabel(h.follow_up_status) : '-'}
                                      </p>
                                      <p className="text-slate-500">
                                        {h.action} · {h.reason || '-'} ·{' '}
                                        {h.archived_at ? new Date(h.archived_at).toLocaleString('id-ID') : '-'}
                                      </p>
                                      {(h.documents || []).map((d) => (
                                        <button
                                          key={d.id}
                                          type="button"
                                          className="mr-2 text-primary-700 hover:underline"
                                          onClick={() => downloadDocument(id, d.id, d.original_name)}
                                        >
                                          {d.original_name}
                                        </button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ol>
                      );
                    })()}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Inherent: {ev.inherent_likelihood} × {ev.inherent_impact} = {ev.inherent_score}</span>
                      <span>Residual: {ev.residual_likelihood} × {ev.residual_impact} = {ev.residual_score}</span>
                      <span>After: {ev.after_likelihood} × {ev.after_impact} = {ev.after_score}</span>
                    </div>
                  </div>
                ))
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
                  open={openVersions === m.id}
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
                          {(it.causes || []).map((cs, ci) => (
                            <p key={ci} className="text-slate-700">
                              {cs.name}
                              {cs.severity_description ? ` — ${cs.severity_description}` : ''}
                              {cs.rp_amount != null ? ` (Rp ${Number(cs.rp_amount).toLocaleString('id-ID')})` : ''}
                              {cs.work_unit ? ` · Unit: ${cs.work_unit}` : ''}
                            </p>
                          ))}
                          <p className="mt-1 text-xs font-semibold uppercase text-slate-400">Mitigasi</p>
                          <ol className="list-decimal pl-5 text-slate-600">
                            {(it.mitigation_items || []).map((mi, mii) => (
                              <li key={mii}>
                                {typeof mi === 'string' ? mi : mi.description}
                                {typeof mi !== 'string' && mi.follow_up && (
                                  <span className="block text-xs text-slate-500">Tindak lanjut: {mi.follow_up}</span>
                                )}
                              </li>
                            ))}
                          </ol>
                          <p className="mt-1 text-xs text-slate-500">
                            Inherent: {it.inherent?.likelihood} × {it.inherent?.impact} = {it.inherent?.score} ·
                            Residual: {it.residual?.likelihood} × {it.residual?.impact} = {it.residual?.score} ·
                            After: {it.after?.likelihood} × {it.after?.impact} = {it.after?.score}
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
  if (!d || d.score === null || d.score === undefined) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-bold uppercase text-slate-500">{title}</p>
        <p className="text-sm text-slate-400">-</p>
      </div>
    );
  }
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
