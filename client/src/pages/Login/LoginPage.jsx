import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { parseError } from '../../api/client';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await login(username, password);
      toast.success(`Selamat datang, ${res.user.name}`);
      navigate('/dashboard');
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      if (parsed.details?.length) {
        setError(parsed.details.map((d) => d.message).join('; '));
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-jxb-red text-lg font-black text-white">
            JXB
          </div>
          <h1 className="text-2xl font-bold text-white">Risk Management System</h1>
          <p className="mt-1 text-sm text-blue-200">Risk Register · Approval · Monitoring</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          <p className="text-center text-xs text-slate-400">
            Lihat README untuk akun demo (seed data).
          </p>
        </form>
      </div>
    </div>
  );
}
