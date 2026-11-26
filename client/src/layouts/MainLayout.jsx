import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

const MENU = [
  { to: '/dashboard', label: 'Dashboard', perm: 'dashboard:view', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10' },
  { to: '/risk-registers', label: 'Risk Register', perm: 'risk-register:view', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/follow-ups', label: 'Tindak Lanjut', roles: ['MR', 'RISK_OFFICER'], icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/approvals', label: 'Approval', perm: 'approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', badge: 'approval' },
  { to: '/users', label: 'User Management', perm: 'user:manage', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/branches', label: 'Branch Management', perm: 'branch:manage', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { to: '/masters', label: 'Master Data', perm: 'master:manage', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
  { to: '/matrix', label: 'Matrix', perm: 'matrix:view', icon: 'M3 5h8v8H3V5zm10 0h8v8h-8V5zM3 14h8v6H3v-6zm10 0h8v6h-8v-6z' },
  { to: '/monitoring', label: 'Monitoring', perm: 'monitoring:view', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/audit', label: 'History / Audit Trail', perm: 'audit:view', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function Icon({ d, className }) {
  return (
    <svg className={clsx('h-5 w-5 shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.data || []);
      setUnread(res.data.unread || 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  const onItemClick = async (n) => {
    await api.post(`/notifications/${n.id}/read`);
    setOpen(false);
    load();
    if (n.risk_register_id) navigate(`/risk-registers/${n.risk_register_id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifikasi"
      >
        <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-jxb-red px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">Notifikasi</span>
            <button onClick={markAll} className="text-xs font-semibold text-primary-700 hover:underline">
              Tandai semua dibaca
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!items.length && <p className="px-3 py-6 text-center text-xs text-slate-400">Belum ada notifikasi</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
                className={clsx(
                  'block w-full border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50',
                  !n.is_read && 'bg-primary-50/60'
                )}
              >
                <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Date(n.created_at).toLocaleString('id-ID')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowed = (item) => {
    if (item.roles) return item.roles.includes(user?.role);
    if (item.perm === 'approval') return can('approval:owner');
    return can(item.perm);
  };

  const onExport = async () => {
    try {
      const res = await api.get('/export/risk-register', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Risk-Register-${new Date().getFullYear()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col bg-primary-900 text-white transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-jxb-red text-sm font-black">JXB</div>
          <div>
            <p className="text-sm font-bold leading-tight">Risk Management</p>
            <p className="text-[11px] text-blue-200">Sistem Manajemen Risiko</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {MENU.filter(allowed).map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <Icon d={m.icon} />
              <span>{m.label}</span>
            </NavLink>
          ))}
          {can('export:run') && (
            <button
              onClick={onExport}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-blue-100 transition hover:bg-white/10 hover:text-white"
            >
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              <span>Export Excel</span>
            </button>
          )}
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-blue-200">
          {user?.branch_name || '-'}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Menu"
            >
              <Icon d="M4 6h16M4 12h16M4 18h16" />
            </button>
            <div className="hidden text-sm text-slate-500 sm:block">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Notifications />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">{user?.name}</p>
              <p className="text-[11px] text-slate-500">{user?.role?.replace('_', ' ')}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-jxb-red"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
