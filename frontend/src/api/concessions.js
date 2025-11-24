import axios from './axios';

export const concessionsAPI = {
  getConcessionItems: async () => {
    const response = await axios.get('/concessions');
    return response.data;
  },

  getConcessionItemById: async (id) => {
    const response = await axios.get(`/concessions/${id}`);
    return response.data;
  },

  createConcessionItem: async (itemData) => {
    const response = await axios.post('/concessions', itemData);
    return response.data;
  },

  updateConcessionItem: async (id, itemData) => {
    const response = await axios.put(`/concessions/${id}`, itemData);
    return response.data;
  },

  deleteConcessionItem: async (id) => {
    const response = await axios.delete(`/concessions/${id}`);
    return response.data;
  },
};
