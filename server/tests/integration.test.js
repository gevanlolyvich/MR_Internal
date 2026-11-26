/**
 * Integration test — MEMBUTUHKAN database MySQL `jxb_mr` (XAMPP) sudah dimigrasi + seed.
 * Jalankan: npm test
 *
 * Test ini menulis data register baru ke database (idempoten, memakai kode unik per run).
 */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { ping, query } = require('../src/db/pool');

let dbReady = false;
const tokens = {};

const api = () => request(app);

const login = async (username, password = 'Jxb@2026') => {
  const res = await api().post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Login ${username} gagal (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
};

beforeAll(async () => {
  try {
    await ping();
    dbReady = true;
  } catch (err) {
    throw new Error(
      `Database tidak tersedia: ${err.message}\n` +
        'Jalankan migrasi + seed di XAMPP terlebih dahulu (lihat server/MIGRATION.md), lalu ulangi npm test.'
    );
  }

  const mr = await login('mr.admin');
  const officer = await login('officer.cempaka');
  const owner = await login('owner.cempaka1');
  tokens.mr = mr.token;
  tokens.officer = officer.token;
  tokens.owner = owner.token;
  tokens.officerUser = officer.user;
  tokens.ownerUser = owner.user;
  tokens.mrUser = mr.user;
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const mitigationItemIds = async (registerId) => {
  const res = await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer));
  return res.body.data.categories
    .flatMap((c) => c.events || [])
    .flatMap((e) => {
      const items = typeof e.mitigation_items === 'string' ? JSON.parse(e.mitigation_items) : e.mitigation_items || [];
      return items;
    })
    .map((m) => m.id)
    .filter(Boolean);
};

const completeInstruction = async (registerId) => {
  const ids = await mitigationItemIds(registerId);
  const res = await api()
    .post(`/api/risk-registers/${registerId}/mr-instruction`)
    .set(auth(tokens.mr))
    .send({ items: ids.map((itemId) => ({ itemId, text: 'Lakukan tindak lanjut sesuai mitigasi.', note: 'Mohon bukti pendukung.' })) });
  expect(res.status).toBe(200);
  return ids;
};

const completeRealization = async (registerId, ids) => {
  const res = await api()
    .post(`/api/risk-registers/${registerId}/follow-up-realization`)
    .set(auth(tokens.officer))
    .send({ items: ids.map((itemId) => ({ itemId, note: 'Realisasi telah dilaksanakan.' })) });
  expect(res.status).toBe(200);
  return res;
};

const finalAssessments = (ids, status = 'SELESAI', note = 'Bukti memadai.') =>
  ids.map((itemId) => ({ itemId, status, note }));

const assessFinal = async (registerId, ids, status = 'SELESAI', note = 'Bukti memadai.', route = 'approve') => {
  const assessments = finalAssessments(ids, status, note);
  if (route === 'follow-up-status') {
    return api().put(`/api/approvals/${registerId}/follow-up-status`).set(auth(tokens.mr)).send({ items: assessments });
  }
  return api().post(`/api/approvals/${registerId}/${route}`).set(auth(tokens.mr)).send({ assessments });
};

const completeFinalAssessment = (registerId, ids, route = 'approve') => assessFinal(registerId, ids, 'SELESAI', 'Bukti memadai.', route);

const serializeEvent = (e, mitigationDescription, after) => {
  const items = typeof e.mitigation_items === 'string' ? JSON.parse(e.mitigation_items) : e.mitigation_items || [];
  const mitigation_items = items.map((m, idx) => ({
    id: m.id,
    description: mitigationDescription && idx === 0 ? mitigationDescription : m.description,
    instruction: m.instruction || null,
    realization: m.realization || null,
    mr_note: m.mr_note || '',
    documents: m.documents || [],
    follow_up_status: m.follow_up_status || null,
    follow_up_history: m.follow_up_history || [],
  }));
  return {
    name: e.name,
    causes: (e.causes || []).map((c) => ({
      name: c.name,
      source_id: c.source_id,
      severity_description: c.severity_description,
      rp_amount: c.rp_amount,
      work_unit: c.work_unit,
    })),
    inherent: { likelihood: e.inherent_likelihood, impact: e.inherent_impact },
    control: {
      present: e.control_present,
      adequacy: e.control_adequacy,
      implementation: e.control_implementation_pct,
    },
    residual: { likelihood: e.residual_likelihood, impact: e.residual_impact },
    mitigation_items,
    after: after || { likelihood: e.after_likelihood, impact: e.after_impact },
  };
};

let masters = {};
const loadMasters = async () => {
  const [cats, trs, srcs] = await Promise.all([
    api().get('/api/masters/categories').set(auth(tokens.mr)),
    api().get('/api/masters/treatments').set(auth(tokens.mr)),
    api().get('/api/masters/sources').set(auth(tokens.mr)),
  ]);
  masters.category = cats.body.data.find((c) => c.code === 'RK-OPS') || cats.body.data[0];
  masters.treatment = trs.body.data.find((t) => t.code === 'TR-RED') || trs.body.data[0];
  masters.source = srcs.body.data.find((s) => s.code === 'INT') || srcs.body.data[0];
};

const cause = (name, inh, res, aft, mitigationDescription) => ({
  name,
  causes: [
    {
      name,
      source_id: masters.source.id,
      severity_description: 'Test severity',
      rp_amount: 50000000,
      work_unit: 'IT',
    },
  ],
  inherent: { likelihood: inh[0], impact: inh[1] },
  control: { present: 'ADA', adequacy: 'MEMADAI', implementation: 80 },
  residual: { likelihood: res[0], impact: res[1] },
  mitigation_items: [
    { description: mitigationDescription || 'Melakukan monitoring dan analisis rutin secara berkala.' },
  ],
  after: { likelihood: aft[0], impact: aft[1] },
});

const payload = (ownerId, objective, events) => ({
  objective,
  risk_owner_id: ownerId,
  categories: [
    {
      category_id: masters.category.id,
      events,
    },
  ],
});

const createRegister = async (body) => {
  const res = await api().post('/api/risk-registers').set(auth(tokens.officer)).send(body);
  return res;
};

const RUN = Date.now();

describe('1. Authentication', () => {
  test('Login MR berhasil dan punya permission MR', async () => {
    const res = await api().post('/api/auth/login').send({ username: 'mr.admin', password: 'Jxb@2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('MR');
    expect(res.body.data.permissions).toContain('user:manage');
    expect(res.body.data.token).toBeTruthy();
  });

  test('Login Risk Officer berhasil', async () => {
    const res = await api().post('/api/auth/login').send({ username: 'officer.cempaka', password: 'Jxb@2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('RISK_OFFICER');
    expect(res.body.data.user.branch_name).toBe('C One Hotel Cempaka Putih');
  });

  test('Login Risk Owner berhasil', async () => {
    const res = await api().post('/api/auth/login').send({ username: 'owner.cempaka1', password: 'Jxb@2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('RISK_OWNER');
  });

  test('Login invalid ditolak', async () => {
    const res = await api().post('/api/auth/login').send({ username: 'mr.admin', password: 'salah-banget' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Akses tanpa token ditolak 401', async () => {
    const res = await api().get('/api/risk-registers');
    expect(res.status).toBe(401);
  });

  test('GET /auth/me mengembalikan user aktif', async () => {
    const res = await api().get('/api/auth/me').set(auth(tokens.officer));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('officer.cempaka');
  });
});

describe('2. Authorization (role)', () => {
  beforeAll(loadMasters);

  test('Risk Officer TIDAK bisa approve', async () => {
    const res = await api().post('/api/approvals/1/approve').set(auth(tokens.officer));
    expect(res.status).toBe(403);
  });

  test('Risk Officer TIDAK bisa akses User Management', async () => {
    const res = await api().get('/api/users').set(auth(tokens.officer));
    expect(res.status).toBe(403);
  });

  test('Risk Owner TIDAK bisa create Risk Register', async () => {
    const res = await api()
      .post('/api/risk-registers')
      .set(auth(tokens.owner))
      .send(payload(tokens.ownerUser.id, 'Tidak boleh', [cause('c', [3, 3], [2, 2], [1, 2])]));
    expect(res.status).toBe(403);
  });

  test('MR TIDAK create Risk Register (read-only)', async () => {
    const res = await api()
      .post('/api/risk-registers')
      .set(auth(tokens.mr))
      .send(payload(tokens.ownerUser.id, 'Tidak boleh', [cause('c', [3, 3], [2, 2], [1, 2])]));
    expect(res.status).toBe(403);
  });

  test('MR TIDAK bisa edit/submit Risk Register (read-only)', async () => {
    const res = await api().put('/api/risk-registers/1').set(auth(tokens.mr)).send({});
    expect(res.status).toBe(403); // risk-register:edit tidak dimiliki MR
  });

  test('Risk Owner TIDAK bisa kelola user', async () => {
    const res = await api().get('/api/users').set(auth(tokens.owner));
    expect(res.status).toBe(403); // user:manage tidak dimiliki Owner
  });

  test('Owner bisa baca daftar Risk Register (read-only)', async () => {
    const res = await api().get('/api/risk-registers').set(auth(tokens.owner));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('Owner branch lain tidak muncul di dropdown owner officer', async () => {
    const res = await api().get('/api/risk-registers/owners/me').set(auth(tokens.officer));
    expect(res.status).toBe(200);
    const otherBranchOwner = res.body.data.find((o) => o.id === 999999);
    expect(otherBranchOwner).toBeUndefined();
    res.body.data.forEach((o) => expect(o.id).toBe(tokens.ownerUser.id));
  });
});

describe('3. Validasi pembuatan Risk Register', () => {
  beforeAll(loadMasters);

  test('Objective wajib diisi (400)', async () => {
    const res = await createRegister(payload(tokens.ownerUser.id, '', [cause('c', [3, 3], [2, 2], [1, 2])]));
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'objective')).toBe(true);
  });

  test('Owner dari branch berbeda DITOLAK (validasi backend)', async () => {
    // Buat owner baru di branch lain lewat MR
    const [branches] = await query(`SELECT id, code FROM branches WHERE code IN ('IT','HRD') LIMIT 1`);
    const otherBranchId = branches[0].id;
    const newUser = await api()
      .post('/api/users')
      .set(auth(tokens.mr))
      .send({
        name: 'Owner Lain',
        username: `owner.lain.${RUN}`,
        email: `owner.lain.${RUN}@jxb.local`,
        password: 'Jxb@2026',
        role: 'RISK_OWNER',
        branch_id: otherBranchId,
      });
    expect(newUser.status).toBe(201);
    const otherOwnerId = newUser.body.data.id;

    const res = await createRegister(payload(otherOwnerId, 'Objective dengan owner salah branch', [cause('c', [3, 3], [2, 2], [1, 2])]));
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'risk_owner_id')).toBe(true);
  });

  test('Likelihood di luar 1-5 ditolak', async () => {
    const res = await createRegister(payload(tokens.ownerUser.id, 'Objective skor salah', [cause('c', [9, 9], [2, 2], [1, 2])]));
    expect(res.status).toBe(400);
  });

  test('Risk Treatment wajib diisi', async () => {
    const bad = cause('c', [3, 3], [2, 2], [1, 2]);
    bad.mitigation_items = [];
    const res = await createRegister(payload(tokens.ownerUser.id, 'Objective tanpa treatment', [bad]));
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field.includes('mitigation_items'))).toBe(true);
  });
});

describe('4. Kalkulasi risk level otomatis', () => {
  let registerId = null;

  beforeAll(async () => {
    const res = await createRegister(
      payload(tokens.ownerUser.id, `Kalkulasi risiko ${RUN}`, [
        cause('Rendah 1x1', [1, 1], [1, 1], [1, 1]),
        cause('Moderat 3x3', [3, 3], [2, 2], [3, 3]),
        cause('Ekstrem 5x5', [5, 5], [4, 4], [5, 5]),
      ])
    );
    expect(res.status).toBe(201);
    registerId = res.body.data.id;
  });

  test('Kode risk register otomatis RISK-YYYY-NNNN', async () => {
    const code = (await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer))).body.data.risk_code;
    expect(code).toMatch(/^RISK-\d{4}-\d{4}$/);
  });

  test('Score dan level per event sesuai matrix', async () => {
    const res = await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer));
    const events = res.body.data.categories[0].events;
    expect(events).toHaveLength(3);

    const r = events.find((e) => e.causes[0].name.startsWith('Rendah'));
    expect(r.inherent_score).toBe(1);

    const m = events.find((e) => e.causes[0].name.startsWith('Moderat'));
    expect(m.inherent_score).toBe(9);
    expect(m.after_score).toBe(9);

    const e = events.find((ev) => ev.causes[0].name.startsWith('Ekstrem'));
    expect(e.inherent_score).toBe(25);
    expect(e.residual_score).toBe(16);
  });

  test('Level risk TIDAK boleh diinput manual (field score dihitung sistem)', async () => {
    const res = await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer));
    const e = res.body.data.categories[0].events[0];
    expect(e.inherent_score).toBe(e.inherent_likelihood * e.inherent_impact);
    expect(e.residual_score).toBe(e.residual_likelihood * e.residual_impact);
    expect(e.after_score).toBe(e.after_likelihood * e.after_impact);
  });

  test('Kode register unik antar register', async () => {
    const res = await createRegister(payload(tokens.ownerUser.id, `Unik ${RUN}`, [cause('c', [2, 2], [2, 2], [1, 1])]));
    expect(res.status).toBe(201);
    const code1 = (await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer))).body.data.risk_code;
    const code2 = res.body.data.risk_code;
    expect(code1).not.toBe(code2);
  });
});

