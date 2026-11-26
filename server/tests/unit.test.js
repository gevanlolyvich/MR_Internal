/**
 * Test tanpa database: permission matrix, status, util.
 * Jalankan: npm run test:unit
 */
process.env.NODE_ENV = 'test';

const { PERMISSIONS, ROLES, hasPermission } = require('../src/config/roles');
const {
  STATUS,
  EDITABLE_STATUS,
  OWNER_PENDING,
  MR_PENDING,
  ALL_STATUS,
  FOLLOW_UP_DONE,
  FOLLOW_UP_RETURN,
} = require('../src/config/status');
const { calcScore } = require('../src/utils/riskLevel');
const { parsePagination } = require('../src/utils/pagination');
const ApiError = require('../src/utils/ApiError');

describe('Permission matrix', () => {
  test('Risk Officer TIDAK boleh approve', () => {
    expect(hasPermission(ROLES.RISK_OFFICER, 'approval:owner')).toBe(false);
    expect(hasPermission(ROLES.RISK_OFFICER, 'approval:mr')).toBe(false);
  });

  test('Risk Owner TIDAK boleh edit/create risk register', () => {
    expect(hasPermission(ROLES.RISK_OWNER, 'risk-register:edit')).toBe(false);
    expect(hasPermission(ROLES.RISK_OWNER, 'risk-register:create')).toBe(false);
    expect(hasPermission(ROLES.RISK_OWNER, 'risk-register:submit')).toBe(false);
    expect(hasPermission(ROLES.RISK_OWNER, 'risk-register:view')).toBe(true);
    expect(hasPermission(ROLES.RISK_OWNER, 'approval:owner')).toBe(true);
  });

  test('MR memiliki akses penuh (dashboard, master, user, branch, matrix, monitoring, export, audit)', () => {
    [
      'dashboard:view',
      'risk-register:view',
      'approval:mr',
      'user:manage',
      'branch:manage',
      'master:manage',
      'matrix:view',
      'monitoring:view',
      'export:run',
      'audit:view',
    ].forEach((p) => expect(hasPermission(ROLES.MR, p)).toBe(true));
  });

  test('MR TIDAK membuat/mengedit risk register (read-only untuk data officer)', () => {
    expect(hasPermission(ROLES.MR, 'risk-register:create')).toBe(false);
    expect(hasPermission(ROLES.MR, 'risk-register:edit')).toBe(false);
    expect(hasPermission(ROLES.MR, 'risk-register:submit')).toBe(false);
  });

  test('Risk Officer dapat create/edit/submit', () => {
    expect(hasPermission(ROLES.RISK_OFFICER, 'risk-register:create')).toBe(true);
    expect(hasPermission(ROLES.RISK_OFFICER, 'risk-register:edit')).toBe(true);
    expect(hasPermission(ROLES.RISK_OFFICER, 'risk-register:submit')).toBe(true);
  });

  test('Role tidak dikenal tidak punya permission', () => {
    expect(hasPermission('HACKER', 'dashboard:view')).toBe(false);
  });

  test('Setiap role punya permission list', () => {
    Object.values(ROLES).forEach((r) => expect(PERMISSIONS[r].length).toBeGreaterThan(0));
  });
});

describe('Status system (terpusat)', () => {
  test('Status sesuai spesifikasi workflow', () => {
    expect(Object.keys(STATUS)).toEqual(
      expect.arrayContaining([
        'DRAFT',
        'WAITING_OWNER_APPROVAL',
        'REJECTED_BY_OWNER',
        'WAITING_MR_APPROVAL',
        'REJECTED_BY_MR',
        'APPROVED',
        'ARCHIVED',
        'WAITING_MR_INSTRUCTION',
        'WAITING_OFFICER_FOLLOWUP',
      ])
    );
  });

  test('Hanya DRAFT dan REJECTED_* yang dapat diedit Risk Officer', () => {
    expect(EDITABLE_STATUS).toEqual([STATUS.DRAFT, STATUS.REJECTED_BY_OWNER, STATUS.REJECTED_BY_MR]);
  });

  test('Antrian approval owner & MR berbeda', () => {
    expect(OWNER_PENDING).toEqual([STATUS.WAITING_OWNER_APPROVAL]);
    expect(MR_PENDING).toEqual([STATUS.WAITING_MR_INSTRUCTION, STATUS.WAITING_MR_APPROVAL]);
    expect(ALL_STATUS.length).toBe(9);
  });

  test('Penilaian MR: SELESAI menutup item, sisanya dikembalikan ke Officer', () => {
    expect(FOLLOW_UP_DONE).toBe('SELESAI');
    expect(FOLLOW_UP_RETURN).toEqual(['BELUM_MEMADAI', 'TIDAK_DAPAT_DITINDAKLANJUTI']);
  });
});

describe('Risk calculation (Score = Likelihood x Impact)', () => {
  test('1 x 1 = 1', () => expect(calcScore(1, 1)).toBe(1));
  test('3 x 3 = 9', () => expect(calcScore(3, 3)).toBe(9));
  test('5 x 5 = 25', () => expect(calcScore(5, 5)).toBe(25));
  test('string angka dari input form tetap dihitung', () => expect(calcScore('4', '3')).toBe(12));
});

describe('Pagination', () => {
  test('default dan batas', () => {
    expect(parsePagination({}, 15, 100)).toEqual({ page: 1, limit: 15, offset: 0 });
    expect(parsePagination({ page: '3', limit: '10' }, 15, 100)).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(parsePagination({ limit: '9999' }, 15, 100).limit).toBe(100);
    expect(parsePagination({ page: '-5' }, 15, 100).page).toBe(1);
  });
});

describe('ApiError', () => {
  test('helper status code', () => {
    expect(ApiError.badRequest().statusCode).toBe(400);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.conflict().statusCode).toBe(409);
  });
});
