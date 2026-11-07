import axios, { AxiosRequestConfig, CanceledError } from 'axios';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
export const AI_BASE_URL = (import.meta as any).env?.VITE_AI_BASE_URL || 'http://localhost:8008/api/v1/ml';

export { CanceledError };

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

// In-flight GET request deduplication
const inFlightRequests = new Map<string, Promise<any>>();

function getRequestKey(url: string, params?: any): string {
  return `GET:${url}:${params ? JSON.stringify(params) : ''}`;
}

const originalGet = apiClient.get.bind(apiClient);
apiClient.get = ((url: string, config?: AxiosRequestConfig) => {
  const key = getRequestKey(url, config?.params);
  if (!config?.signal && inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = originalGet(url, config).finally(() => {
    inFlightRequests.delete(key);
  });

  if (!config?.signal) {
    inFlightRequests.set(key, promise);
  }
  return promise;
}) as typeof apiClient.get;

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

export interface OnboardPayload {
  company_name: string;
  slug: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
}

export const onboardNewCompany = async (payload: OnboardPayload) => {
  const res = await axios.post(`${API_BASE_URL}/tenants/onboard`, payload);
  if (res.data.success && res.data.access_token) {
    localStorage.setItem('entrix_token', res.data.access_token);
    if (res.data.refresh_token) {
      localStorage.setItem('entrix_refresh_token', res.data.refresh_token);
    }
    localStorage.setItem('entrix_user', JSON.stringify(res.data.user));
    return res.data;
  }
  throw new Error(res.data.error || 'Onboarding failed');
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
