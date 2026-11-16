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

const cause = (name, inh, res, aft) => ({
  name,
  source_id: masters.source.id,
  severity_id: null,
  severity_description: 'Test severity',
  rp_amount: 50000000,
  inherent: { likelihood: inh[0], impact: inh[1] },
  control: { present: 'ADA', adequacy: 'MEMADAI', implementation: 80 },
  residual: { likelihood: res[0], impact: res[1] },
  treatment_id: masters.treatment.id,
  mitigation_description: 'Melakukan monitoring dan analisis rutin secara berkala.',
  after: { likelihood: aft[0], impact: aft[1] },
});

const payload = (ownerId, objective, causes) => ({
  objective,
  risk_owner_id: ownerId,
  categories: [
    {
      category_id: masters.category.id,
      events: [
        {
          name: 'Kenaikan harga bahan baku',
          causes,
        },
      ],
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
    bad.treatment_id = null;
    const res = await createRegister(payload(tokens.ownerUser.id, 'Objective tanpa treatment', [bad]));
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field.includes('treatment_id'))).toBe(true);
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

  test('Score dan level per cause sesuai matrix', async () => {
    const res = await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer));
    const causes = res.body.data.categories[0].events[0].causes;
    expect(causes).toHaveLength(3);

    const r = causes.find((c) => c.name.startsWith('Rendah'));
    expect(r.inherent).toMatchObject({ score: 1, level: 'Rendah' });

    const m = causes.find((c) => c.name.startsWith('Moderat'));
    expect(m.inherent).toMatchObject({ score: 9, level: 'Moderat' });
    expect(m.after).toMatchObject({ score: 9, level: 'Moderat' });

    const e = causes.find((c) => c.name.startsWith('Ekstrem'));
    expect(e.inherent).toMatchObject({ score: 25, level: 'Ekstrem' });
    expect(e.residual).toMatchObject({ score: 16, level: 'Tinggi' });
  });

  test('Level risk TIDAK boleh diinput manual (field score dihitung sistem)', async () => {
    const res = await api().get(`/api/risk-registers/${registerId}`).set(auth(tokens.officer));
    const c = res.body.data.categories[0].events[0].causes[0];
    expect(c.inherent_score).toBe(c.inherent_likelihood * c.inherent_impact);
    expect(c.residual_score).toBe(c.residual_likelihood * c.residual_impact);
    expect(c.after_score).toBe(c.after_likelihood * c.after_impact);
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

  test('MR TIDAK bisa approve saat masih tahap Owner (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(409); // MR hanya boleh di tahap WAITING_MR_APPROVAL
  });

  test('Owner melihat antrian approvalnya', async () => {
    const res = await api().get('/api/approvals').set(auth(tokens.owner));
    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.id === id)).toBe(true);
  });

  test('Owner approve → WAITING_MR_APPROVAL', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WAITING_MR_APPROVAL');
  });

  test('Approve ganda DITOLAK (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(res.status).toBe(409);
  });

  test('MR approve → APPROVED', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approved_at).toBeTruthy();
  });

  test('MR approve ganda DITOLAK (409)', async () => {
    const res = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(res.status).toBe(409);
  });

  test('Approval history lengkap (submit, approve owner, approve MR)', async () => {
    const res = await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.mr));
    const actions = res.body.data.approvals.map((a) => a.action);
    expect(actions).toEqual(['SUBMIT', 'APPROVE_OWNER', 'APPROVE_MR']);
  });

  test('Register APPROVED tidak bisa diedit lagi', async () => {
    const detail = (await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer))).body.data;
    const body = {
      objective: 'Ubah setelah approve',
      risk_owner_id: detail.risk_owner_id,
      categories: [
        {
          category_id: detail.categories[0].category_id,
          events: [
            {
              name: 'Event',
              causes: [
                {
                  name: 'Cause',
                  inherent: { likelihood: 1, impact: 1 },
                  control: { present: 'ADA', adequacy: 'MEMADAI', implementation: 100 },
                  residual: { likelihood: 1, impact: 1 },
                  treatment_id: detail.categories[0].events[0].causes[0].treatment_id,
                  mitigation_description: 'x',
                  after: { likelihood: 1, impact: 1 },
                },
              ],
            },
          ],
        },
      ],
    };
    const res = await api().put(`/api/risk-registers/${id}`).set(auth(tokens.officer)).send(body);
    expect(res.status).toBe(409);
  });
});

