import axios from './axios';

export const qrScannerAPI = {
  validateTicket: async (qrCode) => {
    const response = await axios.post('/qr-scanner/ticket/validate', { qr_code: qrCode });
    return response.data;
  },

  validateConcession: async (qrCode) => {
    const response = await axios.post('/qr-scanner/concession/validate', { qr_code: qrCode });
    return response.data;
  },
};