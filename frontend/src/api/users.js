import axios from './axios';

export const usersAPI = {
  getUsers: async () => {
    const response = await axios.get('/users');
    return response.data;
  },

  getUserById: async (id) => {
    const response = await axios.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await axios.post('/users', userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await axios.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await axios.delete(`/users/${id}`);
    return response.data;
  },

  changeUserRole: async (id, roleId) => {
    const response = await axios.patch(`/users/${id}/role`, { role_id: roleId });
    return response.data;
  },

  blockUser: async (id) => {
    const response = await axios.patch(`/users/${id}/block`);
    return response.data;
  },

  unblockUser: async (id) => {
    const response = await axios.patch(`/users/${id}/unblock`);
    return response.data;
  },
};