describe('5. Workflow approval penuh', () => {
  let id = null;
  let ids = [];

  beforeAll(async () => {
    const res = await createRegister(
      payload(tokens.ownerUser.id, `Workflow happy path ${RUN}`, [cause('c', [3, 3], [2, 2], [1, 2])])
    );
    expect(res.status).toBe(201);
    id = res.body.data.id;
  });

  test('Draft → Submit → WAITING_OWNER_APPROVAL', async () => {
    const res = await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_OWNER_APPROVAL');
  });

  test('Owner approve → WAITING_MR_INSTRUCTION', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_MR_INSTRUCTION');
  });

  test('Approve owner ganda DITOLAK (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(res.status).toBe(409);
  });

  test('MR TIDAK bisa approve sebelum memberi instruksi (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(409);
  });

  test('MR melihat antrian instruksi', async () => {
    const res = await api().get('/api/approvals').set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.id === id)).toBe(true);
  });

  test('Instruksi MR → WAITING_OFFICER_FOLLOWUP', async () => {
    ids = await completeInstruction(id);
    const detail = await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer));
    expect(detail.body.data.status).toBe('WAITING_OFFICER_FOLLOWUP');
    const rawItems = detail.body.data.categories[0].events[0].mitigation_items;
    const item = typeof rawItems === 'string' ? JSON.parse(rawItems)[0] : rawItems[0];
    expect(item.instruction.text).toBe('Lakukan tindak lanjut sesuai mitigasi.');
  });

  test('Realisasi Officer → WAITING_MR_APPROVAL', async () => {
    await completeRealization(id, ids);
    const detail = await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer));
    expect(detail.body.data.status).toBe('WAITING_MR_APPROVAL');
  });

  test('MR approve tanpa penilaian ditolak (400)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(400);
  });

  test('MR approve dengan penilaian → APPROVED', async () => {
    const res = await completeFinalAssessment(id, ids);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approved_at).toBeTruthy();
  });

  test('MR approve ganda DITOLAK (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(409);
  });

  test('Approval history lengkap', async () => {
    const res = await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.mr));
    const actions = res.body.data.approvals.map((a) => a.action);
    expect(actions).toEqual([
      'SUBMIT', 'APPROVE_OWNER', 'MR_INSTRUCTION', 'OFFICER_REALIZATION', 'APPROVE_MR',
    ]);
  });

  test('Register APPROVED tidak bisa diedit lagi', async () => {
    const detail = (await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer))).body.data;
    const body = {
      objective: 'Ubah setelah approve',
      risk_owner_id: detail.risk_owner_id,
      categories: [
        {
          category_id: detail.categories[0].category_id,
          events: [serializeEvent(detail.categories[0].events[0], 'x')],
        },
      ],
    };
    const res = await api().put(`/api/risk-registers/${id}`).set(auth(tokens.officer)).send(body);
    expect(res.status).toBe(409);
  });
});

