/* Seed Risk Register sesuai struktur event-level (migration 005).
 * Hanya membuat data risk register; branch/user/master tidak diubah.
 * Jalankan: node scripts/seed-risk-registers.js
 */
const crypto = require('crypto');
const m = require('mysql2/promise');

const YEAR = 2026;
const BRANCH = 23;
const OFFICER = 2;
const OWNER = 3;
const MR = 1;

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
const clamp = (v) => Math.max(1, Math.min(5, v));

const CATEGORIES = [
  { id: 2, code: 'RK-OPS', events: ['Gangguan operasional hotel', 'Kelangkaan bahan baku F&B', 'Kerusakan fasilitas kamar', 'Keterlambatan housekeeping'] },
  { id: 3, code: 'RK-KEU', events: ['Piutang tak tertagih', 'Fluktuasi kurs', 'Kebocoran kas operasional', 'Kenaikan biaya energi'] },
  { id: 11, code: 'RK-HSSE', events: ['Kecelakaan kerja di area dapur', 'Kebakaran gedung', 'Keracunan makanan tamu', 'Kehilangan barang tamu'] },
  { id: 6, code: 'RK-TI', events: ['Gangguan sistem reservasi', 'Kebocoran data pelanggan', 'Serangan ransomware', 'Downtime jaringan'] },
  { id: 7, code: 'RK-SDM', events: ['Turnover karyawan tinggi', 'Kekurangan tenaga terampil', 'Konflik internal tim'] },
  { id: 5, code: 'RK-REP', events: ['Ulasan negatif di media sosial', 'Pemberitaan insiden keamanan'] },
  { id: 1, code: 'RK-STG', events: ['Persaingan harga kompetitor', 'Perubahan regulasi pariwisata'] },
];

const CAUSES = ['Prosedur belum standar', 'Kurangnya pelatihan karyawan', 'Pemeliharaan tidak terjadwal', 'Ketergantungan pada pemasok tunggal', 'Sistem belum terintegrasi', 'Pengawasan lemah', 'Beban kerja berlebih', 'Alat kerja tidak memadai'];
const SOURCES = [1, 2];
const CONSEQUENCES = ['Penurunan pendapatan', 'Kerugian finansial', 'Penurunan reputasi', 'Denda regulasi', 'Gangguan layanan tamu', 'Kehilangan data'];
const RPS = [25000000, 50000000, 100000000, 150000000, 250000000, 500000000, 750000000, 1000000000];
const MITIGATIONS = ['Melakukan analisis dan pemantauan biaya secara rutin', 'Menyusun SOP dan melakukan sosialisasi', 'Melakukan negosiasi dengan pemasok alternatif', 'Menjadwalkan pemeliharaan preventif', 'Meningkatkan pelatihan dan sertifikasi karyawan', 'Menambah redundansi sistem dan backup', 'Melakukan audit internal berkala', 'Memasang monitoring dan evaluasi berkala'];
const WORK_UNITS = ['Front Office', 'Housekeeping', 'Food & Beverage', 'Kitchen', 'Engineering', 'Finance', 'Human Resources', 'IT Support', 'Sales & Marketing', 'Security'];
const FOLLOW_UPS = ['Monitoring berkala setiap bulan oleh unit terkait', 'Evaluasi efektivitas setelah 3 bulan', 'Laporan progres ke Risk Owner setiap kuartal', 'Audit internal pada semester berikutnya', 'Review SOP dan pembaruan dokumentasi', 'Pelatihan ulang bagi karyawan terkait', 'Peninjauan ulang anggaran dan realisasi biaya', 'Verifikasi implementasi oleh tim kepatuhan'];

const OBJECTIVES = [
  'Meningkatkan kualitas layanan dan kepuasan tamu',
  'Menjaga stabilitas pendapatan dan efisiensi biaya operasional',
  'Memastikan kepatuhan terhadap regulasi dan standar keselamatan',
  'Meningkatkan keandalan sistem informasi dan perlindungan data',
  'Mengembangkan kapasitas dan retensi sumber daya manusia',
];

const LEVELS = [
  { min: 1, max: 4, level: 'Rendah' },
  { min: 5, max: 9, level: 'Moderat' },
  { min: 10, max: 16, level: 'Tinggi' },
  { min: 17, max: 25, level: 'Ekstrem' },
];
const levelOf = (s) => (LEVELS.find((l) => s >= l.min && s <= l.max) || {}).level || '-';

