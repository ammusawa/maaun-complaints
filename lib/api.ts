import axios from 'axios';

// Use same-origin /api to leverage Next.js proxy - avoids CORS stripping Authorization header
const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Let browser set Content-Type with boundary for FormData
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (err) => Promise.reject(err));

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Don't redirect on 401 from login itself - let the login page show the error
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && typeof window !== 'undefined' && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (data: { email: string; password: string; full_name: string; matric_number?: string; department?: string; role?: string }) =>
    api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
};

async function createWithRetry(formData: FormData, maxRetries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await api.post('/api/complaints', formData);
      return res;
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

export const complaintsApi = {
  list: (params?: { status?: string; category?: string; skip?: number; limit?: number }) =>
    api.get('/api/complaints', { params }),
  analytics: (params?: { submitter_id?: number; category?: string; feedback_type?: string; department?: string; status?: string }) =>
    api.get('/api/complaints/analytics', { params }),
  get: (id: number) => api.get(`/api/complaints/${id}`),
  track: (ticketNumber: string) => api.get('/api/complaints/track', { params: { ticket_number: ticketNumber } }),
  create: (formData: FormData) => createWithRetry(formData),
  update: (id: number, data: {
    status?: string;
    assigned_to_id?: number;
    priority?: number;
    audit_feedback?: string;
    maintenance_report?: string;
    invoice_amount?: number;
    invoice_notes?: string;
    invoice_items?: { item: string; cost: number; quantity: number }[];
  }) => api.patch(`/api/complaints/${id}`, data),
  addResponse: (id: number, data: { message: string; is_internal?: boolean }) =>
    api.post(`/api/complaints/${id}/responses`, data),
  stats: () => api.get('/api/complaints/stats'),
};

export const usersApi = {
  list: (params?: { role?: string; include_inactive?: boolean; limit?: number }) =>
    api.get('/api/users', { params }),
  create: (data: { email: string; password: string; full_name: string; matric_number?: string; department?: string; role?: string }) =>
    api.post('/api/users', data),
  update: (id: number, data: { is_active?: boolean; role?: string; full_name?: string; department?: string }) =>
    api.patch(`/api/users/${id}`, data),
};

export const notificationsApi = {
  list: (limit?: number) => api.get('/api/notifications', { params: { limit: limit ?? 50 } }),
  unreadCount: () => api.get<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: number) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/mark-all-read'),
};

export const CATEGORIES = [
  'academic', 'facilities', 'hostel', 'class', 'auditorium', 'security', 'finance',
  'library', 'transport', 'cafeteria', 'ict', 'other'
] as const;

export const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected'] as const;
export const FEEDBACK_TYPES = ['complaint', 'suggestion', 'commendation'] as const;
