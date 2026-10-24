import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động gắn token vào Header nếu có
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('health_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý response lỗi tập trung
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('health_token');
      localStorage.removeItem('health_user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  verifyOtp: async (otpData) => {
    const res = await api.post('/auth/verify-otp', otpData);
    return res.data;
  },
  resendOtp: async (emailData) => {
    const res = await api.post('/auth/resend-otp', emailData);
    return res.data;
  },
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updateProfile: async (profileData) => {
    const res = await api.put('/auth/profile', profileData);
    return res.data;
  },
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await api.post('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};

export const userService = {
  getProfile: async () => {
    const res = await api.get('/users/profile');
    return res.data;
  },
  updateProfile: async (profileData) => {
    const res = await api.put('/users/profile', profileData);
    return res.data;
  },
};

export const healthRecordService = {
  create: async (recordData) => {
    const res = await api.post('/health-records', recordData);
    return res.data;
  },
  getAll: async (params = {}) => {
    // params hỗ trợ: { type: 'BLOOD_PRESSURE', days: 7, days: 30, startDate, endDate }
    const res = await api.get('/health-records', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/health-records/${id}`);
    return res.data;
  },
  update: async (id, recordData) => {
    const res = await api.put(`/health-records/${id}`, recordData);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/health-records/${id}`);
    return res.data;
  },
};

export const familyService = {
  create: async (familyData) => {
    const res = await api.post('/families', familyData);
    return res.data;
  },
  getMyFamilies: async () => {
    const res = await api.get('/families');
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/families/${id}`);
    return res.data;
  },
  inviteMember: async (familyId, email) => {
    const res = await api.post(`/families/${familyId}/invite`, { email });
    return res.data;
  },
};

export const invitationService = {
  getPending: async () => {
    const res = await api.get('/invitations/pending');
    return res.data;
  },
  getByToken: async (token) => {
    const res = await api.get(`/invitations/${token}`);
    return res.data;
  },
  accept: async (token) => {
    const res = await api.post(`/invitations/${token}/accept`);
    return res.data;
  },
  decline: async (token) => {
    const res = await api.post(`/invitations/${token}/decline`);
    return res.data;
  },
};

export const policyService = {
  getPolicies: async (familyId) => {
    const res = await api.get(`/families/${familyId}/policies`);
    return res.data;
  },
  updatePolicies: async (familyId, data) => {
    const res = await api.put(`/families/${familyId}/policies`, data);
    return res.data;
  },
};

export default api;
