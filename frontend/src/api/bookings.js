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

  getBookingById: async (id) => {
    const response = await axios.get(`/bookings/${id}`);
    return response.data;
  },

  createPayment: async (bookingId, paymentData) => {
    const response = await axios.post(`/bookings/${bookingId}/payment`, paymentData);
    return response.data;
  },

  cancelBooking: async (id) => {
    const response = await axios.delete(`/bookings/${id}`);
    return response.data;
  },

  getMyTickets: async () => {
    const response = await axios.get('/tickets/my');
    return response.data;
  },
};
