import axios from './axios';

// Get all genres
export const getGenres = async () => {
  const response = await axios.get('/genres');
  return response.data;
};

// Get genre by ID
export const getGenre = async (id) => {
  const response = await axios.get(`/genres/${id}`);
  return response.data;
};

// Create new genre (admin only)
export const createGenre = async (genreData) => {
  const response = await axios.post('/genres', genreData);
  return response.data;
};

// Update genre (admin only)
export const updateGenre = async (id, genreData) => {
  const response = await axios.put(`/genres/${id}`, genreData);
  return response.data;
};

// Delete genre (admin only)
export const deleteGenre = async (id) => {
  await axios.delete(`/genres/${id}`);
};
