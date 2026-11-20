const ExcelJS = require('exceljs');
const { query } = require('../../db/pool');
const repo = require('../risk-registers/riskRegister.repository');
const { getLevelByScore } = require('../../utils/riskLevel');
const ApiError = require('../../utils/ApiError');

const LEVEL_COLORS = {
  Rendah: 'FF22C55E',
  Moderat: 'FFEAB308',
  Tinggi: 'FFF97316',
  Ekstrem: 'FFDC2626',
};

const HEADER_BLUE = 'FF1D4ED8';
const SUBHEADER_BLUE = 'FF2563EB';
const GROUP_COLORS = {
  register: 'FFE2E8F0',
  severity: 'FFFFEDD5',
  inherent: 'FFFEF3C7',
  control: 'FFE0F2FE',
  residual: 'FFECFDF5',
  treatment: 'FFF3E8FF',
  after: 'FFFDF2F8',
  pic: 'FFF1F5F9',
};

/** Susunan kolom export sesuai format referensi Risk Register */
const COLUMNS = [
  { group: 'register', title: 'Risk Register', width: 16, key: 'risk_code' },
  { group: 'register', title: 'Objective', width: 30, key: 'objective' },
  { group: 'register', title: 'Risk Category', width: 20, key: 'category' },
  { group: 'register', title: 'Risk Event', width: 30, key: 'event' },
  { group: 'register', title: 'Risk Cause', width: 30, key: 'cause' },
  { group: 'register', title: 'Risk Source', width: 14, key: 'source' },
  { group: 'register', title: 'Unit Kerja / Unit Usaha', width: 24, key: 'work_unit' },

  { group: 'severity', title: 'Description', width: 26, key: 'severity_description' },
  { group: 'severity', title: 'Rp', width: 16, key: 'rp' },

  { group: 'inherent', title: 'Inherent Likelihood', width: 12, key: 'inh_l' },
  { group: 'inherent', title: 'Inherent Impact', width: 12, key: 'inh_i' },
  { group: 'inherent', title: 'Inherent Risk Level', width: 16, key: 'inh_level' },

  { group: 'control', title: 'Existing Control', width: 14, key: 'control_present' },
  { group: 'control', title: 'Control Adequacy', width: 16, key: 'control_adequacy' },
  { group: 'control', title: 'Control Implementation', width: 16, key: 'control_pct' },

  { group: 'residual', title: 'Residual Likelihood', width: 12, key: 'res_l' },
  { group: 'residual', title: 'Residual Impact', width: 12, key: 'res_i' },
  { group: 'residual', title: 'Residual Risk Level', width: 16, key: 'res_level' },

  { group: 'treatment', title: 'Risk Treatment', width: 20, key: 'treatment' },
  { group: 'treatment', title: 'Tindak Lanjut', width: 45, key: 'follow_up' },
  { group: 'treatment', title: 'Status Tindak Lanjut', width: 26, key: 'follow_up_status' },
  { group: 'treatment', title: 'Bukti Dokumen', width: 34, key: 'documents' },

  { group: 'after', title: 'After Mitigation Likelihood', width: 14, key: 'aft_l' },
  { group: 'after', title: 'After Mitigation Impact', width: 14, key: 'aft_i' },
  { group: 'after', title: 'After Mitigation Level', width: 18, key: 'aft_level' },

  { group: 'pic', title: 'Owner', width: 20, key: 'owner' },
  { group: 'pic', title: 'Risk Officer', width: 20, key: 'officer' },
  { group: 'pic', title: 'Branch', width: 24, key: 'branch' },
  { group: 'pic', title: 'Status', width: 24, key: 'status' },
];

const GROUP_LABEL = {
  register: 'RISK REGISTER',
  severity: 'SEVERITY',
  inherent: 'INHERENT RISK',
  control: 'EXISTING CONTROL',
  residual: 'RESIDUAL RISK',
  treatment: 'RISK TREATMENT',
  after: 'RISK AFTER MITIGATION',
  pic: 'PIC & STATUS',
};

const STATUS_LABEL = {
  DRAFT: 'Draft',
  WAITING_OWNER_APPROVAL: 'Waiting Owner Approval',
  REJECTED_BY_OWNER: 'Rejected by Owner',
  WAITING_MR_APPROVAL: 'Waiting MR Approval',
  REJECTED_BY_MR: 'Rejected by MR',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
};

const FOLLOW_UP_STATUS_LABEL = {
  BELUM_MEMADAI: 'Belum Memadai',
  TIDAK_DAPAT_DITINDAKLANJUTI: 'Tidak Dapat Ditindaklanjuti',
  SELESAI: 'Selesai',
};

