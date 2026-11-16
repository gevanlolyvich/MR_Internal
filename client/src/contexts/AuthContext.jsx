import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('jxb_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('jxb_user', JSON.stringify(user));
    else localStorage.removeItem('jxb_user');
  }, [user]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, user: u, permissions } = res.data.data;
      localStorage.setItem('jxb_token', token);
      setUser({ ...u, permissions });
      return { ok: true, user: u };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('jxb_token');
    localStorage.removeItem('jxb_user');
    setUser(null);
  };

  const can = (permission) => !!user?.permissions?.includes(permission);

  const value = useMemo(
    () => ({ user, loading, login, logout, can, isAuthenticated: !!user }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
