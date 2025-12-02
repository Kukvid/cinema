import axios from './axios';

export const sessionsAPI = {
  getSessions: async () => {
    const response = await axios.get('/sessions');
    return response.data;
  },

  getSessionById: async (id) => {
    const response = await axios.get(`/sessions/${id}`);
    return response.data;
  },

  getSessionSeats: async (id) => {
    const response = await axios.get(`/sessions/${id}/seats`);
    return response.data;
  },

  createSession: async (sessionData) => {
    const response = await axios.post('/sessions', sessionData);
    return response.data;
  },

  updateSession: async (id, sessionData) => {
    const response = await axios.put(`/sessions/${id}`, sessionData);
    return response.data;
  },

  deleteSession: async (id) => {
    const response = await axios.delete(`/sessions/${id}`);
    return response.data;
  },
};