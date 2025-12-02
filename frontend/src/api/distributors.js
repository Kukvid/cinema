import axios from './axios';

export const distributorsAPI = {
  getDistributors: async () => {
    const response = await axios.get('/distributors');
    return response.data;
  },

  getDistributorById: async (id) => {
    const response = await axios.get(`/distributors/${id}`);
    return response.data;
  },

  createDistributor: async (distributorData) => {
    const response = await axios.post('/distributors', distributorData);
    return response.data;
  },

  updateDistributor: async (id, distributorData) => {
    const response = await axios.put(`/distributors/${id}`, distributorData);
    return response.data;
  },

  deleteDistributor: async (id) => {
    const response = await axios.delete(`/distributors/${id}`);
    return response.data;
  },
};