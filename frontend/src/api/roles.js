import axios from './axios';

export const rolesAPI = {
  getRoles: async () => {
    const response = await axios.get('/roles');
    return response.data;
  },

  getRoleById: async (id) => {
    const response = await axios.get(`/roles/${id}`);
    return response.data;
  },

  createRole: async (roleData) => {
    const response = await axios.post('/roles', roleData);
    return response.data;
  },

  updateRole: async (id, roleData) => {
    const response = await axios.put(`/roles/${id}`, roleData);
    return response.data;
  },

  deleteRole: async (id) => {
    const response = await axios.delete(`/roles/${id}`);
    return response.data;
  },
};