describe('6. Rejection & mitigation history', () => {
  let id = null;
  let ids = [];

  const firstItem = async () => {
    const detail = (await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer))).body.data;
    const rawItems = detail.categories[0].events[0].mitigation_items;
    const items = typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems;
    return items[0];
  };

  beforeAll(async () => {
    const res = await createRegister(
      payload(tokens.ownerUser.id, `Rejection flow ${RUN}`, [cause('Mitigasi awal', [4, 4], [3, 3], [3, 3])])
    );
    expect(res.status).toBe(201);
    id = res.body.data.id;
    ids = await mitigationItemIds(id);
    await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
  });

  test('Reject TANPA alasan ditolak (400)', async () => {
    const res = await api().post(`/api/approvals/${id}/reject`).set(auth(tokens.owner)).send({ reason: '' });
    expect(res.status).toBe(400);
  });

  test('Owner reject DENGAN alasan → REJECTED_BY_OWNER', async () => {
    const res = await api()
      .post(`/api/approvals/${id}/reject`)
      .set(auth(tokens.owner))
      .send({ reason: 'Mitigasi belum menjelaskan tindakan preventif secara detail.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED_BY_OWNER');
  });

  test('History menyimpan alasan reject', async () => {
    const res = await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.officer));
    const reject = res.body.data.approvals.find((a) => a.action === 'REJECT_OWNER');
    expect(reject.reason).toContain('tindakan preventif');
  });

  test('Risk Officer memperbaiki mitigasi → versi lama TIDAK hilang', async () => {
    const detail = (await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer))).body.data;
    const cat = detail.categories[0];

    const update = {
      objective: detail.objective,
      risk_owner_id: detail.risk_owner_id,
      categories: [
        {
          category_id: cat.category_id,
          events: [
            serializeEvent(
              cat.events[0],
              '1. Melakukan analisis dan monitoring biaya secara rutin.\n2. Melakukan negosiasi dengan pemasok untuk harga lebih kompetitif.',
              { likelihood: 2, impact: 2 }
            ),
          ],
        },
      ],
    };

    const res = await api().put(`/api/risk-registers/${id}`).set(auth(tokens.officer)).send(update);
    expect(res.status).toBe(200);
    expect(res.body.data.current_version).toBe(2);

    const hist = (await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.officer))).body.data;
    expect(hist.mitigations).toHaveLength(2);
    const versions = hist.mitigations.map((m) => m.version);
    expect(versions).toEqual(expect.arrayContaining([1, 2]));
    const v1 = hist.mitigations.find((m) => m.version === 1);
    expect(JSON.parse(v1.snapshot).items[0].mitigation_items[0].description).toContain('Melakukan monitoring');
  });

  test('Resubmit → Owner approve → MR instruction → Officer realization', async () => {
    const s1 = await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    expect(s1.status).toBe(200);
    expect(s1.body.data.status).toBe('WAITING_OWNER_APPROVAL');

    const a1 = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(a1.body.data.status).toBe('WAITING_MR_INSTRUCTION');

    ids = await completeInstruction(id);
    const r1 = await completeRealization(id, ids);
    expect(r1.body.data.status).toBe('WAITING_MR_APPROVAL');
  });

  test('MR nilai BELUM_MEMADAI → kembali ke Officer + bukti lama masuk history', async () => {
    const res = await assessFinal(id, ids, 'BELUM_MEMADAI', 'Bukti belum menjelaskan hasil tindak lanjut.');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_OFFICER_FOLLOWUP');

    const item = await firstItem();
    expect(item.follow_up_status).toBe('BELUM_MEMADAI');
    expect(item.realization?.note).toBe('Realisasi telah dilaksanakan.');
    expect(item.documents || []).toHaveLength(0);
    const archived = (item.follow_up_history || []).find((h) => h.action === 'MR_FINAL_RETURN');
    expect(archived).toBeTruthy();
    expect(archived.realization.note).toBe('Realisasi telah dilaksanakan.');
  });

  test('Officer kirim ulang bukti → MR setujui → APPROVED', async () => {
    const r2 = await completeRealization(id, ids);
    expect(r2.body.data.status).toBe('WAITING_MR_APPROVAL');

    const final = await completeFinalAssessment(id, ids);
    expect(final.body.data.status).toBe('APPROVED');

    const hist = (await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.mr))).body.data;
    expect(hist.mitigations).toHaveLength(2);
    expect(hist.approvals.map((a) => a.action)).toEqual([
      'SUBMIT', 'REJECT_OWNER',
      'SUBMIT', 'APPROVE_OWNER', 'MR_INSTRUCTION', 'OFFICER_REALIZATION',
      'MR_FINAL_RETURN', 'OFFICER_REALIZATION', 'APPROVE_MR',
    ]);
  });
});

