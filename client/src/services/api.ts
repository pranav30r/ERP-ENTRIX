import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5000/api/v1';
export const AI_BASE_URL = 'http://localhost:8008/api/v1/ml';

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
    localStorage.setItem('entrix_user', JSON.stringify(res.data.user));
    return res.data;
  }
  throw new Error('Authentication failed');
};

// Auto-login fallback if token is missing
export const ensureAuthenticated = async (): Promise<string> => {
  let token = localStorage.getItem('entrix_token');
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

// Auto-reauthenticate on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('entrix_token');
      const newToken = await ensureAuthenticated();
      if (newToken && error.config) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios(error.config);
      }
    }
    return Promise.reject(error);
  }
);
