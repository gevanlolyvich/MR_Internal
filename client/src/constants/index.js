// Konstanta status — sinkron dengan backend src/config/status.js

export const STATUS = {
  DRAFT: 'DRAFT',
  WAITING_OWNER_APPROVAL: 'WAITING_OWNER_APPROVAL',
  REJECTED_BY_OWNER: 'REJECTED_BY_OWNER',
  WAITING_MR_APPROVAL: 'WAITING_MR_APPROVAL',
  REJECTED_BY_MR: 'REJECTED_BY_MR',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
};

export const STATUS_LABEL = {
  DRAFT: 'Draft',
  WAITING_OWNER_APPROVAL: 'Menunggu Approval Owner',
  REJECTED_BY_OWNER: 'Ditolak Owner',
  WAITING_MR_APPROVAL: 'Menunggu Approval MR',
  REJECTED_BY_MR: 'Ditolak MR',
  APPROVED: 'Disetujui',
  ARCHIVED: 'Diarsipkan',
};

export const STATUS_COLOR = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  WAITING_OWNER_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-300',
  REJECTED_BY_OWNER: 'bg-red-50 text-red-700 border-red-300',
  WAITING_MR_APPROVAL: 'bg-blue-50 text-blue-700 border-blue-300',
  REJECTED_BY_MR: 'bg-red-50 text-red-700 border-red-300',
  APPROVED: 'bg-green-50 text-green-700 border-green-300',
  ARCHIVED: 'bg-slate-200 text-slate-600 border-slate-300',
};

export const ROLES = {
  MR: 'MR',
  RISK_OFFICER: 'RISK_OFFICER',
  RISK_OWNER: 'RISK_OWNER',
};

export const ROLE_LABEL = {
  MR: 'Manajemen Risiko',
  RISK_OFFICER: 'Risk Officer',
  RISK_OWNER: 'Risk Owner',
};

export const RISK_LEVEL_COLORS = {
  Rendah: '#22c55e',
  Moderat: '#eab308',
  Tinggi: '#f97316',
  Ekstrem: '#dc2626',
};

export const SECTIONS = [
  { no: '01', key: 'objective', title: 'Objective & Owner' },
  { no: '02', key: 'identification', title: 'Risk Identification' },
  { no: '03', key: 'cause', title: 'Risk Cause & Source' },
  { no: '04', key: 'severity', title: 'Severity' },
  { no: '05', key: 'inherent', title: 'Inherent Risk' },
  { no: '06', key: 'control', title: 'Existing Control' },
  { no: '07', key: 'residual', title: 'Residual Risk' },
  { no: '08', key: 'treatment', title: 'Risk Treatment' },
  { no: '09', key: 'after', title: 'Risk After Mitigation' },
  { no: '10', key: 'review', title: 'Review & Submit' },
];
