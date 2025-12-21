import axios from "./axios";

export const concessionsAPI = {
    getConcessionItems: async (params = {}) => {
        const response = await axios.get("/concessions", { params });
        return response.data;
    },

    getPublicConcessionItems: async (params = {}) => {
        // Don't use the default axios instance to avoid triggering auth redirect
        const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';
        const url = new URL(`${baseUrl}/concessions/public`);

        // Add params to URL
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    },

    getConcessionItemById: async (id) => {
        const response = await axios.get(`/concessions/${id}`);
        return response.data;
    },

    createConcessionItem: async (itemData) => {
        const response = await axios.post("/concessions", itemData);
        return response.data;
    },

    updateConcessionItem: async (id, itemData) => {
        const response = await axios.put(`/concessions/${id}`, itemData);
        return response.data;
    },

    deleteConcessionItem: async (id) => {
        const response = await axios.delete(`/concessions/${id}`);
        return response.data;
    },

    createPreorder: async (preorderData) => {
        const response = await axios.post("/concessions/preorder", preorderData);
        return response.data;
    },

    createPreorderBatch: async (preorderDataList) => {
        const response = await axios.post("/concessions/preorder-batch", preorderDataList);
        return response.data;
    },

    getAvailableCinemas: async () => {
        const response = await axios.get('/contracts/cinemas');
        return response.data;
    },
};
