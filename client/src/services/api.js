import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// System Health
export const getHealth = () => api.get('/health').then((r) => r.data);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats').then((r) => r.data);

// AI Voice Agent
export const sendAIChat = (payload) => api.post('/ai/chat', payload).then((r) => r.data);
export const qualifyLead = (payload) => api.post('/ai/qualify-lead', payload).then((r) => r.data);
export const summarizeCall = (payload) => api.post('/ai/summarize-call', payload).then((r) => r.data);

// Leads CRM
export const getLeads = (params) => api.get('/leads', { params }).then((r) => r.data);
export const getLeadById = (id) => api.get(`/leads/${id}`).then((r) => r.data);
export const createLead = (data) => api.post('/leads', data).then((r) => r.data);
export const updateLead = (id, data) => api.put(`/leads/${id}`, data).then((r) => r.data);

// Calls
export const saveCall = (payload) => api.post('/calls', payload).then((r) => r.data);
export const getCalls = () => api.get('/calls').then((r) => r.data);
export const getCallById = (id) => api.get(`/calls/${id}`).then((r) => r.data);

// Knowledge Base (Moderate RAG)
export const uploadKnowledgeFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api
    .post('/knowledge/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};
export const getKnowledgeDocs = () => api.get('/knowledge').then((r) => r.data);
export const deleteKnowledgeDoc = (id) => api.delete(`/knowledge/${id}`).then((r) => r.data);

// Appointments
export const getAppointments = (date) =>
  api.get('/appointments', { params: { date } }).then((r) => r.data);
export const createAppointment = (payload) =>
  api.post('/appointments', payload).then((r) => r.data);
export const updateAppointment = (id, payload) =>
  api.put(`/appointments/${id}`, payload).then((r) => r.data);

export default api;
