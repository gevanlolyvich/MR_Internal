import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import api, { parseError, downloadDocument } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState, WorkflowStepper } from '../../components/ui/Common';
import { StatusBadge } from '../../components/ui/Badges';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  STATUS,
  STATUS_LABEL,
  WORKFLOW_STEPS,
  FOLLOW_UP_STATUS_LABEL,
  FOLLOW_UP_STATUS_OPTIONS,
  FOLLOW_UP_DONE,
  FOLLOW_UP_RETURN,
} from '../../constants';

const ACTION_LABEL = {
  CREATE: 'Dibuat',
  SUBMIT: 'Dikirim',
  MR_INSTRUCTION: 'Instruksi MR',
  OFFICER_REALIZATION: 'Realisasi Officer',
  MR_FINAL: 'Penilaian MR',
  MR_FINAL_RETURN: 'Dikembalikan MR',
  REJECT_MR_INSTRUCTION: 'Instruksi dikembalikan',
  REJECT_OWNER: 'Dikembalikan Owner',
  REJECT_MR: 'Dikembalikan MR',
};

const ACTOR_LABEL = {
  MR: 'MR',
  RISK_OFFICER: 'Risk Officer',
  RISK_OWNER: 'Risk Owner',
};

const NOTE_LABEL = {
  MR_INSTRUCTION: 'Catatan MR',
  OFFICER_REALIZATION: 'Catatan Officer',
  MR_FINAL: 'Tanggapan MR',
  MR_FINAL_RETURN: 'Tanggapan MR',
};

const TIMELINE_STYLE = {
  MR_INSTRUCTION: {
    icon: 'M12 5v14M5 12h14',
    iconWrap: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100',
    border: 'border-l-blue-400',
  },
  OFFICER_REALIZATION: {
    icon: 'M12 16V4m0 0L8 8m4-4 4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
    iconWrap: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
    border: 'border-l-cyan-400',
  },
  MR_FINAL: {
    icon: 'M5 13l4 4L19 7',
    iconWrap: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    border: 'border-l-emerald-400',
  },
  MR_FINAL_RETURN: {
    icon: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-2',
    iconWrap: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
    border: 'border-l-amber-400',
  },
};

const TIMELINE_FALLBACK = {
  icon: 'M12 8h.01M12 12h.01M12 16h.01',
  iconWrap: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
  border: 'border-l-slate-300',
};

