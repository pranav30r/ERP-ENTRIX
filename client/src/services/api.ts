import axios from 'axios';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
export const AI_BASE_URL = (import.meta as any).env?.VITE_AI_BASE_URL || 'http://localhost:8008/api/v1/ml';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auto-attach JWT Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('entrix_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getCurrentUser = () => {
  const raw = localStorage.getItem('entrix_user');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // Ignore
    }
  }
  return {
    email: 'admin@entrix.local',
    first_name: 'Aditya',
    last_name: 'Admin',
    role: 'SUPER_ADMIN'
  };
};

// Login with specific demo role
export const loginAsUser = async (email: string, password = 'Admin@123') => {
  const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
  if (res.data.success && res.data.access_token) {
    localStorage.setItem('entrix_token', res.data.access_token);
    if (res.data.refresh_token) {
      localStorage.setItem('entrix_refresh_token', res.data.refresh_token);
    }
    localStorage.setItem('entrix_user', JSON.stringify(res.data.user));
    return res.data;
  }
  throw new Error('Authentication failed');
};

// Refresh access token securely
export const refreshSession = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('entrix_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken
    });
    if (res.data.success && res.data.access_token) {
      localStorage.setItem('entrix_token', res.data.access_token);
      if (res.data.refresh_token) {
        localStorage.setItem('entrix_refresh_token', res.data.refresh_token);
      }
      return res.data.access_token;
    }
  } catch (err) {
    localStorage.removeItem('entrix_token');
    localStorage.removeItem('entrix_refresh_token');
  }
  return null;
};

// Auto-login fallback if token is missing
export const ensureAuthenticated = async (): Promise<string> => {
  let token = localStorage.getItem('entrix_token');
  if (!token) {
    // Attempt refresh first
    token = await refreshSession();
  }
  if (!token) {
    try {
      const data = await loginAsUser('admin@entrix.local', 'Admin@123');
      token = data.access_token;
    } catch (err) {
      console.error('Failed to auto-authenticate with demo credentials:', err);
    }
  }
  return token || '';
};

// Auto-refresh and retry on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshedToken = await refreshSession();
      if (refreshedToken) {
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return apiClient(originalRequest);
      }
      // Fallback auto-auth for demo persona
      const fallbackToken = await ensureAuthenticated();
      if (fallbackToken) {
        originalRequest.headers.Authorization = `Bearer ${fallbackToken}`;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
