import axios from './axios';

export const contractsAPI = {
  // Get all contracts
  getContracts: async (params = {}) => {
    const response = await axios.get('/contracts', { params });
    return response.data;
  },

  // Get contract by ID
  getContractById: async (id) => {
    const response = await axios.get(`/contracts/${id}`);
    return response.data;
  },

  // Create new contract
  createContract: async (contractData) => {
    const response = await axios.post('/contracts', contractData);
    return response.data;
  },

  // Update contract
  updateContract: async (id, contractData) => {
    const response = await axios.put(`/contracts/${id}`, contractData);
    return response.data;
  },

  // Delete contract
  deleteContract: async (id) => {
    const response = await axios.delete(`/contracts/${id}`);
    return response.data;
  },

  // Get payments for a contract
  getContractPayments: async (contractId) => {
    const response = await axios.get(`/contracts/${contractId}/payments`);
    return response.data;
  },

  // Get available cinemas based on user role
  getAvailableCinemas: async () => {
    const response = await axios.get('/contracts/cinemas');
    return response.data;
  },

  // Mark a payment as paid
  markPaymentAsPaid: async (contractId, paymentId) => {
    const response = await axios.post(`/contracts/${contractId}/payments/${paymentId}/pay`);
    return response.data;
  },

  // Get pending payments with optional cinema filter
  getPendingPayments: async (cinemaId = null) => {
    const params = cinemaId ? { cinema_id: cinemaId } : {};
    const response = await axios.get('/contracts/payments/pending', { params });
    return response.data;
  },

  // Pay a specific contract payment globally
  payContractPayment: async (paymentId) => {
    const response = await axios.post(`/contracts/payments/${paymentId}/pay`);
    return response.data;
  },
};