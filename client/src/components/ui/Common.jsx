import { useState } from 'react';
import clsx from 'clsx';

export function Card({ children, className = '' }) {
  return <div className={clsx('card', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      <span className="text-sm">{label || 'Memuat...'}</span>
    </div>
  );
}

export function EmptyState({ title = 'Belum ada data', description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-3l-2 2H9l-2-2H4" />
      </svg>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition',
            active === t.key
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function CollapsibleSection({ no, title, children, defaultOpen = false, invalid = false, open: controlledOpen, onToggle }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = () => {
    if (onToggle) onToggle();
    else setInternalOpen((o) => !o);
  };
  return (
    <div className={clsx('card mb-4 overflow-hidden', invalid && 'border-red-300')}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-primary-700 text-xs font-bold text-white">
            {no}
          </span>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {invalid && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Belum lengkap</span>}
        </span>
        <svg
          className={clsx('h-5 w-5 text-slate-400 transition-transform', open && 'rotate-180')}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}

export function Field({ label, required, error, children, hint }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-jxb-red">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-jxb-red">{error}</p>}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-500">
      <span>
        Halaman {page} dari {pages} · {total} data
      </span>
      <div className="flex gap-1">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Sebelumnya
        </button>
        <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Berikutnya
        </button>
      </div>
    </div>
  );
}
