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
      // Chỉ xóa token nếu không phải là route verify-pin công khai
      if (!error.config?.url?.includes('/shares/') || !error.config?.url?.includes('/verify-pin')) {
        localStorage.removeItem('health_token');
        localStorage.removeItem('health_user');
      }
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
  getMemberHealthOverview: async (familyId, memberId) => {
    const res = await api.get(`/families/${familyId}/members/${memberId}/health-overview`);
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

export const aiService = {
  summarizeTrends: async (targetUserIdOrParams = {}, familyId) => {
    let payload = {};
    if (typeof targetUserIdOrParams === 'object' && targetUserIdOrParams !== null) {
      payload = { ...targetUserIdOrParams };
      if (payload.memberId && !payload.targetUserId) payload.targetUserId = payload.memberId;
      if (payload.targetUserId && !payload.memberId) payload.memberId = payload.targetUserId;
    } else {
      if (targetUserIdOrParams) {
        payload.targetUserId = targetUserIdOrParams;
        payload.memberId = targetUserIdOrParams;
      }
      if (familyId) payload.familyId = familyId;
    }
    const res = await api.post('/ai/summarize-trends', payload);
    return res.data;
  },
};

// Sprint 5: Notifications & Critical Alerts (SCRUM-63)
export const notificationService = {
  getAll: async () => {
    const res = await api.get('/notifications');
    return res.data;
  },
  getUnreadCount: async () => {
    const res = await api.get('/notifications/unread-count');
    return res.data;
  },
  markAsRead: async (id) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },
  markAllAsRead: async () => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
  },
};

// Sprint 5: Medication & Health Reminders (SCRUM-67 / SCRUM-68)
export const reminderService = {
  getAll: async () => {
    const res = await api.get('/reminders');
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/reminders', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/reminders/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/reminders/${id}`);
    return res.data;
  },
  toggle: async (id, date) => {
    const res = await api.post(`/reminders/${id}/toggle`, { date });
    return res.data;
  },
  getStats: async () => {
    const res = await api.get('/reminders/stats');
    return res.data;
  },
};

// Sprint 6: Secure Doctor Share Links (SCRUM-74 / SCRUM-75)
export const doctorShareService = {
  createLink: async (data) => {
    const res = await api.post('/shares/create-doctor-link', data);
    return res.data;
  },
  getMyLinks: async () => {
    const res = await api.get('/shares/my-links');
    return res.data;
  },
  revokeLink: async (token) => {
    const res = await api.delete(`/shares/${token}`);
    return res.data;
  },
  verifyPin: async (token, pin) => {
    const res = await api.post(`/shares/${token}/verify-pin`, { pin });
    return res.data;
  },
};

// Sprint 6: Streaks & Gamification Badges (SCRUM-85 / SCRUM-86)
export const streakService = {
  getMyStreak: async () => {
    const res = await api.get('/streaks');
    return res.data;
  },
};

export default api;
