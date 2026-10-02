import axios from 'axios';

// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:5000.
// In production, set VITE_API_URL to your deployed backend's URL.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on an authenticated request means the token expired or was
// rejected — without this, the user just sees random failed requests with
// no idea why. Clear the stale session and send them back to the right
// login page with an explanation, instead of a silent/confusing failure.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && sessionStorage.getItem('token')) {
      const wasAdmin = sessionStorage.getItem('role') === 'admin';
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      sessionStorage.setItem('sessionExpiredMessage', 'Your session expired. Please log in again.');
      window.location.href = wasAdmin ? '/admin/login' : '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
