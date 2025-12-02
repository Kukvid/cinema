import axios from './axios';

export const genresAPI = {
  getGenres: async () => {
    const response = await axios.get('/genres');
    return response.data;
  },

  getGenreById: async (id) => {
    const response = await axios.get(`/genres/${id}`);
    return response.data;
  },

  createGenre: async (genreData) => {
    const response = await axios.post('/genres', genreData);
    return response.data;
  },

  updateGenre: async (id, genreData) => {
    const response = await axios.put(`/genres/${id}`, genreData);
    return response.data;
  },

  deleteGenre: async (id) => {
    const response = await axios.delete(`/genres/${id}`);
    return response.data;
  },
};