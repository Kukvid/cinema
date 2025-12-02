import axios from './axios';

export const paymentsAPI = {
  processPayment: async (orderId, paymentData) => {
    const response = await axios.post(`/payments/${orderId}/process`, paymentData);
    return response.data;
  },

  getPaymentStatus: async (orderId) => {
    const response = await axios.get(`/payments/${orderId}/status`);
    return response.data;
  },

  getPaymentDetails: async (orderId) => {
    const response = await axios.get(`/payments/${orderId}/details`);
    return response.data;
  },

  getPaymentHistory: async (params = {}) => {
    const response = await axios.get('/payments/history', { params });
    return response.data;
  },
};