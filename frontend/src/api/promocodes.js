import axios from './axios';

// Validate promocode
export const validatePromocode = async (code, orderAmount, category = null) => {
  const response = await axios.post('/promocodes/validate', {
    code,
    order_amount: orderAmount,
    category,
  });
  return response.data;
};

// Get all promocodes (admin only)
export const getPromocodes = async (params = {}) => {
  const response = await axios.get('/promocodes', { params });
  return response.data;
};

// Create promocode (admin only)
export const createPromocode = async (promocodeData) => {
  const response = await axios.post('/promocodes', promocodeData);
  return response.data;
};

// Update promocode (admin only)
export const updatePromocode = async (id, promocodeData) => {
  const response = await axios.put(`/promocodes/${id}`, promocodeData);
  return response.data;
};

// Delete promocode (admin only)
export const deletePromocode = async (id) => {
  const response = await axios.delete(`/promocodes/${id}`);
  return response.data;
};
