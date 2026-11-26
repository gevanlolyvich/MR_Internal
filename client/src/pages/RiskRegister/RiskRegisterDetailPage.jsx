import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import api, { parseError, downloadDocument } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, Tabs, Field, CollapsibleSection, WorkflowStepper } from '../../components/ui/Common';
import { StatusBadge, LevelBadge, ToleranceBadge } from '../../components/ui/Badges';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { WORKFLOW_STEPS, REJECTED_STATUSES } from '../../constants';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'assessment', label: 'Risk Assessment' },
  { key: 'treatment', label: 'Risk Treatment' },
  { key: 'approval', label: 'Approval History' },
  { key: 'mitigation', label: 'Riwayat Risk Treatment' },
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
  MR_INSTRUCTION: 'Instruksi diberikan MR',
  OFFICER_REALIZATION: 'Realisasi dikirim Officer',
  REJECT_MR_INSTRUCTION: 'Instruksi dikembalikan MR',
  MR_FINAL: 'Penilaian akhir MR',
  MR_FINAL_RETURN: 'Dikembalikan MR untuk tindak lanjut',
};

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'BELUM_MEMADAI', label: 'Belum Sesuai' },
  { value: 'TIDAK_DAPAT_DITINDAKLANJUTI', label: 'Belum Ditindaklanjuti' },
  { value: 'SELESAI', label: 'Sesuai / Selesai' },
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
  const [tab, setTab] = useState('treatment');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openVersions, setOpenVersions] = useState(null);
  const [levels, setLevels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [instructionDraft, setInstructionDraft] = useState({});
  const [realizationDraft, setRealizationDraft] = useState({});
  const [finalDraft, setFinalDraft] = useState({});
  const [uploadingItem, setUploadingItem] = useState(null);

  const load = useCallback(async () => {
    try {
      const [detail, hist, cats] = await Promise.all([
        api.get(`/risk-registers/${id}`),
        api.get(`/risk-registers/${id}/history`),
        api.get('/masters/categories'),
      ]);
      setData(detail.data.data);
      setHistory(hist.data.data);
      setCategories(cats.data.data || []);
      setOpenVersions(hist.data.data?.mitigations?.[0]?.id ?? null);
      const instr = {};
      const real = {};
      const final = {};
      (detail.data.data.categories || []).forEach((c) =>
        (c.events || []).forEach((e) =>
          parseMitigations(e.mitigation_items).forEach((it) => {
            if (!it?.id) return;
            instr[it.id] = {
              text: it.instruction?.text || it.follow_up || '',
              note: it.instruction?.note || '',
            };
            real[it.id] = it.realization?.note || '';
            final[it.id] = { status: it.follow_up_status || '', note: it.mr_note || '' };
          })
        )
      );
      setInstructionDraft(instr);
      setRealizationDraft(real);
      setFinalDraft(final);
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
  const categoryNameOf = (value) =>
    categories.find((c) => String(c.id) === String(value))?.name || value || '-';

  const isOfficer = user?.role === 'RISK_OFFICER';
  const isOwner = user?.role === 'RISK_OWNER';
  const isMR = user?.role === 'MR';
  const canSetInstruction = false;
  const canRealize = false;
  const canSetFollowUpStatus = false;
  const canApproveOwner = isOwner && data.status === 'WAITING_OWNER_APPROVAL' && data.risk_owner_id === user.id;
  const canApproveMR = false;
  const canRejectInstruction = false;
  const approvable = canApproveOwner;
  const followUpAction =
    (isMR && ['WAITING_MR_INSTRUCTION', 'WAITING_MR_APPROVAL'].includes(data.status)) ||
    (isOfficer && data.status === 'WAITING_OFFICER_FOLLOWUP' && data.risk_officer_id === user?.id);
  const canEditBtn =
    can('risk-register:edit') &&
    ['DRAFT', 'REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(data.status) &&
    data.risk_officer_id === user?.id;

  const allMitigationItems = (data.categories || []).flatMap((c) =>
    (c.events || []).flatMap((e) =>
      parseMitigations(e.mitigation_items).map((it) => ({ ...it, eventName: e.name }))
    )
  );
  const instructionOf = (it) =>
    instructionDraft[it.id] || { text: it.instruction?.text || it.follow_up || '', note: it.instruction?.note || '' };
  const realizationOf = (it) => realizationDraft[it.id] ?? it.realization?.note ?? '';
  const finalOf = (it) => finalDraft[it.id] || { status: it.follow_up_status || '', note: it.mr_note || '' };
  const instructionsComplete =
    allMitigationItems.length > 0 && allMitigationItems.every((it) => instructionOf(it).text.trim() && instructionOf(it).note.trim());
  const realizationsComplete =
    allMitigationItems.length > 0 && allMitigationItems.every((it) => String(realizationOf(it)).trim());
  const finalsComplete =
    allMitigationItems.length > 0 && allMitigationItems.every((it) => finalOf(it).status && String(finalOf(it).note).trim());
  const mrNeedsStatus = canApproveMR && !finalsComplete;

  const rejectedNote = REJECTED_STATUSES.includes(data.status)
    ? (history?.approvals || []).slice().reverse().find((a) => a.action?.startsWith('REJECT'))
    : null;

  const stepByStatus = {
    DRAFT: 0,
    WAITING_OWNER_APPROVAL: 1,
    REJECTED_BY_OWNER: 1,
    WAITING_MR_INSTRUCTION: 2,
    WAITING_OFFICER_FOLLOWUP: 3,
    WAITING_MR_APPROVAL: 4,
    REJECTED_BY_MR: 4,
    APPROVED: 4,
    ARCHIVED: 4,
  };
  const currentStep = stepByStatus[data.status] ?? 0;

  const stageInfo = rejectedNote
    ? {
        title: 'Dikembalikan ke Officer',
        desc: `${rejectedNote.actor_role === 'MR' ? 'MR' : 'Risk Owner'} mengembalikan register. Perbaiki sesuai alasan di bawah, lalu kirim ulang.`,
        actor: 'Risk Officer',
      }
    : {
        DRAFT: { title: 'Disusun oleh Officer', desc: 'Lengkapi assessment & tindakan mitigasi, simpan draft, lalu Submit dari daftar Risk Register.', actor: 'Risk Officer' },
        WAITING_OWNER_APPROVAL: { title: 'Menunggu Approval Owner', desc: 'Risk Owner menyetujui atau mengembalikan register sebelum masuk ke tahap tindak lanjut.', actor: 'Risk Owner' },
        WAITING_MR_INSTRUCTION: { title: 'MR memberi instruksi tindak lanjut', desc: 'Buka menu Tindak Lanjut untuk mengisi instruksi dan keterangan MR per item mitigasi.', actor: 'MR' },
        WAITING_OFFICER_FOLLOWUP: { title: 'Officer mengisi tindak lanjut', desc: 'Buka menu Tindak Lanjut untuk menulis realisasi dan mengunggah bukti pendukung.', actor: 'Risk Officer' },
        WAITING_MR_APPROVAL: { title: 'MR menilai hasil tindak lanjut', desc: 'Buka menu Tindak Lanjut untuk menilai setiap item; item belum sesuai dikembalikan ke Officer.', actor: 'MR' },
        APPROVED: { title: 'Selesai', desc: 'Risk Register telah disetujui MR.', actor: '-' },
      }[data.status] || { title: data.status, desc: '', actor: '-' };

  const assessmentsPayload = () =>
    allMitigationItems.map((it) => ({
      itemId: it.id,
      status: finalOf(it).status,
      note: String(finalOf(it).note).trim(),
    }));

  const saveInstructions = async () => {
    if (!instructionsComplete) {
      toast.error('Instruksi dan keterangan MR wajib diisi untuk semua item');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/risk-registers/${id}/mr-instruction`, {
        items: allMitigationItems.map((it) => ({
          itemId: it.id,
          text: String(instructionOf(it).text).trim(),
          note: String(instructionOf(it).note).trim(),
        })),
      });
      toast.success('Instruksi dikirim ke Officer');
      await load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const saveRealizations = async () => {
    if (!realizationsComplete) {
      toast.error('Keterangan realisasi wajib diisi untuk semua item');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/risk-registers/${id}/follow-up-realization`, {
        items: allMitigationItems.map((it) => ({
          itemId: it.id,
          note: String(realizationOf(it)).trim(),
        })),
      });
      toast.success('Realisasi dikirim ke Risk Owner');
      await load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadEvidence = async (itemId, files) => {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    setUploadingItem(itemId);
    try {
      await api.post(`/risk-registers/${id}/mitigation-items/${itemId}/documents`, form);
      toast.success('Bukti dokumen diunggah');
      await load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setUploadingItem(null);
    }
  };

  const DocLinks = ({ docs }) =>
    (docs || []).length ? (
      <>
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            className="mr-2 text-primary-700 hover:underline"
            onClick={() => downloadDocument(id, d.id, d.original_name)}
          >
            {d.original_name}
          </button>
        ))}
      </>
    ) : (
      <span className="text-slate-400">-</span>
    );

  const doApprove = async () => {
    setBusy(true);
    try {
      await api.post(`/approvals/${id}/approve`, isMR ? { assessments: assessmentsPayload() } : {});
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
      toast.error('Alasan wajib diisi');
      return;
    }
    setBusy(true);
    try {
      if (canRejectInstruction) {
        await api.post(`/approvals/${id}/reject-instruction`, { reason: rejectReason.trim() });
      } else {
        const body = { reason: rejectReason.trim() };
        if (isMR && finalsComplete) body.assessments = assessmentsPayload();
        await api.post(`/approvals/${id}/reject`, body);
      }
      toast.success('Risk Register dikembalikan ke Officer');
      setRejectOpen(false);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-10">
      <PageHeader
        title={data.risk_code}
        subtitle={data.objective}
        actions={
          <>
            <Link to="/risk-registers" className="btn-secondary">← Kembali</Link>
            {followUpAction && (
              <Link to={`/follow-ups/${id}`} className="btn-primary">Buka Tindak Lanjut</Link>
            )}
            {canEditBtn && (
              <Link to={`/risk-registers/${id}/edit`} className="btn-secondary">Edit</Link>
            )}
            {approvable && (
              <>
                <button
                  className="btn-danger"
                  disabled={mrNeedsStatus}
                  title={mrNeedsStatus ? 'Lengkapi status & keterangan MR terlebih dahulu' : undefined}
                  onClick={() => setRejectOpen(true)}
                >
                  Kembalikan ke Officer
                </button>
                {(canApproveOwner || canApproveMR) && (
                  <button
                    className="btn-success"
                    disabled={mrNeedsStatus}
                    title={mrNeedsStatus ? 'Lengkapi status & keterangan MR terlebih dahulu' : undefined}
                    onClick={() => setApproveOpen(true)}
                  >
                    {canApproveOwner ? 'Setujui Realisasi' : 'Setujui Penilaian'}
                  </button>
                )}
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

      <WorkflowStepper steps={WORKFLOW_STEPS} currentIndex={currentStep} rejected={!!rejectedNote} />

      <div className={clsx('mb-4 rounded-md border px-4 py-3', rejectedNote ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={clsx('text-sm font-semibold', rejectedNote ? 'text-red-800' : 'text-blue-800')}>
            {stageInfo.title}
          </p>
          <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', rejectedNote ? 'border-red-300 bg-white text-red-700' : 'border-blue-300 bg-white text-blue-700')}>
            Diisi oleh: {stageInfo.actor}
          </span>
        </div>
        <p className={clsx('mt-1 text-xs', rejectedNote ? 'text-red-700' : 'text-blue-700')}>{stageInfo.desc}</p>
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
            <div className="space-y-4">
              {!data.categories?.length && <EmptyState title="Belum ada data" />}

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">Tindak lanjut dikelola di menu khusus</p>
                    <p className="mt-1">
                      Tab ini hanya menampilkan catatan. Instruksi MR, realisasi & bukti Officer, serta penilaian MR
                      dilakukan di menu <b>Tindak Lanjut</b>. Riwayat pengembalian tetap tampil di bawah.
                    </p>
                  </div>
                  <Link to={`/follow-ups/${id}`} className="btn-secondary btn-sm">Buka Tindak Lanjut</Link>
                </div>
              </div>

              {(data.categories || []).map((cat) =>
                (cat.events || []).map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">{cat.category_name} / {ev.name}</p>
                      <LevelBadge level={levelOfScore(ev.after_score)} score={ev.after_score} />
                    </div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Risk Treatment</p>
                    {(() => {
                      const items = parseMitigations(ev.mitigation_items);
                      if (!items.length) return <p className="mt-1 text-sm text-slate-400">-</p>;
                      return (
                        <ol className="mt-2 list-decimal space-y-4 pl-5 text-sm text-slate-600">
                          {items.map((it, i) => {
                            const instr = instructionOf(it);
                            const real = realizationOf(it);
                            const fin = finalOf(it);
                            return (
                              <li key={it.id || i} className="rounded-md border border-slate-200 bg-white p-3">
                                <p className="font-medium text-slate-700">{it.description}</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase text-slate-400">Instruksi MR</p>
                                    {canSetInstruction ? (
                                      <div className="mt-1 space-y-2">
                                        <textarea
                                          className="input"
                                          rows={2}
                                          placeholder="Instruksi tindak lanjut"
                                          value={instr.text}
                                          onChange={(e) =>
                                            setInstructionDraft((d) => ({
                                              ...d,
                                              [it.id]: { ...instr, text: e.target.value },
                                            }))
                                          }
                                        />
                                        <textarea
                                          className="input"
                                          rows={2}
                                          placeholder="Keterangan MR"
                                          value={instr.note}
                                          onChange={(e) =>
                                            setInstructionDraft((d) => ({
                                              ...d,
                                              [it.id]: { ...instr, note: e.target.value },
                                            }))
                                          }
                                        />
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-xs">
                                        <p>{instr.text || '-'}</p>
                                        <p className="mt-1 text-slate-500">Keterangan MR: {instr.note || '-'}</p>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase text-slate-400">Realisasi Officer</p>
                                    {canRealize ? (
                                      <div className="mt-1 space-y-2">
                                        <textarea
                                          className="input"
                                          rows={2}
                                          placeholder="Keterangan realisasi"
                                          value={real}
                                          onChange={(e) => setRealizationDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                                        />
                                        <input
                                          type="file"
                                          multiple
                                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                                          className="input py-1 text-xs"
                                          onChange={(e) => uploadEvidence(it.id, e.target.files)}
                                        />
                                        {uploadingItem === it.id && (
                                          <p className="text-[11px] text-slate-500">Mengunggah bukti...</p>
                                        )}
                                        <p className="text-[11px] text-slate-400">Maks. 5 file & 5 MB/file. Gambar, Excel, PowerPoint, PDF, atau Word.</p>
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-xs">{real || '-'}</p>
                                    )}
                                    <div className="mt-2 text-xs">
                                      <span className="font-semibold text-slate-500">Bukti:</span>{' '}
                                      <DocLinks docs={it.documents} />
                                    </div>
                                  </div>
                                </div>

                                {(canSetFollowUpStatus || fin.status) && (
                                  <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-semibold uppercase text-slate-400">Penilaian Akhir MR</p>
                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                      <div>
                                        <p className="text-xs text-slate-500">Status</p>
                                        {canSetFollowUpStatus ? (
                                          <select
                                            className="input mt-1 py-1 text-xs"
                                            value={fin.status}
                                            onChange={(e) =>
                                              setFinalDraft((d) => ({
                                                ...d,
                                                [it.id]: { ...fin, status: e.target.value },
                                              }))
                                            }
                                          >
                                            <option value="">- pilih -</option>
                                            {FOLLOW_UP_STATUS_OPTIONS.map((o) => (
                                              <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <p className={clsx('mt-1 text-xs font-semibold', fin.status ? 'text-primary-700' : 'text-slate-400')}>
                                            {fin.status ? statusLabel(fin.status) : 'Belum dinilai'}
                                          </p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">Keterangan MR</p>
                                        {canSetFollowUpStatus ? (
                                          <textarea
                                            className="input mt-1 py-1 text-xs"
                                            rows={2}
                                            placeholder="Keterangan MR"
                                            value={fin.note}
                                            onChange={(e) =>
                                              setFinalDraft((d) => ({
                                                ...d,
                                                [it.id]: { ...fin, note: e.target.value },
                                              }))
                                            }
                                          />
                                        ) : (
                                          <p className="mt-1 text-xs">{fin.note || '-'}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {(it.follow_up_history || []).length > 0 && (
                                  <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                                    <p className="font-semibold text-slate-500">Riwayat Risk Treatment</p>
                                    {it.follow_up_history.map((h, hi) => (
                                      <div key={hi} className="mt-1 border-t border-slate-200 pt-1 first:border-0 first:pt-0">
                                        <p>Instruksi: {h.instruction?.text || h.follow_up || '-'}</p>
                                        <p>Keterangan MR: {h.instruction?.note || '-'}</p>
                                        <p>Realisasi: {h.realization?.note || '-'}</p>
                                        <p>
                                          Status: {h.follow_up_status ? statusLabel(h.follow_up_status) : '-'} · Keterangan: {h.mr_note || '-'}
                                        </p>
                                        <p className="text-slate-500">
                                          {ACTION_LABEL[h.action] || h.action} · {h.reason || '-'} ·{' '}
                                          {h.archived_at ? new Date(h.archived_at).toLocaleString('id-ID') : '-'}
                                        </p>
                                        <DocLinks docs={h.documents} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      );
                    })()}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
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
                          <p className="text-xs text-slate-400">{categoryNameOf(it.category)} / {it.event}</p>
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
                                {typeof mi !== 'string' && (mi.instruction?.text || mi.follow_up) && (
                                  <span className="block text-xs text-slate-500">
                                    Instruksi MR: {mi.instruction?.text || mi.follow_up}
                                    {mi.instruction?.note ? ` · ${mi.instruction.note}` : ''}
                                  </span>
                                )}
                                {typeof mi !== 'string' && mi.realization?.note && (
                                  <span className="block text-xs text-slate-500">Realisasi: {mi.realization.note}</span>
                                )}
                                {typeof mi !== 'string' && mi.follow_up_status && (
                                  <span className="block text-xs text-slate-500">
                                    Status: {statusLabel(mi.follow_up_status)} · {mi.mr_note || '-'}
                                  </span>
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
        title={canApproveOwner ? 'Setujui Realisasi' : 'Setujui Penilaian'}
        message={
          canApproveOwner
            ? 'Apakah Anda yakin realisasi & bukti tindak lanjut sudah memadai? Register akan dilanjutkan ke penilaian akhir MR.'
            : 'Penilaian akhir MR akan disimpan dan Risk Register disetujui. Lanjutkan?'
        }
        confirmLabel="Ya, Setujui"
      />

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Kembalikan ke Officer"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRejectOpen(false)} disabled={busy}>Batal</button>
            <button className="btn-danger" onClick={doReject} disabled={busy}>
              {busy ? 'Memproses...' : 'Kembalikan'}
            </button>
          </>
        }
      >
        <Field label="Alasan Pengembalian" required>
          <textarea
            className="input min-h-[110px]"
            placeholder="Contoh: Bukti realisasi belum menjelaskan hasil tindak lanjut."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </Field>
        <p className="mt-2 text-xs text-slate-400">
          Risk Register akan dikembalikan ke Risk Officer untuk diperbaiki pada tahap terkait.
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
