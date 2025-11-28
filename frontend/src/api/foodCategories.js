import axios from './axios';

// Get all food categories
export const getFoodCategories = async (params = {}) => {
  const response = await axios.get('/food-categories', { params });
  return response.data;
};

// Get single food category
export const getFoodCategory = async (id) => {
  const response = await axios.get(`/food-categories/${id}`);
  return response.data;
};

// Create food category
export const createFoodCategory = async (categoryData) => {
  const response = await axios.post('/food-categories', categoryData);
  return response.data;
};

// Update food category
export const updateFoodCategory = async (id, categoryData) => {
  const response = await axios.put(`/food-categories/${id}`, categoryData);
  return response.data;
};

// Delete food category
export const deleteFoodCategory = async (id) => {
  const response = await axios.delete(`/food-categories/${id}`);
  return response.data;
};