describe('7. Scope data per role', () => {
  test('Risk Officer hanya melihat register miliknya', async () => {
    const res = await api().get('/api/risk-registers?limit=100').set(auth(tokens.officer));
    expect(res.status).toBe(200);
    res.body.items.forEach((r) => expect(r.risk_officer_id).toBe(tokens.officerUser.id));
  });

  test('Risk Owner hanya melihat register yang ditugaskan kepadanya', async () => {
    const res = await api().get('/api/risk-registers?limit=100').set(auth(tokens.owner));
    expect(res.status).toBe(200);
    res.body.items.forEach((r) => expect(r.risk_owner_id).toBe(tokens.ownerUser.id));
  });

  test('MR melihat semua register', async () => {
    const res = await api().get('/api/risk-registers?limit=100').set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('Owner tidak bisa membuka register orang lain', async () => {
    const [rows] = await query(`SELECT id FROM risk_registers WHERE risk_owner_id <> ? LIMIT 1`, [tokens.ownerUser.id]);
    if (!rows.length) return;
    const res = await api().get(`/api/risk-registers/${rows[0].id}`).set(auth(tokens.owner));
    expect(res.status).toBe(403);
  });
});

describe('8. Dashboard / matrix / monitoring / export (MR)', () => {
  test('Dashboard mengembalikan cards dan charts nyata', async () => {
    const res = await api().get('/api/dashboard').set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(res.body.data.cards.total_risk).toBeGreaterThan(0);
    expect(res.body.data.charts.by_status.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.charts.by_year)).toBe(true);
  });

  test('Matrix 5×5 dari master data + tolerance', async () => {
    const res = await api().get('/api/matrix').set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(res.body.data.likelihood).toHaveLength(5);
    expect(res.body.data.impact).toHaveLength(5);
    expect(res.body.data.levels).toHaveLength(4);
    expect(res.body.data.tolerance.max_score).toBeGreaterThan(0);
  });

  test('Monitoring summary per branch', async () => {
    const res = await api().get('/api/monitoring/summary').set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Export Excel menghasilkan file xlsx', async () => {
    const res = await api().get('/api/export/risk-register').set(auth(tokens.mr)).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
    // signature zip PK
    expect(res.body.slice(0, 2).toString('latin1')).toBe('PK');
  });

  test('Export ditolak untuk role selain MR', async () => {
    const res = await api().get('/api/export/risk-register').set(auth(tokens.officer));
    expect(res.status).toBe(403);
  });
});

describe('9. Instruksi MR dikembalikan', () => {
  let id = null;

  beforeAll(async () => {
    const res = await createRegister(
      payload(tokens.ownerUser.id, `Instruksi reject ${RUN}`, [cause('Instruksi reject', [3, 3], [2, 2], [1, 2])])
    );
    expect(res.status).toBe(201);
    id = res.body.data.id;
    await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
  });

  test('Officer TIDAK bisa mengisi instruksi MR (403)', async () => {
    const res = await api()
      .post(`/api/risk-registers/${id}/mr-instruction`)
      .set(auth(tokens.officer))
      .send({ items: [{ itemId: 'x', text: 'x', note: 'x' }] });
    expect(res.status).toBe(403);
  });

  test('Reject instruksi tanpa alasan ditolak (400)', async () => {
    const res = await api().post(`/api/approvals/${id}/reject-instruction`).set(auth(tokens.mr)).send({ reason: '' });
    expect(res.status).toBe(400);
  });

  test('MR mengembalikan instruksi → REJECTED_BY_MR', async () => {
    const res = await api()
      .post(`/api/approvals/${id}/reject-instruction`)
      .set(auth(tokens.mr))
      .send({ reason: 'Instruksi perlu disesuaikan.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED_BY_MR');
  });

  test('Submit ulang kembali ke approval Owner', async () => {
    const res = await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_OWNER_APPROVAL');
  });
});

describe('10. Multi-item mitigasi pada satu risk event', () => {
  let id = null;
  let ids = [];

  beforeAll(loadMasters);

  beforeAll(async () => {
    const event = cause('Multi mitigasi', [3, 3], [2, 2], [1, 2], 'Mitigasi pertama');
    event.mitigation_items.push({ description: 'Mitigasi kedua' });
    const res = await createRegister(payload(tokens.ownerUser.id, `Multi mitigasi ${RUN}`, [event]));
    expect(res.status).toBe(201);
    id = res.body.data.id;
    ids = await mitigationItemIds(id);
    expect(ids).toHaveLength(2);
    await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
  });

  const storedItems = async () => {
    const detail = await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer));
    const raw = detail.body.data.categories[0].events[0].mitigation_items;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  };

  test('Instruksi MR tersimpan untuk kedua item mitigasi', async () => {
    const items = ids.map((itemId, i) => ({
      itemId,
      text: `Instruksi ${i + 1}`,
      note: `Catatan MR ${i + 1}`,
    }));
    const res = await api()
      .post(`/api/risk-registers/${id}/mr-instruction`)
      .set(auth(tokens.mr))
      .send({ items });
    expect(res.status).toBe(200);

    const byId = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    items.forEach((item, i) => {
      expect(byId[String(item.itemId)].instruction.text).toBe(item.text);
      expect(byId[String(item.itemId)].instruction.note).toBe(item.note);
    });
  });

  test('Realisasi Officer tersimpan untuk kedua item mitigasi', async () => {
    const items = ids.map((itemId, i) => ({ itemId, note: `Realisasi ${i + 1}` }));
    const res = await api()
      .post(`/api/risk-registers/${id}/follow-up-realization`)
      .set(auth(tokens.officer))
      .send({ items });
    expect(res.status).toBe(200);

    const byId = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    items.forEach((item) => {
      expect(byId[String(item.itemId)].realization.note).toBe(item.note);
    });
  });

  test('Penilaian MR tersimpan untuk kedua item mitigasi', async () => {
    const assessments = ids.map((itemId, i) => ({
      itemId,
      status: i === 0 ? 'SELESAI' : 'BELUM_MEMADAI',
      note: `Penilaian ${i + 1}`,
    }));
    const res = await api()
      .post(`/api/approvals/${id}/approve`)
      .set(auth(tokens.mr))
      .send({ assessments });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_OFFICER_FOLLOWUP');

    const byId = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    assessments.forEach((assessment) => {
      expect(byId[String(assessment.itemId)].follow_up_status).toBe(assessment.status);
      expect(byId[String(assessment.itemId)].mr_note).toBe(assessment.note);
    });
  });

  test('Upload bukti menyimpan catatan realisasi dan dokumen bisa dihapus', async () => {
    const itemId = ids[1];
    const note = 'Catatan realisasi saat upload bukti';
    const upload = await api()
      .post(`/api/risk-registers/${id}/mitigation-items/${itemId}/documents`)
      .set(auth(tokens.officer))
      .field('note', note)
      .attach('files', Buffer.from('%PDF-1.4 bukti pdf'), 'bukti.pdf');
    expect(upload.status).toBe(200);

    const afterUpload = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    expect(afterUpload[String(itemId)].realization.note).toBe(note);
    expect(afterUpload[String(itemId)].documents).toHaveLength(1);
    const docId = afterUpload[String(itemId)].documents[0].id;

    const remove = await api()
      .delete(`/api/risk-registers/${id}/mitigation-items/${itemId}/documents/${docId}`)
      .set(auth(tokens.officer));
    expect(remove.status).toBe(200);

    const afterRemove = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    expect(afterRemove[String(itemId)].documents).toHaveLength(0);
    expect(afterRemove[String(itemId)].realization.note).toBe(note);
  });

  test('Item yang sudah SELESAI tidak dapat diubah Officer', async () => {
    const doneId = ids[0];
    const submit = await api()
      .post(`/api/risk-registers/${id}/follow-up-realization`)
      .set(auth(tokens.officer))
      .send({ items: [{ itemId: doneId, note: 'Coba ubah item yang sudah sesuai' }] });
    expect(submit.status).toBe(409);

    const upload = await api()
      .post(`/api/risk-registers/${id}/mitigation-items/${doneId}/documents`)
      .set(auth(tokens.officer))
      .field('note', 'Coba ubah item yang sudah sesuai')
      .attach('files', Buffer.from('%PDF-1.4 bukti terkunci'), 'bukti-terkunci.pdf');
    expect(upload.status).toBe(409);

    const byId = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    expect(byId[String(doneId)].follow_up_status).toBe('SELESAI');
    expect(byId[String(doneId)].realization.note).toBe('Realisasi 1');
    expect(byId[String(doneId)].documents || []).toHaveLength(0);
  });

  test('Penilaian MR pada item SELESAI tidak dapat diubah', async () => {
    const resubmit = await api()
      .post(`/api/risk-registers/${id}/follow-up-realization`)
      .set(auth(tokens.officer))
      .send({ items: [{ itemId: ids[1], note: 'Realisasi ulang item belum sesuai' }] });
    expect(resubmit.body.data.status).toBe('WAITING_MR_APPROVAL');

    const save = await api()
      .put(`/api/approvals/${id}/follow-up-status`)
      .set(auth(tokens.mr))
      .send({ items: [{ itemId: ids[0], status: 'BELUM_MEMADAI', note: 'Coba ubah penilaian final' }] });
    expect(save.status).toBe(409);

    const approve = await api()
      .post(`/api/approvals/${id}/approve`)
      .set(auth(tokens.mr))
      .send({ assessments: [{ itemId: ids[0], status: 'BELUM_MEMADAI', note: 'Coba ubah penilaian final' }] });
    expect(approve.status).toBe(409);

    const byId = Object.fromEntries((await storedItems()).map((m) => [String(m.id), m]));
    expect(byId[String(ids[0])].follow_up_status).toBe('SELESAI');
    expect(byId[String(ids[0])].mr_note).toBe('Penilaian 1');
  });
});

