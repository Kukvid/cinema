import axios from './axios';

export const ordersAPI = {
  getOrders: async (params = {}) => {
    const response = await axios.get('/orders', { params });
    return response.data;
  },

  getOrderById: async (id) => {
    const response = await axios.get(`/orders/${id}`);
    return response.data;
  },

  createOrder: async (orderData) => {
    const response = await axios.post('/orders', orderData);
    return response.data;
  },

  updateOrder: async (id, orderData) => {
    const response = await axios.put(`/orders/${id}`, orderData);
    return response.data;
  },

  deleteOrder: async (id) => {
    const response = await axios.delete(`/orders/${id}`);
    return response.data;
  },

  cancelOrder: async (id) => {
    const response = await axios.post(`/orders/${id}/cancel`);
    return response.data;
  },
};