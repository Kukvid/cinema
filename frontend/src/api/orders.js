import axios from "./axios";

export const ordersAPI = {
    getOrders: async (params = {}) => {
        const response = await axios.get("/orders", { params });
        return response.data;
    },

    getOrderById: async (id) => {
        const response = await axios.get(`/orders/${id}`);
        return response.data;
    },

    createOrder: async (orderData) => {
        const response = await axios.post("/orders", orderData);
        return response.data;
    },

    updateOrder: async (id, orderData) => {
        const response = await axios.put(`/orders/${id}`, orderData);
        return response.data;
    },

    deleteOrder: async (id) => {
        const response = await axios.delete(`/orders/${id}`);
        return response.data;
    },

    cancelOrder: async (id) => {
        const response = await axios.post(`/orders/${id}/cancel`);
        return response.data;
    },

    getMyOrdersCounts: async () => {
        const response = await axios.get("/bookings/my/counts");
        return response.data;
    },

    getMyActiveOrders: async (skip = 0, limit = 10) => {
        const params = { skip, limit };
        const response = await axios.get("/bookings/my/active", { params });
        return response.data;
    },

    getMyPastOrders: async (skip = 0, limit = 10) => {
        const params = { skip, limit };
        const response = await axios.get("/bookings/my/past", { params });
        return response.data;
    },

    getMyActiveOrdersCount: async () => {
        const response = await axios.get("/bookings/my/active/count");
        return response.data;
    },

    getMyPastOrdersCount: async () => {
        const response = await axios.get("/bookings/my/past/count");
        return response.data;
    },

    getOrderDetails: async (id) => {
        const response = await axios.get(`/payments/${id}/details`);
        return response.data;
    },

    getOrderByQR: async (qrCode) => {
        const response = await axios.get(`/orders/qr/${encodeURIComponent(qrCode)}`);
        return response.data;
    },

    getOrdersByPickupCode: async (pickupCode) => {
        const response = await axios.get(`/orders/pickup/${encodeURIComponent(pickupCode)}`);
        return response.data;
    },

    markConcessionItemAsCompleted: async (preorderId) => {
        const response = await axios.post(`/concessions/concession_preorders/${preorderId}/complete`);
        return response.data;
    },

    updateOrderStatus: async (orderId, status) => {
        const response = await axios.patch(`/orders/${orderId}/status`, { status });
        return response.data;
    },
};
