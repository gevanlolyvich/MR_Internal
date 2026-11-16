import clsx from 'clsx';
import { STATUS_LABEL, STATUS_COLOR, RISK_LEVEL_COLORS } from '../../constants';

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span
      className={clsx(
        'inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        STATUS_COLOR[status] || 'bg-slate-100 text-slate-600 border-slate-300'
      )}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function LevelBadge({ level, score, showScore = true }) {
  if (!level) return <span className="text-xs text-slate-400">-</span>;
  const color = RISK_LEVEL_COLORS[level] || '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {level}
      {showScore && score !== undefined && score !== null && (
        <span className="font-medium opacity-90">({score})</span>
      )}
    </span>
  );
}

export function ToleranceBadge({ status }) {
  if (!status) return null;
  const within = status === 'Within Risk Tolerance';
  return (
    <span
      className={clsx(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        within ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'
      )}
    >
      {status}
    </span>
  );
}
