import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import api, { parseError, downloadDocument } from '../../api/client';
import { Card, PageHeader, Spinner, Field, CollapsibleSection } from '../../components/ui/Common';
import { LevelBadge } from '../../components/ui/Badges';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { SECTIONS } from '../../constants';

const uid = () => Math.random().toString(36).slice(2, 9);

const blankCause = () => ({
  key: uid(),
  name: '',
  source_id: '',
  severity_description: '',
  rp_amount: '',
  work_unit: '',
});

const blankMitigationItem = () => ({ key: uid(), description: '', follow_up: '' });

const blankEvent = () => ({
  key: uid(),
  name: '',
  causes: [blankCause()],
  inherent: { likelihood: '', impact: '' },
  control: { present: '', adequacy: '', implementation: '' },
  residual: { likelihood: '', impact: '' },
  mitigation_items: [blankMitigationItem()],
  after: { likelihood: '', impact: '' },
});
const blankCategory = () => ({ key: uid(), category_id: '', events: [blankEvent()] });
const blankForm = () => ({ objective: '', risk_owner_id: '', categories: [blankCategory()] });

const score = (l, i) => (Number(l) > 0 && Number(i) > 0 ? Number(l) * Number(i) : null);

export default function RiskRegisterFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState(null);
  const [errors, setErrors] = useState([]);
  const [active, setActive] = useState('objective');
  const [openMap, setOpenMap] = useState({ objective: true });
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [initialVersion, setInitialVersion] = useState(null);

  const [owners, setOwners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [sources, setSources] = useState([]);
  const [severities, setSeverities] = useState([]);
  const [likelihoods, setLikelihoods] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [levels, setLevels] = useState([]);

  useEffect(() => {
    const activeOnly = (rows) => rows.filter((r) => !r.status || r.status === 'ACTIVE');
    Promise.all([
      api.get('/risk-registers/owners/me'),
      api.get('/masters/categories'),
      api.get('/masters/treatments'),
      api.get('/masters/sources'),
      api.get('/masters/severities'),
      api.get('/masters/likelihoods'),
      api.get('/masters/impacts'),
      api.get('/masters/levels'),
    ])
      .then(([o, c, t, s, se, l, i, lv]) => {
        setOwners(o.data.data || []);
        setCategories(activeOnly(c.data.data || []));
        setTreatments(activeOnly(t.data.data || []));
        setSources(activeOnly(s.data.data || []));
        setSeverities(activeOnly(se.data.data || []));
        setLikelihoods(l.data.data || []);
        setImpacts(i.data.data || []);
        setLevels(lv.data.data || []);
      })
      .catch((err) => toast.error(parseError(err).message));
  }, [toast]);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/risk-registers/${id}`)
      .then((res) => {
        const d = res.data.data;
        if (!['DRAFT', 'REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(d.status)) {
          toast.warning('Risk Register tidak dalam status yang dapat diedit');
          navigate(`/risk-registers/${id}`, { replace: true });
          return;
        }
        setHeader(d);
        setInitialVersion(d.current_version);
        setForm({
          objective: d.objective,
          risk_owner_id: d.risk_owner_id,
          categories: (d.categories || []).map((cat) => ({
            key: uid(),
            category_id: cat.category_id,
            events: (cat.events || []).map((ev) => ({
              key: uid(),
              name: ev.name,
              causes: (ev.causes || []).map((cs) => ({
                key: uid(),
                name: cs.name,
                source_id: cs.source_id || '',
                severity_description: cs.severity_description || '',
                rp_amount: cs.rp_amount ?? '',
                work_unit: cs.work_unit || '',
              })),
              inherent: {
                likelihood: ev.inherent_likelihood ?? '',
                impact: ev.inherent_impact ?? '',
              },
              control: {
                present: ev.control_present || '',
                adequacy: ev.control_adequacy || '',
                implementation: ev.control_implementation_pct ?? '',
              },
              residual: {
                likelihood: ev.residual_likelihood ?? '',
                impact: ev.residual_impact ?? '',
              },
              mitigation_items: (() => {
                let items = ev.mitigation_items;
                if (typeof items === 'string') {
                  try { items = JSON.parse(items); } catch { items = []; }
                }
                if (!Array.isArray(items) || !items.length) items = [{ description: '' }];
                return items.map((it) => ({
                  key: uid(),
                  id: typeof it === 'string' ? undefined : it?.id,
                  description: typeof it === 'string' ? it : (it && it.description) || '',
                  follow_up: typeof it === 'string' ? '' : (it && it.follow_up) || '',
                  documents: typeof it === 'string' ? [] : it?.documents || [],
                  follow_up_status: typeof it === 'string' ? null : it?.follow_up_status || null,
                  follow_up_history: typeof it === 'string' ? [] : it?.follow_up_history || [],
                }));
              })(),
              after: {
                likelihood: ev.after_likelihood ?? '',
                impact: ev.after_impact ?? '',
              },
            })),
          })),
        });
      })
      .catch((err) => {
        toast.error(parseError(err).message);
        navigate('/risk-registers');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate, toast]);

  const mutate = (fn) =>
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });

  const levelOf = (s) => {
    if (s === null || s === undefined) return null;
    return levels.find((l) => s >= l.min_score && s <= l.max_score) || null;
  };

  const errFor = (path) => errors.find((e) => e.field === path)?.message;
  const sectionErrors = (prefix) => {
    if (prefix === 'categories' || prefix === 'identification') {
      return errors.filter((e) => e.field.startsWith('categories'));
    }
    if (prefix === 'cause') return errors.filter((e) => e.field.includes('.causes['));
    if (prefix === 'treatment') return errors.filter((e) => e.field.includes('.mitigation_items'));
    if (prefix === 'objective') return errors.filter((e) => e.field === 'objective');
    if (prefix === 'risk_owner') return errors.filter((e) => e.field === 'risk_owner_id');
    return errors.filter((e) => e.field.includes('.' + prefix));
  };

  const scrollTo = (key) => {
    setActive(key);
    setOpenMap((m) => ({ ...m, [key]: true }));
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---------- local validation ----------
  const validate = () => {
    const errs = [];
    const push = (field, message) => errs.push({ field, message });

    if (!form.objective.trim()) push('objective', 'Objective wajib diisi');
    if (!form.risk_owner_id) push('risk_owner_id', 'Risk Owner wajib dipilih');
    if (!form.categories.length) push('categories', 'Minimal 1 Risk Category wajib diisi');

    form.categories.forEach((cat, ci) => {
      if (!cat.category_id) push(`categories[${ci}].category_id`, 'Risk Category wajib dipilih');
      if (!cat.events.length) push(`categories[${ci}].events`, 'Minimal 1 Risk Event wajib diisi');
      cat.events.forEach((ev, ei) => {
        const ep = `categories[${ci}].events[${ei}]`;
        if (!ev.name.trim()) push(`${ep}.name`, 'Risk Event wajib diisi');
        if (!ev.causes.length) push(`${ep}.causes`, 'Minimal 1 Risk Cause wajib diisi');
        ev.causes.forEach((cs, si) => {
          const p = `${ep}.causes[${si}]`;
          if (!cs.name.trim()) push(`${p}.name`, 'Risk Cause wajib diisi');
          if (!String(cs.severity_description || '').trim()) push(`${p}.severity_description`, 'Deskripsi wajib diisi');
          if (cs.rp_amount === '' || cs.rp_amount === null || cs.rp_amount === undefined || Number.isNaN(Number(cs.rp_amount))) {
            push(`${p}.rp_amount`, 'Nilai Rp wajib diisi');
          } else if (Number(cs.rp_amount) < 0) {
            push(`${p}.rp_amount`, 'Nilai Rp tidak boleh negatif');
          }
          if (!String(cs.work_unit || '').trim()) push(`${p}.work_unit`, 'Unit Kerja / Unit Usaha wajib diisi');
        });
        if (!score(ev.inherent.likelihood, ev.inherent.impact)) push(`${ep}.inherent.likelihood`, 'Inherent Risk wajib diisi (1-5)');
        if (!ev.control.present) push(`${ep}.control.present`, 'Existing Control wajib dipilih');
        if (!ev.control.adequacy) push(`${ep}.control.adequacy`, 'Control Adequacy wajib dipilih');
        if (ev.control.implementation === '' || Number(ev.control.implementation) < 0 || Number(ev.control.implementation) > 100) {
          push(`${ep}.control.implementation`, 'Persentase 0-100');
        }
        if (!score(ev.residual.likelihood, ev.residual.impact)) push(`${ep}.residual.likelihood`, 'Residual Risk wajib diisi (1-5)');
        if (!ev.mitigation_items.length) push(`${ep}.mitigation_items`, 'Minimal 1 item mitigasi wajib diisi');
        ev.mitigation_items.forEach((mi, mii) => {
          if (!String(mi.description || '').trim()) push(`${ep}.mitigation_items[${mii}].description`, 'Tindakan mitigasi tidak boleh kosong');
          if (!String(mi.follow_up || '').trim()) push(`${ep}.mitigation_items[${mii}].follow_up`, 'Tindak lanjut wajib diisi');
        });
        if (!score(ev.after.likelihood, ev.after.impact)) push(`${ep}.after.likelihood`, 'Risk After Mitigation wajib diisi (1-5)');
      });
    });
    return errs;
  };

  const payload = () => ({
    objective: form.objective,
    risk_owner_id: Number(form.risk_owner_id),
    categories: form.categories.map((cat) => ({
      category_id: Number(cat.category_id),
      events: cat.events.map((ev) => ({
        name: ev.name,
        causes: ev.causes.map((cs) => ({
          name: cs.name,
          source_id: cs.source_id ? Number(cs.source_id) : null,
          severity_description: cs.severity_description || null,
          rp_amount: cs.rp_amount === '' ? null : Number(cs.rp_amount),
          work_unit: cs.work_unit || null,
        })),
        inherent: { likelihood: Number(ev.inherent.likelihood), impact: Number(ev.inherent.impact) },
        control: {
          present: ev.control.present,
          adequacy: ev.control.adequacy,
          implementation: Number(ev.control.implementation),
        },
        residual: { likelihood: Number(ev.residual.likelihood), impact: Number(ev.residual.impact) },
        mitigation_items: ev.mitigation_items.map((mi, idx) => ({
          id: mi.id,
          description: mi.description,
          follow_up: mi.follow_up,
          order: idx + 1,
          documents: mi.documents || [],
          follow_up_status: mi.follow_up_status || null,
          follow_up_history: mi.follow_up_history || [],
        })),
        after: { likelihood: Number(ev.after.likelihood), impact: Number(ev.after.impact) },
      })),
    })),
  });

  const save = async (thenSubmit = false) => {
    const localErrors = validate();
    setErrors(localErrors);
    if (localErrors.length) {
      const first = localErrors[0].field;
      let sec = 'objective';
      if (first.includes('inherent')) sec = 'inherent';
      else if (first.includes('residual')) sec = 'residual';
      else if (first.includes('after')) sec = 'after';
      else if (first.includes('control.')) sec = 'control';
      else if (first.includes('mitigation')) sec = 'treatment';
      else if (first.includes('.causes[')) sec = 'cause';
      else if (first.includes('events[') || first.includes('categories')) sec = 'identification';
      scrollTo(sec);
      toast.error(`Masih ada ${localErrors.length} field yang belum lengkap`);
      return null;
    }

    setSaving(true);
    try {
      const body = payload();
      let savedId = id;
      if (isEdit) {
        const res = await api.put(`/risk-registers/${id}`, body);
        savedId = res.data.data.id;
        if (thenSubmit) await api.post(`/risk-registers/${savedId}/submit`);
      } else {
        const res = await api.post('/risk-registers', body);
        savedId = res.data.data.id;
        if (thenSubmit) await api.post(`/risk-registers/${savedId}/submit`);
      }
      toast.success(thenSubmit ? 'Risk Register disubmit ke Risk Owner' : 'Draft tersimpan');
      navigate(`/risk-registers/${savedId}`);
      return savedId;
    } catch (err) {
      const p = parseError(err);
      if (p.details?.length) {
        setErrors(p.details);
        toast.error('Lengkapi field yang ditandai merah');
      } else {
        toast.error(p.message);
      }
      return null;
    } finally {
      setSaving(false);
    }
  };

  const onDoSubmit = async () => {
    setConfirmSubmit(false);
    await save(true);
  };

  const lOptions = likelihoods.length ? likelihoods : [{ score: 1, name: 'Jarang' }, { score: 2, name: 'Kecil' }, { score: 3, name: 'Sedang' }, { score: 4, name: 'Besar' }, { score: 5, name: 'Hampir Pasti' }];
  const iOptions = impacts.length ? impacts : [{ score: 1, name: 'Tidak Signifikan' }, { score: 2, name: 'Rendah' }, { score: 3, name: 'Menengah' }, { score: 4, name: 'Besar' }, { score: 5, name: 'Dahsyat' }];

  if (loading) return <Spinner />;

  const causeCount = form.categories.reduce((a, c) => a + c.events.reduce((b, e) => b + e.causes.length, 0), 0);
  const rejectedNote = header && ['REJECTED_BY_OWNER', 'REJECTED_BY_MR'].includes(header.status);

  return (
    <div className="pb-10">
      <PageHeader
        title={isEdit ? `Edit Risk Register${header ? ` — ${header.risk_code}` : ''}` : 'Buat Risk Register'}
        subtitle="Satu form lengkap: Objective → Risk Category → Risk Event → Risk Cause → Assessment → Treatment"
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/risk-registers')} disabled={saving}>
              Batal
            </button>
            <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
            <button className="btn-primary" onClick={() => setConfirmSubmit(true)} disabled={saving}>
              Simpan & Submit
            </button>
          </>
        }
      />

      {rejectedNote && header && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">
            Rejected By: {header.status === 'REJECTED_BY_OWNER' ? 'Risk Owner' : 'MR'}
          </p>
          <p className="mt-1">
            Perbaiki bagian Risk Treatment lalu Submit ulang. Versi mitigasi lama tetap tersimpan sebagai history.
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Field wajib diisi belum lengkap ({errors.length}):</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stepper */}
      <div className="card mb-5 overflow-x-auto p-3">
        <div className="flex min-w-max gap-1.5">
          {SECTIONS.map((s) => {
            const prefix = s.key === 'identification' ? 'categories' : s.key;
            const secErrs = s.key === 'review' ? [] : sectionErrors(prefix);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollTo(s.key)}
                className={clsx(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition',
                  active === s.key ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                <span className={clsx('rounded px-1', active === s.key ? 'bg-white/20' : 'bg-white')}>{s.no}</span>
                {s.title}
                {secErrs.length > 0 && <span className="h-2 w-2 rounded-full bg-jxb-red" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 01 Objective & Owner */}
      <div id="section-objective">
        <CollapsibleSection
          no="01"
          title="Objective & Owner"
          invalid={sectionErrors('objective').length > 0 || sectionErrors('risk_owner').length > 0}
          open={openMap.objective}
          onToggle={() => setOpenMap((m) => ({ ...m, objective: !m.objective }))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Objective / Tujuan" required error={errFor('objective')}>
              <textarea
                className="input min-h-[90px]"
                placeholder="Contoh: Meningkatkan kepuasan pelanggan"
                value={form.objective}
                onChange={(e) => mutate((f) => { f.objective = e.target.value; })}
              />
            </Field>
            <div className="space-y-3">
              <Field label="Branch / Unit Kerja (Risk Officer)" hint="Mengikuti User Management Anda">
                <input className="input" disabled value={user?.branch_name || '-'} />
              </Field>
              <Field label="Risk Owner" required error={errFor('risk_owner_id')}>
                <select
                  className="input"
                  value={form.risk_owner_id}
                  onChange={(e) => mutate((f) => { f.risk_owner_id = e.target.value; })}
                >
                  <option value="">— Pilih Risk Owner (branch yang sama) —</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.username})</option>
                  ))}
                </select>
                {!owners.length && (
                  <p className="mt-1 text-xs text-jxb-red">
                    Tidak ada Risk Owner aktif pada branch Anda — hubungi MR di User Management.
                  </p>
                )}
              </Field>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* 02 Risk Identification */}
      <div id="section-identification">
        <CollapsibleSection
          no="02"
          title="Risk Identification (Category & Event)"
          invalid={sectionErrors('categories').length > 0}
          open={openMap.identification}
          onToggle={() => setOpenMap((m) => ({ ...m, identification: !m.identification }))}
        >
          {form.categories.map((cat, ci) => (
            <div key={cat.key} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="flex-1">
                  <Field label={`Risk Category ${ci + 1}`} required error={errFor(`categories[${ci}].category_id`)}>
                    <select
                      className="input"
                      value={cat.category_id}
                      onChange={(e) => mutate((f) => { f.categories[ci].category_id = e.target.value; })}
                    >
                      <option value="">— Pilih kategori —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  className="btn-danger btn-sm mb-0.5"
                  onClick={() => mutate((f) => { f.categories.splice(ci, 1); })}
                >
                  Hapus Kategori
                </button>
              </div>

              {cat.events.map((ev, ei) => (
                <div key={ev.key} className="mb-2 rounded border border-slate-200 bg-white p-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <Field
                        label={`Risk Event ${ci + 1}.${ei + 1}`}
                        required
                        error={errFor(`categories[${ci}].events[${ei}].name`)}
                      >
                        <input
                          className="input"
                          placeholder="Contoh: Kenaikan harga bahan baku, gangguan sistem..."
                          value={ev.name}
                          onChange={(e) => mutate((f) => { f.categories[ci].events[ei].name = e.target.value; })}
                        />
                      </Field>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => mutate((f) => { f.categories[ci].events.splice(ei, 1); })}
                      >
                        Hapus Event
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => mutate((f) => { f.categories[ci].events.push(blankEvent()); })}
              >
                + Tambah Risk Event
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => mutate((f) => { f.categories.push(blankCategory()); })}
          >
            + Tambah Risk Category
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Struktur: Objective → banyak Risk Category → banyak Risk Event → banyak Risk Cause.
          </p>
        </CollapsibleSection>
      </div>

      {/* Event-level sections */}
      {[
        { no: '03', key: 'cause', title: 'Risk Cause & Sumber Risiko' },
        { no: '04', key: 'inherent', title: 'Inherent Risk' },
        { no: '05', key: 'control', title: 'Existing Control / Pengendalian yang Ada' },
        { no: '06', key: 'residual', title: 'Residual Risk' },
        { no: '07', key: 'treatment', title: 'Risk Treatment' },
        { no: '08', key: 'after', title: 'Risk After Mitigation' },
      ].map((sec) => (
        <div id={`section-${sec.key}`} key={sec.key}>
          <CollapsibleSection
            no={sec.no}
            title={sec.title}
            invalid={sectionErrors(sec.key).length > 0}
            open={openMap[sec.key]}
            onToggle={() => setOpenMap((m) => ({ ...m, [sec.key]: !m[sec.key] }))}
          >
            {form.categories.length === 0 && <p className="text-sm text-slate-400">Tambahkan kategori pada section 02.</p>}
            {form.categories.map((cat, ci) =>
              cat.events.map((ev, ei) => (
                <div key={`${cat.key}-${ev.key}`} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {cat.category_id ? categories.find((c) => String(c.id) === String(cat.category_id))?.name : 'Kategori'} / {ev.name || 'Event tanpa nama'}
                  </p>
                  {sec.key === 'cause' ? (
                    <>
                      {ev.causes.map((cs, si) => (
                        <CauseFields
                          key={cs.key}
                          ci={ci}
                          ei={ei}
                          si={si}
                          cs={cs}
                          mutate={mutate}
                          errFor={errFor}
                          sources={sources}
                          showRemove={ev.causes.length > 1}
                        />
                      ))}
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => mutate((f) => { f.categories[ci].events[ei].causes.push(blankCause()); })}
                      >
                        + Tambah Risk Cause
                      </button>
                    </>
                  ) : (
                    <EventAssessmentFields
                      sec={sec.key}
                      ci={ci}
                      ei={ei}
                      ev={ev}
                      mutate={mutate}
                      errFor={errFor}
                      lOptions={lOptions}
                      iOptions={iOptions}
                      levelOf={levelOf}
                      registerId={id}
                      toast={toast}
                    />
                  )}
                </div>
              ))
            )}
          </CollapsibleSection>
        </div>
      ))}

      {/* 09 Review & Submit */}
      <div id="section-review">
        <CollapsibleSection
          no="09"
          title="Review & Submit"
          open={openMap.review}
          onToggle={() => setOpenMap((m) => ({ ...m, review: !m.review }))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Objective:</span> {form.objective || '-'}</p>
              <p>
                <span className="font-semibold">Risk Owner:{' '}</span>
                {owners.find((o) => String(o.id) === String(form.risk_owner_id))?.name || '-'}
              </p>
              <p><span className="font-semibold">Branch:</span> {user?.branch_name || '-'}</p>
              <p><span className="font-semibold">Jumlah:</span> {form.categories.length} kategori · {causeCount} risk cause</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-700">Alur approval:</p>
              <p className="mt-1 text-slate-600">Risk Officer → Submit → Risk Owner → MR → APPROVED</p>
              <p className="mt-2 text-xs text-slate-500">
                Submit memerlukan seluruh field wajib terisi. Anda tetap dapat menyimpan dulu sebagai Draft.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>
              Simpan Draft
            </button>
            <button className="btn-primary" onClick={() => setConfirmSubmit(true)} disabled={saving}>
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan & Submit Ulang' : 'Simpan & Submit'}
            </button>
          </div>
        </CollapsibleSection>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={onDoSubmit}
        loading={saving}
        title="Submit Risk Register"
        message="Submit Risk Register ke Risk Owner untuk approval?"
        confirmLabel="Ya, Submit"
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   Risk Cause (identifikasi) - level cause
--------------------------------------------------------------- */
function CauseFields({ ci, ei, si, cs, mutate, errFor, sources, showRemove }) {
  const p = `categories[${ci}].events[${ei}].causes[${si}]`;
  const set = (fn) => mutate((f) => fn(f.categories[ci].events[ei].causes[si]));

  return (
    <div className="mb-3 rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">RISK CAUSE {si + 1}</p>
        {showRemove && (
          <button
            type="button"
            className="text-xs font-semibold text-jxb-red hover:underline"
            onClick={() => mutate((f) => { const arr = f.categories[ci].events[ei].causes; arr.splice(si, 1); if (!arr.length) arr.push(blankCause()); })}
          >
            Hapus cause
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Risk Cause" required error={errFor(`${p}.name`)}>
          <input
            className="input"
            placeholder="Penyebab risiko"
            value={cs.name}
            onChange={(e) => set((c) => { c.name = e.target.value; })}
          />
        </Field>
        <Field label="Sumber Risiko">
          <select
            className="input"
            value={cs.source_id}
            onChange={(e) => set((c) => { c.source_id = e.target.value; })}
          >
            <option value="">- pilih -</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Severity — Deskripsi Akibat / Potensi Kerugian" required error={errFor(`${p}.severity_description`)}>
          <input
            className="input"
            value={cs.severity_description}
            onChange={(e) => set((c) => { c.severity_description = e.target.value; })}
            placeholder="Contoh: Penurunan Profitabilitas"
          />
        </Field>
        <Field label="Rp" error={errFor(`${p}.rp_amount`)}>
          <input
            className="input"
            type="number"
            min="0"
            value={cs.rp_amount}
            onChange={(e) => set((c) => { c.rp_amount = e.target.value; })}
            placeholder="50000000"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Unit Kerja / Unit Usaha" required error={errFor(`${p}.work_unit`)}>
            <input
              className="input"
              value={cs.work_unit}
              onChange={(e) => set((c) => { c.work_unit = e.target.value; })}
              placeholder="Contoh: Front Office / Food & Beverage"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Assessment per event (Inherent / Control / Residual / Treatment / After)
--------------------------------------------------------------- */
function EventAssessmentFields({ sec, ci, ei, ev, mutate, errFor, lOptions, iOptions, levelOf, registerId, toast }) {
  const ep = `categories[${ci}].events[${ei}]`;
  const set = (fn) => mutate((f) => fn(f.categories[ci].events[ei]));
  const [uploadingItem, setUploadingItem] = useState(null);

  const parseMits = (raw) => {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  };

  const syncDocuments = (res, mii) => {
    const items = (res.data.data?.categories || [])
      .flatMap((c) => c.events || [])
      .flatMap((e) => parseMits(e.mitigation_items));
    const mi = ev.mitigation_items[mii];
    const fresh = items.find((x) => x.id === mi?.id);
    mutate((f) => {
      f.categories[ci].events[ei].mitigation_items[mii].documents = fresh?.documents || [];
    });
  };

  const uploadDocument = async (mii, fileList) => {
    if (!fileList || !fileList.length) return;
    const mi = ev.mitigation_items[mii];
    if (!registerId || !mi?.id) {
      toast?.error('Simpan draft terlebih dahulu sebelum mengunggah bukti dokumen');
      return;
    }
    const body = new FormData();
    Array.from(fileList).forEach((f) => body.append('files', f));
    setUploadingItem(mi.id);
    try {
      const res = await api.post(`/risk-registers/${registerId}/mitigation-items/${mi.id}/documents`, body);
      syncDocuments(res, mii);
      toast?.success('Bukti dokumen berhasil diunggah');
    } catch (err) {
      toast?.error(parseError(err).message);
    } finally {
      setUploadingItem(null);
    }
  };

  const removeDocument = async (mii, docId) => {
    const mi = ev.mitigation_items[mii];
    if (!registerId || !mi?.id) return;
    try {
      const res = await api.delete(`/risk-registers/${registerId}/mitigation-items/${mi.id}/documents/${docId}`);
      syncDocuments(res, mii);
      toast?.success('Dokumen dihapus');
    } catch (err) {
      toast?.error(parseError(err).message);
    }
  };

  if (sec === 'control') {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Pengendalian yang Ada" required error={errFor(`${ep}.control.present`)}>
          <select className="input" value={ev.control.present} onChange={(e) => set((x) => { x.control.present = e.target.value; })}>
            <option value="">- pilih -</option>
            <option value="ADA">Ada</option>
            <option value="TIDAK_ADA">Tidak Ada</option>
          </select>
        </Field>
        <Field label="Memadai?" required error={errFor(`${ep}.control.adequacy`)}>
          <select className="input" value={ev.control.adequacy} onChange={(e) => set((x) => { x.control.adequacy = e.target.value; })}>
            <option value="">- pilih -</option>
            <option value="MEMADAI">Memadai</option>
            <option value="BELUM_MEMADAI">Belum Memadai</option>
          </select>
        </Field>
        <Field label="Dijalankan (%)" required error={errFor(`${ep}.control.implementation`)} hint="0-100">
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            value={ev.control.implementation}
            onChange={(e) => set((x) => { x.control.implementation = e.target.value; })}
            placeholder="80"
          />
        </Field>
      </div>
    );
  }

  if (sec === 'treatment') {
    const itemsErr = errFor(`${ep}.mitigation_items`);
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Daftar Tindakan Mitigasi</p>
        {ev.mitigation_items.map((mi, mii) => (
          <div key={mi.key} className="rounded border border-slate-200 bg-white p-2">
            <div className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-xs font-semibold text-slate-500">{mii + 1}.</span>
              <textarea
                className="input min-h-[44px] flex-1"
                placeholder={`Tindakan mitigasi ${mii + 1}`}
                value={mi.description}
                onChange={(e) => set((x) => { x.mitigation_items[mii].description = e.target.value; })}
              />
              <button
                type="button"
                className="btn-danger btn-sm mt-1"
                disabled={ev.mitigation_items.length <= 1}
                onClick={() => set((x) => { x.mitigation_items.splice(mii, 1); if (!x.mitigation_items.length) x.mitigation_items.push(blankMitigationItem()); })}
              >
                -
              </button>
            </div>
            <div className="mt-2 pl-8">
              <label className="label">Tindak Lanjut</label>
              <textarea
                className="input min-h-[40px]"
                placeholder={`Tindak lanjut mitigasi ${mii + 1}`}
                value={mi.follow_up}
                onChange={(e) => set((x) => { x.mitigation_items[mii].follow_up = e.target.value; })}
              />
              {errFor(`${ep}.mitigation_items[${mii}].description`) && (
                <p className="mt-1 text-xs font-semibold text-jxb-red">{errFor(`${ep}.mitigation_items[${mii}].description`)}</p>
              )}
              {errFor(`${ep}.mitigation_items[${mii}].follow_up`) && (
                <p className="mt-1 text-xs font-semibold text-jxb-red">{errFor(`${ep}.mitigation_items[${mii}].follow_up`)}</p>
              )}
              <label className="label mt-2">Bukti Dokumen (opsional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                className="input"
                disabled={!registerId || uploadingItem === mi.id}
                onChange={(e) => {
                  uploadDocument(mii, e.target.files);
                  e.target.value = '';
                }}
              />
              {!registerId && (
                <p className="mt-1 text-xs text-slate-400">Simpan draft terlebih dahulu untuk mengunggah bukti.</p>
              )}
              {(mi.documents || []).map((d) => (
                <div key={d.id} className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    className="truncate text-primary-700 hover:underline"
                    onClick={() => downloadDocument(registerId, d.id, d.original_name)}
                  >
                    {d.original_name}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 font-semibold text-jxb-red hover:underline"
                    onClick={() => removeDocument(mii, d.id)}
                  >
                    Hapus
                  </button>
                </div>
              ))}
              {uploadingItem === mi.id && <p className="mt-1 text-xs text-slate-500">Mengunggah...</p>}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => set((x) => { x.mitigation_items.push(blankMitigationItem()); })}
        >
          + Tambah Item Mitigasi
        </button>
        {itemsErr && <p className="text-xs text-jxb-red">{itemsErr}</p>}
      </div>
    );
  }

  const group = sec;
  const s = score(ev[group].likelihood, ev[group].impact);
  const lv = s === null ? null : levelOf(s);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Field label="Likelihood (1-5)" required error={errFor(`${ep}.${group}.likelihood`)}>
        <select className="input" value={ev[group].likelihood} onChange={(e) => set((x) => { x[group].likelihood = e.target.value; })}>
          <option value="">- pilih -</option>
          {lOptions.map((o) => (
            <option key={o.score} value={o.score}>{o.score} - {o.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Impact (1-5)" required error={errFor(`${ep}.${group}.impact`)}>
        <select className="input" value={ev[group].impact} onChange={(e) => set((x) => { x[group].impact = e.target.value; })}>
          <option value="">- pilih -</option>
          {iOptions.map((o) => (
            <option key={o.score} value={o.score}>{o.score} - {o.name}</option>
          ))}
        </select>
      </Field>
      <div>
        <span className="label">Level of Risk (otomatis)</span>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          {s === null ? (
            <span className="text-sm text-slate-400">-</span>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <LevelBadge level={lv?.level || '-'} score={s} />
              <span className="text-xs text-slate-400">{ev[group].likelihood} x {ev[group].impact}</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Score = Likelihood x Impact</p>
      </div>
    </div>
  );
}