const nowIso = () => new Date().toISOString();
const makeInstruction = (text) => ({
  text,
  note: 'Mohon dilengkapi bukti pendukung.',
  by: MR,
  at: nowIso(),
});
const makeRealization = (note) => ({ note, by: OFFICER, at: nowIso() });
const makeDocument = (seq, index) => ({
  id: crypto.randomUUID(),
  original_name: `bukti-${seq}-${index + 1}.pdf`,
  storage_name: `bukti-${seq}-${index + 1}.pdf`,
  mime_type: 'application/pdf',
  size: rnd(120000, 900000),
  uploaded_at: nowIso(),
  uploaded_by: OFFICER,
});
const snapshotHistory = (meta, item) => ({
  archived_at: nowIso(),
  ...meta,
  instruction: item.instruction ? { ...item.instruction } : null,
  follow_up: item.follow_up || null,
  realization: item.realization ? { ...item.realization } : null,
  mr_note: item.mr_note || null,
  follow_up_status: item.follow_up_status || null,
  documents: (item.documents || []).map((d) => ({ ...d })),
});

const HISTORY_ACTOR = {
  SUBMIT: [OFFICER, 'RISK_OFFICER'],
  APPROVE_OWNER: [OWNER, 'RISK_OWNER'],
  REJECT_OWNER: [OWNER, 'RISK_OWNER'],
  MR_INSTRUCTION: [MR, 'MR'],
  OFFICER_REALIZATION: [OFFICER, 'RISK_OFFICER'],
  APPROVE_MR: [MR, 'MR'],
  MR_FINAL_RETURN: [MR, 'MR'],
  REJECT_MR: [MR, 'MR'],
  ARCHIVE: [MR, 'MR'],
};

const buildPair = () => {
  const L = rnd(2, 5);
  const I = rnd(2, 5);
  const rL = clamp(L - rnd(0, 2));
  const rI = clamp(I - rnd(0, 2));
  const aL = clamp(rL - rnd(0, 2));
  const aI = clamp(rI - rnd(0, 2));
  return { L, I, rL, rI, aL, aI };
};

