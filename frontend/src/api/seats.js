import axios from './axios';

export const seatsAPI = {
  getSeats: async () => {
    const response = await axios.get('/seats');
    return response.data;
  },

  getSeatById: async (id) => {
    const response = await axios.get(`/seats/${id}`);
    return response.data;
  },

  createSeat: async (seatData) => {
    const response = await axios.post('/seats', seatData);
    return response.data;
  },

  updateSeat: async (id, seatData) => {
    const response = await axios.put(`/seats/${id}`, seatData);
    return response.data;
  },

  deleteSeat: async (id) => {
    const response = await axios.delete(`/seats/${id}`);
    return response.data;
  },

  getSeatsByHall: async (hallId) => {
    const response = await axios.get(`/halls/${hallId}/seats`);
    return response.data;
  },
};