describe('6. Rejection & mitigation history', () => {
  let id = null;

  beforeAll(async () => {
    const res = await createRegister(
      payload(tokens.ownerUser.id, `Rejection flow ${RUN}`, [cause('Mitigasi awal', [4, 4], [3, 3], [3, 3])])
    );
    expect(res.status).toBe(201);
    id = res.body.data.id;
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
            {
              name: cat.events[0].name,
              causes: [
                {
                  ...serializeCause(cat.events[0].causes[0]),
                  mitigation_description:
                    '1. Melakukan analisis dan monitoring biaya secara rutin.\n2. Melakukan negosiasi dengan pemasok untuk harga lebih kompetitif.',
                  after: { likelihood: 2, impact: 2 },
                },
              ],
            },
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
    // Versi 1 tetap menyimpan snapshot mitigasi lama
    const v1 = hist.mitigations.find((m) => m.version === 1);
    expect(JSON.parse(v1.snapshot).items[0].mitigation_description).toContain('Melakukan monitoring');
  });

  test('Resubmit → Owner approve → MR reject → REJECTED_BY_MR', async () => {
    const s1 = await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    expect(s1.status).toBe(200);

    const a1 = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    expect(a1.body.data.status).toBe('WAITING_MR_APPROVAL');

    const rj = await api()
      .post(`/api/approvals/${id}/reject`)
      .set(auth(tokens.mr))
      .send({ reason: 'Residual risk belum sesuai hasil evaluasi.' });
    expect(rj.status).toBe(200);
    expect(rj.body.data.status).toBe('REJECTED_BY_MR');
  });

  test('Perbaikan lagi → Owner approve → MR approve → APPROVED', async () => {
    const detail = (await api().get(`/api/risk-registers/${id}`).set(auth(tokens.officer))).body.data;
    const cat = detail.categories[0];
    const update = {
      objective: detail.objective,
      risk_owner_id: detail.risk_owner_id,
      categories: [
        {
          category_id: cat.category_id,
          events: [
            {
              name: cat.events[0].name,
              causes: [
                {
                  ...serializeCause(cat.events[0].causes[0]),
                  mitigation_description: 'Mitigasi final versi 3 dengan kontrol berkala dan audit internal.',
                  after: { likelihood: 1, impact: 2 },
                },
              ],
            },
          ],
        },
      ],
    };

    const up = await api().put(`/api/risk-registers/${id}`).set(auth(tokens.officer)).send(update);
    expect(up.status).toBe(200);
    expect(up.body.data.current_version).toBe(3);

    await api().post(`/api/risk-registers/${id}/submit`).set(auth(tokens.officer));
    await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.owner));
    const final = await api().post(`/api/approvals/${id}/approve`).set(auth(tokens.mr));
    expect(final.body.data.status).toBe('APPROVED');

    const hist = (await api().get(`/api/risk-registers/${id}/history`).set(auth(tokens.mr))).body.data;
    expect(hist.mitigations).toHaveLength(3);
    const allActions = hist.approvals.map((a) => a.action);
    expect(allActions).toEqual(['SUBMIT', 'REJECT_OWNER', 'SUBMIT', 'APPROVE_OWNER', 'REJECT_MR', 'SUBMIT', 'APPROVE_OWNER', 'APPROVE_MR']);
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

/** Konversi cause detail API -> payload update */
function serializeCause(c) {
  return {
    name: c.name,
    source_id: c.source_id,
    severity_id: c.severity_id,
    severity_description: c.severity_description,
    rp_amount: c.rp_amount,
    inherent: { likelihood: c.inherent_likelihood, impact: c.inherent_impact },
    control: {
      present: c.control_present,
      adequacy: c.control_adequacy,
      implementation: c.control_implementation_pct,
    },
    residual: { likelihood: c.residual_likelihood, impact: c.residual_impact },
    treatment_id: c.treatment_id,
    mitigation_description: c.mitigation_description,
    after: { likelihood: c.after_likelihood, impact: c.after_impact },
  };
}
