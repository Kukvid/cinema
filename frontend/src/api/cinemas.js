import axios from './axios';

export const cinemasAPI = {
  getCinemas: async () => {
    const response = await axios.get('/cinemas');
    return response.data;
  },

  getCinemaById: async (id) => {
    const response = await axios.get(`/cinemas/${id}`);
    return response.data;
  },

  createCinema: async (cinemaData) => {
    const response = await axios.post('/cinemas', cinemaData);
    return response.data;
  },

  updateCinema: async (id, cinemaData) => {
    const response = await axios.put(`/cinemas/${id}`, cinemaData);
    return response.data;
  },

  deleteCinema: async (id) => {
    const response = await axios.delete(`/cinemas/${id}`);
    return response.data;
  },

  getHalls: async (cinemaId) => {
    const response = await axios.get(`/cinemas/${cinemaId}/halls`);
    return response.data;
  },

  createHall: async (cinemaId, hallData) => {
    const response = await axios.post(`/cinemas/${cinemaId}/halls`, hallData);
    return response.data;
  },
};
