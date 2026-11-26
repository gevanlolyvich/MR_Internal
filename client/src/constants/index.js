
export const STATUS = {
  DRAFT: 'DRAFT',
  WAITING_OWNER_APPROVAL: 'WAITING_OWNER_APPROVAL',
  REJECTED_BY_OWNER: 'REJECTED_BY_OWNER',
  WAITING_MR_INSTRUCTION: 'WAITING_MR_INSTRUCTION',
  WAITING_OFFICER_FOLLOWUP: 'WAITING_OFFICER_FOLLOWUP',
  WAITING_MR_APPROVAL: 'WAITING_MR_APPROVAL',
  REJECTED_BY_MR: 'REJECTED_BY_MR',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
};

export const STATUS_LABEL = {
  DRAFT: 'Draft',
  WAITING_OWNER_APPROVAL: 'Menunggu Approval Owner',
  REJECTED_BY_OWNER: 'Dikembalikan Owner',
  WAITING_MR_INSTRUCTION: 'Menunggu Instruksi MR',
  WAITING_OFFICER_FOLLOWUP: 'Menunggu Tindak Lanjut Officer',
  WAITING_MR_APPROVAL: 'Menunggu Penilaian MR',
  REJECTED_BY_MR: 'Dikembalikan MR',
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
  WAITING_MR_INSTRUCTION: 'bg-violet-50 text-violet-700 border-violet-300',
  WAITING_OFFICER_FOLLOWUP: 'bg-cyan-50 text-cyan-700 border-cyan-300',
};

export const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Disusun Officer', statuses: ['DRAFT'] },
  { key: 'owner', label: 'Approval Owner', statuses: ['WAITING_OWNER_APPROVAL'] },
  { key: 'instruction', label: 'Instruksi MR', statuses: ['WAITING_MR_INSTRUCTION'] },
  { key: 'realization', label: 'Tindak Lanjut Officer', statuses: ['WAITING_OFFICER_FOLLOWUP'] },
  { key: 'final', label: 'Penilaian MR', statuses: ['WAITING_MR_APPROVAL', 'APPROVED'] },
];

export const FOLLOW_UP_STATUS = {
  BELUM_MEMADAI: 'BELUM_MEMADAI',
  TIDAK_DAPAT_DITINDAKLANJUTI: 'TIDAK_DAPAT_DITINDAKLANJUTI',
  SELESAI: 'SELESAI',
};

export const FOLLOW_UP_STATUS_LABEL = {
  BELUM_MEMADAI: 'Belum Sesuai',
  TIDAK_DAPAT_DITINDAKLANJUTI: 'Belum Ditindaklanjuti',
  SELESAI: 'Sesuai / Selesai',
};

export const FOLLOW_UP_STATUS_OPTIONS = Object.entries(FOLLOW_UP_STATUS_LABEL).map(([value, label]) => ({ value, label }));
export const FOLLOW_UP_DONE = FOLLOW_UP_STATUS.SELESAI;
export const FOLLOW_UP_RETURN = [FOLLOW_UP_STATUS.BELUM_MEMADAI, FOLLOW_UP_STATUS.TIDAK_DAPAT_DITINDAKLANJUTI];

export const REJECTED_STATUSES = ['REJECTED_BY_OWNER', 'REJECTED_BY_MR'];

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
  { no: '04', key: 'inherent', title: 'Inherent Risk' },
  { no: '05', key: 'control', title: 'Existing Control' },
  { no: '06', key: 'residual', title: 'Residual Risk' },
  { no: '07', key: 'treatment', title: 'Risk Treatment' },
  { no: '08', key: 'after', title: 'Risk After Mitigation' },
  { no: '09', key: 'review', title: 'Review & Submit' },
];
