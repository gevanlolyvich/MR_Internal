import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jxb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jxb_token');
      localStorage.removeItem('jxb_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Normalisasi error backend menjadi { message, details } */
export const parseError = (err) => {
  const data = err.response?.data;
  if (data) return { message: data.message || 'Terjadi kesalahan', details: data.details || null };
  return { message: err.message || 'Tidak dapat terhubung ke server', details: null };
};

export default api;