describe('11. Riwayat penilaian MR memakai status terakhir', () => {
  let id = null;
  let itemId = null;

  beforeAll(loadMasters);

  beforeAll(async () => {
    const event = cause('Riwayat status MR', [3, 3], [2, 2], [1, 2], 'Mitigasi riwayat');
    const res = await createRegister(payload(tokens.ownerUser.id, `Riwayat status MR ${RUN}`, [event]));
    expect(res.status).toBe(201);
    id = res.body.data.id;
    [itemId] = await mitigationItemIds(id);
    await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    await completeInstruction(id);
    await api()
      .post(`/api/risk-registers/${id}/mitigation-items/${itemId}/documents`)
      .set(auth(tokens.officer))
      .field('note', 'Realisasi telah dilaksanakan.')
      .attach('files', Buffer.from('%PDF-1.4 bukti riwayat'), 'bukti-riwayat.pdf');
    await completeRealization(id, [itemId]);
  });

  const storedItem = async () => {
    const detail = await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer));
    const raw = detail.body.data.categories[0].events[0].mitigation_items;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw)[0];
  };

  test('Perubahan status saat selesaikan penilaian tercatat di riwayat', async () => {
    const first = await api()
      .post(`/api/approvals/${id}/approve`)
      .set(auth(tokens.mr))
      .send({ assessments: [{ itemId, status: 'TIDAK_DAPAT_DITINDAKLANJUTI', note: 'Penilaian pertama' }] });
    expect(first.status).toBe(200);
    const returned = await storedItem();
    expect(returned.follow_up_status).toBe('TIDAK_DAPAT_DITINDAKLANJUTI');
    expect(returned.realization?.note).toBe('Realisasi telah dilaksanakan.');
    expect(returned.documents || []).toHaveLength(1);

    await completeRealization(id, [itemId]);
    const second = await api()
      .post(`/api/approvals/${id}/approve`)
      .set(auth(tokens.mr))
      .send({ assessments: [{ itemId, status: 'BELUM_MEMADAI', note: 'Penilaian kedua' }] });
    expect(second.status).toBe(200);

    const item = await storedItem();
    expect(item.follow_up_status).toBe('BELUM_MEMADAI');
    const returns = (item.follow_up_history || []).filter((h) => h.action === 'MR_FINAL_RETURN');
    expect(returns).toHaveLength(2);
    expect(returns[0].follow_up_status).toBe('TIDAK_DAPAT_DITINDAKLANJUTI');
    expect(returns[1].follow_up_status).toBe('BELUM_MEMADAI');
    expect(returns[1].mr_note).toBe('Penilaian kedua');
  });
});
