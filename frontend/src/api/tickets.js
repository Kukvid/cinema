import axios from './axios';

export const ticketsAPI = {
  getMyTickets: async (skip = 0, limit = 10, status = null) => {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);
    if (status) {
      params.append('status', status);
    }
    
    const response = await axios.get(`/tickets/my?${params.toString()}`);
    return response.data;
  },

  getMyTicketsCount: async (status = null) => {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }
    
    const response = await axios.get(`/tickets/my/count?${params.toString()}`);
    return response.data;
  },

  getTicketById: async (id) => {
    const response = await axios.get(`/tickets/${id}`);
    return response.data;
  },

  validateTicket: async (qrCode) => {
    const response = await axios.post('/tickets/validate', { qr_code: qrCode });
    return response.data;
  },

  markTicketAsUsed: async (ticketId) => {
    const response = await axios.post(`/tickets/${ticketId}/use`);
    return response.data;
  },
};