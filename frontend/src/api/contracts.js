import axios from './axios';

export const contractsAPI = {
  getContracts: async () => {
    const response = await axios.get('/contracts');
    return response.data;
  },

  getContractById: async (id) => {
    const response = await axios.get(`/contracts/${id}`);
    return response.data;
  },

  createContract: async (contractData) => {
    const response = await axios.post('/contracts', contractData);
    return response.data;
  },

  updateContract: async (id, contractData) => {
    const response = await axios.put(`/contracts/${id}`, contractData);
    return response.data;
  },

  deleteContract: async (id) => {
    const response = await axios.delete(`/contracts/${id}`);
    return response.data;
  },
};