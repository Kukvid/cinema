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
};