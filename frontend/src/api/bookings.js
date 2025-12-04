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


  cancelPendingOrder: async (id) => {
    const response = await axios.post(`/bookings/${id}/cancel`);
    return response.data;
  },

  returnOrder: async (id) => {
    const response = await axios.post(`/bookings/${id}/return`);
    return response.data;
  },

};
