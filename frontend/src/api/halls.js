import axios from './axios';

export const hallsAPI = {
  getHalls: async () => {
    const response = await axios.get('/halls');
    return response.data;
  },

  getHallById: async (id) => {
    const response = await axios.get(`/halls/${id}`);
    return response.data;
  },

  createHall: async (hallData) => {
    const response = await axios.post('/halls', hallData);
    return response.data;
  },

  updateHall: async (id, hallData) => {
    const response = await axios.put(`/halls/${id}`, hallData);
    return response.data;
  },

  deleteHall: async (id) => {
    const response = await axios.delete(`/halls/${id}`);
    return response.data;
  },

  getHallsWithCinema: async (cinemaId = null) => {
    const params = cinemaId ? { cinema_id: cinemaId } : {};
    const response = await axios.get('/halls/with-cinema', { params });
    return response.data;
  },
};