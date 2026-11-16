const ROLES = Object.freeze({
  MR: 'MR',
  RISK_OFFICER: 'RISK_OFFICER',
  RISK_OWNER: 'RISK_OWNER',
});

const ALL_ROLES = Object.values(ROLES);

/**
 * Role -> daftar permission yang diizinkan.
 * Dipakai middleware authorize(...permissions).
 */
const PERMISSIONS = Object.freeze({
  [ROLES.MR]: [
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
  ],
  [ROLES.RISK_OFFICER]: [
    'dashboard:view',
    'risk-register:view',
    'risk-register:create',
    'risk-register:edit',
    'risk-register:submit',
  ],
  [ROLES.RISK_OWNER]: ['dashboard:view', 'risk-register:view', 'approval:owner'],
});

const hasPermission = (role, permission) =>
  Array.isArray(PERMISSIONS[role]) && PERMISSIONS[role].includes(permission);

module.exports = { ROLES, ALL_ROLES, PERMISSIONS, hasPermission };
