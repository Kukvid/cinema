import axios from './axios';

export const reportsAPI = {
  getReports: async () => {
    const response = await axios.get('/reports');
    return response.data;
  },

  getReportById: async (id) => {
    const response = await axios.get(`/reports/${id}`);
    return response.data;
  },

  generateReport: async (reportData) => {
    const response = await axios.post('/reports/generate', reportData);
    return response.data;
  },

  downloadReport: async (id, format='xlsx') => {
    const response = await axios.get(`/reports/${id}/download`, { responseType: 'blob' });
    // Download the file
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report-${id}.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    return response.data;
  },

  viewReport: async (id) => {
    const response = await axios.get(`/reports/${id}/view`);
    return response.data;
  },

  getReports: async () => {
    const response = await axios.get('/reports');
    return response.data;
  },

  getReportById: async (id) => {
    const response = await axios.get(`/reports/${id}`);
    return response.data;
  },

  generateReport: async (reportData) => {
    const response = await axios.post('/reports/generate', reportData);
    return response.data;
  },

  downloadReport: async (id) => {
    const response = await axios.get(`/reports/${id}/download`, { responseType: 'blob' });
    // Download the file
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report-${id}.${reportData.format || 'pdf'}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    return response.data;
  },

  viewReport: async (id) => {
    const response = await axios.get(`/reports/${id}/view`);
    return response.data;
  },

  getPaymentHistory: async () => {
    const response = await axios.get('/payments/history');
    return response.data;
  },
};