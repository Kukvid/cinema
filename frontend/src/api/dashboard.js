import axios from './axios';

export const dashboardAPI = {
    getDashboardStats: async () => {
        const response = await axios.get('/dashboard/stats');
        return response.data;
    },
};