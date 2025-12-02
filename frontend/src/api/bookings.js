import axios from './axios';

export const bookingsAPI = {
  createBooking: async (bookingData) => {
    const response = await axios.post('/bookings', bookingData);
    return response.data;
  },

  getMyBookings: async () => {
    const response = await axios.get('/bookings/my');
    return response.data;
  },

  getMyBookingsPaginated: async (skip = 0, limit = 20) => {
    const response = await axios.get('/bookings/my/paginated', {
      params: { skip, limit }
    });
    return response.data;
  },

  getBookingById: async (id) => {
    const response = await axios.get(`/bookings/${id}`);
    return response.data;
  },


  cancelBooking: async (id) => {
    const response = await axios.delete(`/bookings/${id}`);
    return response.data;
  },

};