(async () => {
  const c = await m.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'jxb_mr', multipleStatements: true });
  try {
    await c.query('DELETE FROM risk_registers');
    await c.query('DELETE FROM risk_code_counters');

    const statuses = [
      { name: 'DRAFT' },
      { name: 'WAITING_OWNER_APPROVAL' },
      { name: 'WAITING_OWNER_APPROVAL' },
      { name: 'WAITING_MR_INSTRUCTION' },
      { name: 'WAITING_MR_INSTRUCTION' },
      { name: 'WAITING_OFFICER_FOLLOWUP' },
      { name: 'WAITING_OFFICER_FOLLOWUP', returned: true },
      { name: 'WAITING_MR_APPROVAL' },
      { name: 'WAITING_MR_APPROVAL' },
      { name: 'APPROVED' },
      { name: 'REJECTED_BY_OWNER' },
      { name: 'ARCHIVED' },
    ];
    let seq = 0;
    for (const demo of statuses) {
      seq++;
      const status = demo.name;
      const returned = Boolean(demo.returned);
      const returnFlow = returned || status === 'REJECTED_BY_MR';
      const isDraft = status === 'DRAFT';
      const hasOwnerApproval = !['DRAFT', 'WAITING_OWNER_APPROVAL', 'REJECTED_BY_OWNER'].includes(status);
      const hasInstruction = ['WAITING_OFFICER_FOLLOWUP', 'WAITING_MR_APPROVAL', 'APPROVED', 'ARCHIVED', 'REJECTED_BY_MR'].includes(status);
      const everRealized = ['WAITING_MR_APPROVAL', 'APPROVED', 'ARCHIVED', 'REJECTED_BY_MR'].includes(status) || returned;
      const hasRealization = everRealized && !returnFlow;
      const hasDocuments = ['WAITING_OFFICER_FOLLOWUP', 'WAITING_MR_APPROVAL', 'APPROVED'].includes(status);
      const hasFinalAssessment = ['APPROVED', 'ARCHIVED', 'REJECTED_BY_MR'].includes(status) || returned;
      const mrReturnReason = 'Bukti belum menjelaskan hasil tindak lanjut.';
      const chosenCats = shuffle(CATEGORIES).slice(0, rnd(1, 2));
      const tree = chosenCats.map((cat) => {
        const events = shuffle(cat.events).slice(0, rnd(1, 2)).map((evName) => {
          const p = buildPair();
          const inhScore = p.L * p.I;
          const resScore = p.rL * p.rI;
          const aftScore = p.aL * p.aI;
          const causes = shuffle(CAUSES).slice(0, rnd(1, 3)).map((nm) => ({
            name: nm,
            source_id: pick(SOURCES),
            severity_description: pick(CONSEQUENCES),
            rp_amount: pick(RPS),
            work_unit: pick(WORK_UNITS),
          }));
          const mitigation_items = shuffle(MITIGATIONS).slice(0, rnd(2, 4)).map((d, i) => {
            const instructionText = hasInstruction ? pick(FOLLOW_UPS) : '';
            const instruction = hasInstruction ? makeInstruction(instructionText) : null;
            const realization = hasRealization
              ? makeRealization('Realisasi telah dilaksanakan dan didokumentasikan.')
              : null;
            const documents = hasDocuments && !returnFlow ? [makeDocument(seq, i)] : [];
            const priorRealization = returnFlow
              ? makeRealization('Realisasi sebelumnya belum menjelaskan hasil tindak lanjut.')
              : realization;
            const priorDocuments = returnFlow
              ? (hasDocuments ? [makeDocument(seq, i)] : [])
              : documents;
            const assessmentStatus = hasFinalAssessment
              ? (returnFlow ? (i % 2 === 0 ? 'BELUM_MEMADAI' : 'TIDAK_DAPAT_DITINDAKLANJUTI') : 'SELESAI')
              : null;
            const mrNote = hasFinalAssessment
              ? (returnFlow ? mrReturnReason : 'Penilaian MR: realisasi sesuai instruksi.')
              : null;
            const item = {
              id: crypto.randomUUID(),
              description: d,
              follow_up: instructionText || '',
              instruction,
              realization,
              order: i + 1,
              documents,
              follow_up_status: assessmentStatus,
              mr_note: mrNote,
              follow_up_history: [],
            };

            if (hasInstruction) {
              item.follow_up_history.push(snapshotHistory({
                archived_by: MR,
                actor_role: 'MR',
                action: 'MR_INSTRUCTION',
                reason: instruction.note,
              }, {
                follow_up: instructionText,
                instruction,
                realization: null,
                follow_up_status: null,
                mr_note: null,
                documents: [],
              }));
            }
            if (everRealized) {
              item.follow_up_history.push(snapshotHistory({
                archived_by: OFFICER,
                actor_role: 'RISK_OFFICER',
                action: 'OFFICER_REALIZATION',
                reason: priorRealization.note,
              }, {
                follow_up: instructionText,
                instruction,
                realization: priorRealization,
                follow_up_status: null,
                mr_note: null,
                documents: priorDocuments,
              }));
            }
            if (hasFinalAssessment) {
              item.follow_up_history.push(snapshotHistory({
                archived_by: MR,
                actor_role: 'MR',
                action: returnFlow ? 'MR_FINAL_RETURN' : 'MR_FINAL',
                reason: mrNote,
              }, {
                follow_up: instructionText,
                instruction,
                realization: priorRealization,
                follow_up_status: assessmentStatus,
                mr_note: mrNote,
                documents: priorDocuments,
              }));
            }
            return item;
          });
          return {
            name: evName,
            causes,
            inherent: { likelihood: p.L, impact: p.I, score: inhScore, level: levelOf(inhScore) },
            control: { present: pick(['ADA', 'TIDAK_ADA']), adequacy: pick(['MEMADAI', 'BELUM_MEMADAI']), implementation: rnd(30, 100) },
            residual: { likelihood: p.rL, impact: p.rI, score: resScore, level: levelOf(resScore) },
            mitigation_items,
            after: { likelihood: p.aL, impact: p.aI, score: aftScore, level: levelOf(aftScore) },
          };
        });
        return { id: cat.id, code: cat.code, events };
      });

      const objective = pick(OBJECTIVES);
      const risk_code = `RISK-${YEAR}-${String(seq).padStart(4, '0')}`;
      const submittedAt = isDraft ? null : new Date();
      const approvedAt = ['APPROVED', 'ARCHIVED'].includes(status) ? new Date() : null;
      const version = ['APPROVED', 'ARCHIVED'].includes(status) ? 2 : 1;

      const [ins] = await c.query(
        `INSERT INTO risk_registers (risk_code, year, branch_id, risk_officer_id, risk_owner_id, objective, status, current_version, submitted_at, approved_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [risk_code, YEAR, BRANCH, OFFICER, OWNER, objective, status, version, submittedAt, approvedAt, OFFICER]
      );
      const regId = ins.insertId;

      let cOrder = 0;
      for (const cat of tree) {
        const [ci] = await c.query('INSERT INTO risk_register_categories (risk_register_id, category_id, sort_order) VALUES (?,?,?)', [regId, cat.id, cOrder++]);
        let eOrder = 0;
        for (const ev of cat.events) {
          const [ei] = await c.query(
            `INSERT INTO risk_register_events (category_row_id, name, sort_order, inherent_likelihood, inherent_impact, inherent_score, control_present, control_adequacy, control_implementation_pct, residual_likelihood, residual_impact, residual_score, after_likelihood, after_impact, after_score, mitigation_items)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [ci.insertId, ev.name, eOrder++, ev.inherent.likelihood, ev.inherent.impact, ev.inherent.score, ev.control.present, ev.control.adequacy, ev.control.implementation, ev.residual.likelihood, ev.residual.impact, ev.residual.score, ev.after.likelihood, ev.after.impact, ev.after.score, JSON.stringify(ev.mitigation_items)]
          );
          let csOrder = 0;
          for (const cs of ev.causes) {
            await c.query(
              'INSERT INTO risk_register_causes (event_row_id, name, sort_order, source_id, severity_description, rp_amount, work_unit) VALUES (?,?,?,?,?,?,?)',
              [ei.insertId, cs.name, csOrder++, cs.source_id, cs.severity_description, cs.rp_amount, cs.work_unit]
            );
          }
        }
      }

      const histories = [];
      const pushHistory = (action, fromStatus, toStatus, reason = null) => {
        const [actorId, actorRole] = HISTORY_ACTOR[action];
        histories.push([action, actorId, actorRole, fromStatus, toStatus, reason]);
      };
      if (!isDraft) pushHistory('SUBMIT', 'DRAFT', 'WAITING_OWNER_APPROVAL');
      if (status === 'REJECTED_BY_OWNER') pushHistory('REJECT_OWNER', 'WAITING_OWNER_APPROVAL', status, 'Register perlu diperbaiki sebelum instruksi MR.');
      if (hasOwnerApproval) pushHistory('APPROVE_OWNER', 'WAITING_OWNER_APPROVAL', 'WAITING_MR_INSTRUCTION');
      if (hasInstruction) pushHistory('MR_INSTRUCTION', 'WAITING_MR_INSTRUCTION', 'WAITING_OFFICER_FOLLOWUP');
      if (everRealized) pushHistory('OFFICER_REALIZATION', 'WAITING_OFFICER_FOLLOWUP', 'WAITING_MR_APPROVAL');
      if (returned) pushHistory('MR_FINAL_RETURN', 'WAITING_MR_APPROVAL', 'WAITING_OFFICER_FOLLOWUP', mrReturnReason);
      if (['APPROVED', 'ARCHIVED'].includes(status)) pushHistory('APPROVE_MR', 'WAITING_MR_APPROVAL', 'APPROVED');
      if (status === 'REJECTED_BY_MR') pushHistory('REJECT_MR', 'WAITING_MR_APPROVAL', status, mrReturnReason);
      if (status === 'ARCHIVED') pushHistory('ARCHIVE', 'APPROVED', 'ARCHIVED');
      for (const h of histories) {
        await c.query(
          'INSERT INTO approval_histories (risk_register_id, action, actor_id, actor_role, from_status, to_status, reason) VALUES (?,?,?,?,?,?,?)',
          [regId, ...h]
        );
      }

      if (!isDraft) {
        const mitigationAction = {
          WAITING_OWNER_APPROVAL: 'SUBMIT',
          REJECTED_BY_OWNER: 'SUBMIT',
          WAITING_MR_INSTRUCTION: 'APPROVE_OWNER',
          WAITING_OFFICER_FOLLOWUP: 'MR_INSTRUCTION',
          WAITING_MR_APPROVAL: 'OFFICER_REALIZATION',
          APPROVED: 'MR_FINAL',
          ARCHIVED: 'MR_FINAL',
          REJECTED_BY_MR: 'MR_FINAL_RETURN',
        }[status];
        const currentAction = returned ? 'MR_FINAL_RETURN' : mitigationAction;
        const rejectionReason = status === 'REJECTED_BY_OWNER'
          ? 'Dikembalikan Owner sebelum instruksi MR'
          : returnFlow ? mrReturnReason : null;
        const snapshot = {
          objective,
          risk_code,
          generated_at: new Date().toISOString(),
          items: tree.flatMap((cat) => cat.events.map((ev) => ({
            category: cat.code,
            event: ev.name,
            causes: ev.causes.map((cs) => ({ name: cs.name, source_id: cs.source_id, severity_description: cs.severity_description, rp_amount: cs.rp_amount, work_unit: cs.work_unit })),
            inherent: ev.inherent,
            control: ev.control,
            residual: ev.residual,
            mitigation_items: ev.mitigation_items,
            after: ev.after,
          }))),
        };
        await c.query(
          'INSERT INTO risk_mitigation_histories (risk_register_id, version, snapshot, action, approval_status, rejection_reason, created_by) VALUES (?,?,?,?,?,?,?)',
          [regId, version, JSON.stringify(snapshot), currentAction, status, rejectionReason, OFFICER]
        );
      }
      console.log(`seeded ${risk_code} [${status}]`);
    }

    await c.query('INSERT INTO risk_code_counters (year, last_seq) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_seq = VALUES(last_seq)', [YEAR, seq]);
    const [cnt] = await c.query('SELECT (SELECT COUNT(*) FROM risk_registers) r, (SELECT COUNT(*) FROM risk_register_events) e, (SELECT COUNT(*) FROM risk_register_causes) c');
    console.log('DONE', cnt[0]);
  } catch (err) {
    console.error('ERR', err.message);
  } finally {
    await c.end();
  }
})();
