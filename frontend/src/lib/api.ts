import axios from 'axios';

const api = axios.create({
  baseURL: typeof window !== 'undefined' 
    ? `http://${window.location.hostname}:3001/api` 
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'),
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

/**
 * Fix asset URLs that still point to localhost:3001.
 * Replaces with the current browser hostname so images load correctly in any environment.
 */
export function fixUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof window === 'undefined') return url;
  if (!url.includes('/assets/file/')) return url;

  // Derive the backend origin based on current browser's location hostname
  const backendHost = `${window.location.hostname}:3001`;

  // Dynamically replace any hardcoded backend asset URLs with the browser's current host
  return url.replace(/(https?:\/\/[^\/]+?)(?:\/api)?\/assets\/file\//g, (match) => {
    const hasApi = match.includes('/api');
    return `http://${backendHost}${hasApi ? '/api' : ''}/assets/file/`;
  });
}

export interface Screen {
  id: string;
  name: string;
  orientation: 'LANDSCAPE' | 'PORTRAIT' | 'LANDSCAPE_43' | 'PORTRAIT_34';
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string;
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  lastSnapshotUrl: string | null;
  snapshotAt: string | null;
  systemInfo: Record<string, unknown> | null;
  customBgUrl: string | null;
  spotifyEnable: boolean;
  spotifyUrl: string | null;
}

export interface ScreenCommand {
  id: string;
  screenId: string;
  type: 'RELOAD' | 'SNAPSHOT' | 'CLEAR_CACHE';
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'WIDGET' | 'WEB' | 'YOUTUBE' | 'MARQUEE' | 'CAMPAIGN' | 'ANNOUNCEMENT';
  url: string;
  thumbnailUrl?: string;
  orientation: 'LANDSCAPE' | 'PORTRAIT' | 'LANDSCAPE_43' | 'PORTRAIT_34';
  width?: number | null;
  height?: number | null;
  duration?: number;
  size: string;
  tags?: string[];
  fixedDuration?: boolean;
}

