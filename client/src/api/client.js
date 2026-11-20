import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
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

export const downloadDocument = async (registerId, docId, fileName) => {
  const res = await api.get(`/risk-registers/${registerId}/documents/${docId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName || 'dokumen');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
