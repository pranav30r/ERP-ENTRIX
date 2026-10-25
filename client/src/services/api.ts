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

// Auto-login fallback if token is missing
export const ensureAuthenticated = async (): Promise<string> => {
  let token = localStorage.getItem('entrix_token');
  if (!token) {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
      token = res.data.access_token;
      if (token) {
        localStorage.setItem('entrix_token', token);
      }
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