const buildWhere = (filters) => {
  const where = [];
  const params = [];
  if (filters.year) {
    where.push('rr.year = ?');
    params.push(Number(filters.year));
  }
  if (filters.branch) {
    where.push('rr.branch_id = ?');
    params.push(Number(filters.branch));
  }
  if (filters.status) {
    where.push('rr.status = ?');
    params.push(filters.status);
  }
  if (filters.owner) {
    where.push('rr.risk_owner_id = ?');
    params.push(Number(filters.owner));
  }
  if (filters.officer) {
    where.push('rr.risk_officer_id = ?');
    params.push(Number(filters.officer));
  }
  if (filters.category) {
    where.push('EXISTS (SELECT 1 FROM risk_register_categories c WHERE c.risk_register_id = rr.id AND c.category_id = ?)');
    params.push(Number(filters.category));
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

/** Flatten register -> baris Excel per Risk Cause */

const parseMitigation = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

const flattenRows = async (registers, levels) => {
  const rows = [];
  for (const reg of registers) {
    const nested = await repo.findNested(reg.id);
    const levelOf = (score) => {
      const f = levels.find((l) => score >= l.min_score && score <= l.max_score);
      return f ? f.level : '-';
    };
    for (const cat of nested) {
      for (const ev of cat.events || []) {
        const causes = ev.causes || [];
        const mitItems = parseMitigation(ev.mitigation_items);
        rows.push({
          risk_code: reg.risk_code,
          objective: reg.objective,
          category: cat.category_name,
          event: ev.name,
          cause: causes.length ? causes.map((c) => c.name).join(', ') : '-',
          source: causes.length ? (causes[0].source_name || '-') : '-',
          severity: '-',
          severity_description: causes.length ? (causes[0].severity_description || '-') : '-',
          rp: causes.length ? (causes[0].rp_amount ? Number(causes[0].rp_amount) : null) : null,
          work_unit: causes.length ? (causes[0].work_unit || '-') : '-',
          inh_l: ev.inherent_likelihood,
          inh_i: ev.inherent_impact,
          inh_level: levelOf(ev.inherent_score),
          control_present: ev.control_present,
          control_adequacy: ev.control_adequacy,
          control_pct: ev.control_implementation_pct !== null ? `${ev.control_implementation_pct}%` : null,
          res_l: ev.residual_likelihood,
          res_i: ev.residual_impact,
          res_level: levelOf(ev.residual_score),
          treatment: mitItems.length ? mitItems.map((m) => (typeof m === 'string' ? m : m.description)).join(' | ') : '-',
          follow_up: mitItems.length
            ? (mitItems
                .map((m) => (typeof m === 'string' ? '' : (m.follow_up || '')))
                .filter(Boolean)
                .join(' | ') || '-')
            : '-',
          follow_up_status: mitItems.length
            ? (mitItems
                .map((m) => (typeof m === 'string' ? '' : FOLLOW_UP_STATUS_LABEL[m.follow_up_status] || ''))
                .filter(Boolean)
                .join(' | ') || '-')
            : '-',
          documents: mitItems.length
            ? (mitItems
                .flatMap((m) => (typeof m === 'string' ? [] : m.documents || []))
                .map((d) => d.original_name)
                .join(' | ') || '-')
            : '-',
          aft_l: ev.after_likelihood,
          aft_i: ev.after_impact,
          aft_level: levelOf(ev.after_score),
          owner: reg.owner_name,
          officer: reg.officer_name,
          branch: reg.branch_name,
          status: STATUS_LABEL[reg.status] || reg.status,
        });
      }
    }
  }
  return rows;
};

const exportRiskRegister = async (filters) => {
  const { whereSql, params } = buildWhere(filters);
  const [registers] = await query(
    `SELECT rr.id, rr.risk_code, rr.objective, rr.status,
            b.name AS branch_name, ow.name AS owner_name, of.name AS officer_name
       FROM risk_registers rr
       JOIN branches b ON b.id = rr.branch_id
       JOIN users ow ON ow.id = rr.risk_owner_id
       JOIN users of ON of.id = rr.risk_officer_id
       ${whereSql}
      ORDER BY rr.risk_code ASC`,
    params
  );

  const [levels] = await query('SELECT min_score, max_score, level FROM risk_level_master ORDER BY min_score ASC');
  const dataRows = await flattenRows(registers, levels);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JXB Risk Management System';
  workbook.created = new Date();
  const ws = workbook.addWorksheet('Risk Register', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
  });

  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  const lastCol = COLUMNS.length;
  const startRow = 4;
  const firstDataRow = startRow + 1;

  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'RISK REGISTER — JXB RISK MANAGEMENT SYSTEM';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const filterParts = [];
  if (filters.year) filterParts.push(`Year: ${filters.year}`);
  if (filters.branch) filterParts.push(`Branch id: ${filters.branch}`);
  if (filters.status) filterParts.push(`Status: ${STATUS_LABEL[filters.status] || filters.status}`);
  const infoCell = ws.getCell(2, 1);
  infoCell.value = `Dicetak: ${new Date().toLocaleString('id-ID')}  |  ${filterParts.length ? filterParts.join('  |  ') : 'Semua data'}  |  Total baris: ${dataRows.length}`;
  infoCell.font = { italic: true, size: 10 };
  infoCell.alignment = { horizontal: 'left', vertical: 'middle' };

  let colIdx = 1;
  const groupStarts = [];
  while (colIdx <= lastCol) {
    const group = COLUMNS[colIdx - 1].group;
    let span = 1;
    while (colIdx + span <= lastCol && COLUMNS[colIdx + span - 1].group === group) span++;
    groupStarts.push({ start: colIdx, span, group });
    if (span > 1) ws.mergeCells(3, colIdx, 3, colIdx + span - 1);
    const gCell = ws.getCell(3, colIdx);
    gCell.value = GROUP_LABEL[group];
    gCell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS[group] } };
    gCell.alignment = { horizontal: 'center', vertical: 'middle' };
    gCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    colIdx += span;
  }

  const headerRow = ws.getRow(startRow);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.title;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.height = 34;
  ws.getRow(3).height = 30;

  const border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  dataRows.forEach((row, idx) => {
    const r = ws.getRow(firstDataRow + idx);
    COLUMNS.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      let value = row[c.key];
      if (c.key === 'rp' && value !== null && value !== undefined) {
        cell.numFmt = '#,##0';
      } else if (['inh_l', 'inh_i', 'res_l', 'res_i', 'aft_l', 'aft_i'].includes(c.key)) {
        cell.numFmt = '0';
      }
      cell.value = value === null || value === undefined ? '' : value;
      cell.alignment = {
        horizontal: ['inh_l', 'inh_i', 'res_l', 'res_i', 'aft_l', 'aft_i', 'rp', 'severity', 'control_pct'].includes(c.key)
          ? 'center'
          : 'left',
        vertical: 'top',
        wrapText: ['objective', 'event', 'cause', 'severity_description', 'work_unit', 'follow_up', 'documents'].includes(c.key),
      };
      cell.font = { size: 10 };
      cell.border = border;
    });

    ['inh_level', 'res_level', 'aft_level'].forEach((key) => {
      const col = COLUMNS.findIndex((c) => c.key === key) + 1;
      const cell = r.getCell(col);
      const color = LEVEL_COLORS[cell.value];
      if (color) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        cell.font = { size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  const mergeKeys = ['risk_code', 'objective', 'category', 'event', 'owner', 'officer', 'branch', 'status'];
  mergeKeys.forEach((key) => {
    const col = COLUMNS.findIndex((c) => c.key === key) + 1;
    let runStart = firstDataRow;
    for (let i = 1; i <= dataRows.length; i++) {
      const cur = dataRows[i] ? dataRows[i][key] : null;
      const prev = dataRows[i - 1] ? dataRows[i - 1][key] : null;
      if (i === dataRows.length || cur !== prev) {
        const runLen = i - (runStart - firstDataRow);
        if (runLen > 1) {
          try {
            ws.mergeCells(runStart, col, firstDataRow + i - 1, col);
          } catch (_) {
            /* merge overlap diabaikan */
          }
        }
        const mCell = ws.getCell(runStart, col);
        mCell.alignment = {
          vertical: 'middle',
          horizontal: key === 'status' ? 'center' : 'left',
          wrapText: key === 'objective',
        };
        runStart = firstDataRow + i;
      }
    }
  });

  ws.autoFilter = {
    from: { row: startRow, column: 1 },
    to: { row: startRow, column: lastCol },
  };

  if (!dataRows.length) {
    ws.mergeCells(firstDataRow, 1, firstDataRow, lastCol);
    const empty = ws.getCell(firstDataRow, 1);
    empty.value = 'Tidak ada data untuk filter yang dipilih';
    empty.alignment = { horizontal: 'center' };
    empty.font = { italic: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = { exportRiskRegister };