const STATUS_PILL = {
  SELESAI: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  BELUM_MEMADAI: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  TIDAK_DAPAT_DITINDAKLANJUTI: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const formatTimelineDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const STEP_BY_STATUS = {
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

const STAGE_INFO = {
  WAITING_MR_INSTRUCTION: {
    title: 'Beri instruksi tindak lanjut',
    desc: 'Isi instruksi dan keterangan MR untuk setiap item mitigasi, lalu kirim ke Officer.',
    actor: 'MR',
  },
  WAITING_OFFICER_FOLLOWUP: {
    title: 'Isi hasil tindak lanjut',
    desc: 'Tulis catatan realisasi dan unggah bukti untuk setiap instruksi MR, lalu kirim ke MR.',
    actor: 'Risk Officer',
  },
  WAITING_MR_APPROVAL: {
    title: 'Nilai bukti dan catatan',
    desc: 'Berikan status dan tanggapan per item. Item yang belum sesuai akan dikembalikan ke Officer.',
    actor: 'MR',
  },
  APPROVED: {
    title: 'Selesai',
    desc: 'Semua tindak lanjut telah dinilai dan disetujui MR.',
    actor: 'MR',
  },
  ARCHIVED: {
    title: 'Diarsipkan',
    desc: 'Risk Register dan tindak lanjutnya telah diarsipkan.',
    actor: 'MR',
  },
};

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

const findItemInDetail = (detail, itemId) => {
  for (const category of detail?.categories || []) {
    for (const event of category.events || []) {
      const found = parseMitigations(event.mitigation_items).find((it) => String(it.id) === String(itemId));
      if (found) return found;
    }
  }
  return null;
};

const DocLinks = ({ registerId, docs, onRemove }) =>
  (docs || []).length ? (
    <div className="mt-2 flex flex-wrap gap-2">
      {docs.map((d) => (
        <span
          key={d.id}
          className="inline-flex items-center overflow-hidden rounded border border-slate-300 bg-white text-xs"
        >
          <button
            type="button"
            className="max-w-[220px] truncate px-2 py-1 text-primary-700 hover:bg-slate-50"
            title={d.original_name}
            onClick={() => downloadDocument(registerId, d.id, d.original_name)}
          >
            {d.original_name}
          </button>
          {onRemove && (
            <button
              type="button"
              className="border-l border-slate-200 px-2 py-1 font-bold text-jxb-red hover:bg-red-50"
              title={`Hapus ${d.original_name}`}
              aria-label={`Hapus ${d.original_name}`}
              onClick={() => onRemove(d.id)}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  ) : (
    <p className="mt-1 text-xs text-slate-400">Tidak ada dokumen.</p>
  );

export default function FollowUpDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingItem, setUploadingItem] = useState(null);
  const [instructionDraft, setInstructionDraft] = useState({});
  const [realizationDraft, setRealizationDraft] = useState({});
  const [assessmentDraft, setAssessmentDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, hist] = await Promise.all([
        api.get(`/risk-registers/${id}`),
        api.get(`/risk-registers/${id}/history`),
      ]);
      setData(detail.data.data);
      setHistory(hist.data.data);
      const instr = {};
      const real = {};
      const assess = {};
      (detail.data.data.categories || []).forEach((c) =>
        (c.events || []).forEach((e) =>
          parseMitigations(e.mitigation_items).forEach((it) => {
            if (!it?.id) return;
            instr[it.id] = {
              text: it.instruction?.text || it.follow_up || '',
              note: it.instruction?.note || '',
            };
            real[it.id] = it.realization?.note || '';
            assess[it.id] = { status: it.follow_up_status || '', note: it.mr_note || '' };
          })
        )
      );
      setInstructionDraft(instr);
      setRealizationDraft(real);
      setAssessmentDraft(assess);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Data tidak ditemukan" />;

  const isMR = user?.role === 'MR';
  const isOfficer = user?.role === 'RISK_OFFICER';
  const canInstruct = isMR && data.status === STATUS.WAITING_MR_INSTRUCTION;
  const canRealizeStage = isOfficer && data.status === STATUS.WAITING_OFFICER_FOLLOWUP && data.risk_officer_id === user?.id;
  const canAssess = isMR && data.status === STATUS.WAITING_MR_APPROVAL;

  const allItems = (data.categories || []).flatMap((c) =>
    (c.events || []).flatMap((e) =>
      parseMitigations(e.mitigation_items).map((it) => ({ ...it, eventName: e.name }))
    )
  );
  const editableItems = allItems.filter((it) => it.follow_up_status !== FOLLOW_UP_DONE);
  const assessableItems = allItems.filter((it) => it.follow_up_status !== FOLLOW_UP_DONE);
  const canRealizeItem = (it) => canRealizeStage && it.follow_up_status !== FOLLOW_UP_DONE;
  const canAssessItem = (it) => canAssess && it.follow_up_status !== FOLLOW_UP_DONE;
  const instructionOf = (it) => instructionDraft[it.id] || { text: '', note: '' };
  const realizationOf = (it) => realizationDraft[it.id] ?? it.realization?.note ?? '';
  const assessmentOf = (it) => assessmentDraft[it.id] || { status: '', note: '' };
  const instructionsComplete =
    allItems.length > 0 &&
    allItems.every((it) => String(instructionOf(it).text).trim() && String(instructionOf(it).note).trim());
  const realizationsComplete =
    editableItems.length > 0 && editableItems.every((it) => String(realizationOf(it)).trim());
  const assessmentsComplete =
    assessableItems.length > 0 &&
    assessableItems.every((it) => assessmentOf(it).status && String(assessmentOf(it).note).trim());

  const assessmentsPayload = () =>
    assessableItems.map((it) => ({
      itemId: it.id,
      status: assessmentOf(it).status,
      note: String(assessmentOf(it).note).trim(),
    }));

  const updateDocuments = (itemId, updater) => {
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((category) => ({
        ...category,
        events: (category.events || []).map((event) => {
          const items = parseMitigations(event.mitigation_items);
          if (!items.some((it) => String(it.id) === String(itemId))) return event;
          return {
            ...event,
            mitigation_items: items.map((it) =>
              String(it.id) === String(itemId) ? { ...it, documents: updater(it.documents || []) } : it
            ),
          };
        }),
      })),
    }));
  };

  const run = async (fn, successMessage) => {
    setBusy(true);
    try {
      const res = await fn();
      if (successMessage) toast.success(typeof successMessage === 'function' ? successMessage(res) : successMessage);
      await load();
      return res;
    } catch (err) {
      toast.error(parseError(err).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveInstructions = () =>
    run(
      () =>
        api.post(`/risk-registers/${id}/mr-instruction`, {
          items: allItems.map((it) => ({
            itemId: it.id,
            text: String(instructionOf(it).text).trim(),
            note: String(instructionOf(it).note).trim(),
          })),
        }),
      'Instruksi terkirim ke Officer'
    );

  const saveRealization = () =>
    run(
      () =>
        api.post(`/risk-registers/${id}/follow-up-realization`, {
          items: editableItems.map((it) => ({ itemId: it.id, note: String(realizationOf(it)).trim() })),
        }),
      'Realisasi terkirim ke MR'
    );

  const finishAssessments = () =>
    run(
      () => api.post(`/approvals/${id}/approve`, { assessments: assessmentsPayload() }),
      (res) =>
        res.data.data.status === STATUS.APPROVED
          ? 'Penilaian selesai. Risk Register disetujui.'
          : 'Penilaian terkirim. Register dikembalikan ke Officer.'
    );

  const uploadEvidence = async (itemId, files) => {
    if (!files?.length) return;
    const item = allItems.find((it) => String(it.id) === String(itemId));
    const note = item ? String(realizationOf(item)).trim() : '';
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    if (note) form.append('note', note);
    setUploadingItem(itemId);
    try {
      const res = await api.post(`/risk-registers/${id}/mitigation-items/${itemId}/documents`, form);
      const updatedItem = findItemInDetail(res.data.data, itemId);
      updateDocuments(itemId, () => updatedItem?.documents || []);
      toast.success('Bukti dokumen diunggah');
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setUploadingItem(null);
    }
  };

  const removeEvidence = async (itemId, docId) => {
    setUploadingItem(itemId);
    try {
      await api.delete(`/risk-registers/${id}/mitigation-items/${itemId}/documents/${docId}`);
      updateDocuments(itemId, (docs) => docs.filter((doc) => String(doc.id) !== String(docId)));
      toast.success('Bukti dihapus');
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setUploadingItem(null);
    }
  };

  const stage = STAGE_INFO[data.status];
  const currentStep = STEP_BY_STATUS[data.status] ?? 0;
  const actorLabel = data.status === STATUS.APPROVED ? 'Disetujui oleh' : data.status === STATUS.ARCHIVED ? 'Diarsipkan oleh' : 'Diisi oleh';

  return (
    <div className="pb-10">
      <PageHeader
        title={`Tindak Lanjut — ${data.risk_code}`}
        subtitle={data.objective}
        actions={
          <>
            <Link className="btn-secondary" to="/follow-ups">← Kembali</Link>
            <Link className="btn-secondary" to={`/risk-registers/${id}`}>Lihat Register</Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={data.status} />
        <span className="text-xs text-slate-400">Versi {data.current_version}</span>
      </div>

      <WorkflowStepper
        steps={WORKFLOW_STEPS}
        currentIndex={currentStep}
        completed={data.status === STATUS.APPROVED || data.status === STATUS.ARCHIVED}
      />

      {stage && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-blue-800">{stage.title}</p>
            <span className="rounded-full border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {actorLabel}: {stage.actor}
            </span>
          </div>
          <p className="mt-1 text-xs text-blue-700">{stage.desc}</p>
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
        {canInstruct && (
          <button className="btn-primary" onClick={saveInstructions} disabled={busy || !instructionsComplete}>
            {busy ? 'Menyimpan...' : 'Kirim Instruksi ke Officer'}
          </button>
        )}
        {canRealizeStage && (
          <button className="btn-primary" onClick={saveRealization} disabled={busy || !realizationsComplete}>
            {busy ? 'Mengirim...' : 'Kirim Realisasi ke MR'}
          </button>
        )}
        {canAssess && (
          <button className="btn-primary" onClick={finishAssessments} disabled={busy || !assessmentsComplete}>
            Selesaikan Penilaian
          </button>
        )}
        {!canInstruct && !canRealizeStage && !canAssess && (
          <p className="text-sm text-slate-500">
            Status saat ini: <b>{STATUS_LABEL[data.status] || data.status}</b>. Tidak ada aksi yang perlu Anda lakukan di menu ini.
          </p>
        )}
        {(canInstruct && !instructionsComplete) && <p className="text-xs text-amber-700">Lengkapi instruksi & keterangan untuk semua item.</p>}
        {(canRealizeStage && !realizationsComplete) && <p className="text-xs text-amber-700">Lengkapi catatan realisasi untuk semua item.</p>}
        {(canAssess && !assessmentsComplete) && <p className="text-xs text-amber-700">Lengkapi status & tanggapan untuk semua item.</p>}
      </Card>

      <div className="space-y-4">
        {allItems.map((it, idx) => {
          const assessment = assessmentOf(it);
          const isReturned = FOLLOW_UP_RETURN.includes(it.follow_up_status);
          return (
            <Card key={it.id || idx} className="p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">{it.eventName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{idx + 1}. {it.description || '-'}</p>
                </div>
                {it.follow_up_status && (
                  <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-semibold', isReturned ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-green-300 bg-green-50 text-green-700')}>
                    {FOLLOW_UP_STATUS_LABEL[it.follow_up_status] || it.follow_up_status}
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                  <p className="text-xs font-bold uppercase text-violet-700">Instruksi MR</p>
                  {canInstruct ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="input min-h-[90px]"
                        placeholder="Instruksi tindak lanjut"
                        value={instructionOf(it).text}
                        onChange={(e) => setInstructionDraft((d) => ({ ...d, [it.id]: { ...instructionOf(it), text: e.target.value } }))}
                      />
                      <textarea
                        className="input min-h-[70px]"
                        placeholder="Keterangan MR"
                        value={instructionOf(it).note}
                        onChange={(e) => setInstructionDraft((d) => ({ ...d, [it.id]: { ...instructionOf(it), note: e.target.value } }))}
                      />
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-slate-700">{it.instruction?.text || it.follow_up || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">Keterangan MR: {it.instruction?.note || '-'}</p>
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3">
                  <p className="text-xs font-bold uppercase text-cyan-700">Realisasi & Bukti Officer</p>
                  {canRealizeItem(it) ? (
                    <div className="mt-2 space-y-2">
                      {isReturned && (
                        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                          <b>Tanggapan MR:</b> {it.mr_note || '-'}
                        </div>
                      )}
                      <textarea
                        className="input min-h-[90px]"
                        placeholder="Catatan hasil tindak lanjut"
                        value={realizationOf(it)}
                        onChange={(e) => setRealizationDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                      />
                      <input
                        type="file"
                        multiple
                        className="block w-full text-xs text-slate-600"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                        disabled={uploadingItem === it.id}
                        onChange={(e) => {
                          uploadEvidence(it.id, e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <p className="text-[11px] text-slate-500">Maks. 5 file & 5 MB/file. Bukti lama tersimpan di riwayat saat dikembalikan.</p>
                      {(it.documents || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase text-slate-500">Bukti terunggah</p>
                          <DocLinks
                            registerId={id}
                            docs={it.documents}
                            onRemove={(docId) => removeEvidence(it.id, docId)}
                          />
                        </div>
                      )}
                      {uploadingItem === it.id && <p className="text-xs text-primary-700">Mengunggah...</p>}
                    </div>
                  ) : (
                    <>
                      {it.follow_up_status === FOLLOW_UP_DONE && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Sudah dinyatakan sesuai oleh MR dan terkunci.
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-700">{it.realization?.note || '-'}</p>
                      <DocLinks registerId={id} docs={it.documents} />
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                  <p className="text-xs font-bold uppercase text-blue-700">Penilaian MR</p>
                  {canAssessItem(it) ? (
                    <div className="mt-2 space-y-2">
                      <select
                        className="input"
                        value={assessment.status}
                        onChange={(e) => setAssessmentDraft((d) => ({ ...d, [it.id]: { ...assessment, status: e.target.value } }))}
                      >
                        <option value="">Pilih status</option>
                        {FOLLOW_UP_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <textarea
                        className="input min-h-[90px]"
                        placeholder="Tanggapan MR"
                        value={assessment.note}
                        onChange={(e) => setAssessmentDraft((d) => ({ ...d, [it.id]: { ...assessment, note: e.target.value } }))}
                      />
                    </div>
                  ) : (
                    <>
                      {it.follow_up_status === FOLLOW_UP_DONE && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Penilaian MR sudah final dan terkunci.
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-700">{FOLLOW_UP_STATUS_LABEL[it.follow_up_status] || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">Tanggapan MR: {it.mr_note || '-'}</p>
                    </>
                  )}
                </div>
              </div>

              {(it.follow_up_history || []).length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-500">Riwayat Tindak Lanjut</h4>
                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  </div>
                  <div className="relative space-y-6 pl-8">
                    <span className="absolute bottom-3 left-[11px] top-3 w-px bg-slate-200" aria-hidden="true" />
                    {[...it.follow_up_history].reverse().map((h, hi, arr) => {
                      const style = TIMELINE_STYLE[h.action] || TIMELINE_FALLBACK;
                      const actor =
                        h.archived_by && String(h.archived_by) === String(user?.id)
                          ? user?.name || 'Anda'
                          : ACTOR_LABEL[h.actor_role] || h.actor_role || 'Sistem';
                      return (
                        <div key={hi} className="relative">
                          <span className={clsx('absolute -left-8 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-sm', style.iconWrap)}>
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d={style.icon} />
                            </svg>
                          </span>
                          {hi < arr.length - 1 && (
                            <span className="absolute -bottom-6 -left-8 z-10 flex h-5 w-6 items-center justify-center text-[11px] text-slate-400" aria-hidden="true">↓</span>
                          )}
                          <div className={clsx('rounded-lg border border-slate-200 border-l-4 bg-white p-3 shadow-sm', style.border)}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <b className="text-slate-700">{ACTION_LABEL[h.action] || h.action}</b>
                              <span className="text-slate-400">{formatTimelineDate(h.archived_at)}</span>
                              <span className="text-slate-400">oleh</span>
                              <span className="font-medium text-slate-600">{actor}</span>
                            </div>
                            <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
                              {h.reason && h.action !== 'OFFICER_REALIZATION' && (
                                <p>
                                  <span className="font-semibold text-slate-500">{NOTE_LABEL[h.action] || 'Catatan'}:</span> {h.reason}
                                </p>
                              )}
                              {h.realization?.note && (
                                <p>
                                  <span className="font-semibold text-slate-500">Realisasi Officer:</span> {h.realization.note}
                                </p>
                              )}
                              {h.follow_up_status && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-500">Status:</span>
                                  <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[h.follow_up_status] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200')}>
                                    {FOLLOW_UP_STATUS_LABEL[h.follow_up_status] || h.follow_up_status}
                                  </span>
                                </div>
                              )}
                              {(h.documents || []).length > 0 && (
                                <div>
                                  <p className="font-semibold text-slate-500">Upload bukti ({h.documents.length} file)</p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {h.documents.map((d) => (
                                      <button
                                        key={d.id}
                                        type="button"
                                        className="inline-flex max-w-full items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-primary-700 hover:bg-slate-100"
                                        title={d.original_name}
                                        onClick={() => downloadDocument(id, d.id, d.original_name)}
                                      >
                                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                          <path d="M14 2v6h6" />
                                        </svg>
                                        <span className="truncate">{d.original_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {!allItems.length && <EmptyState title="Belum ada item mitigasi" />}
      </div>

      {history?.approvals?.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Riwayat Approval</p>
          <div className="space-y-1">
            {[...history.approvals].reverse().map((a, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1 text-xs text-slate-600">
                <span><b>{ACTION_LABEL[a.action] || a.action}</b> · {STATUS_LABEL[a.to_status] || a.to_status}</span>
                <span className="text-slate-400">{a.created_at ? new Date(a.created_at).toLocaleString('id-ID') : '-'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
