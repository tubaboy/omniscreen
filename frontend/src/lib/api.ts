import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('cms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path !== '/login') {
        localStorage.removeItem('cms_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export interface Screen {
  id: string;
  name: string;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'WIDGET';
  url: string;
  thumbnailUrl?: string;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  duration?: number;
  size: string;
  tags?: string[];
}
