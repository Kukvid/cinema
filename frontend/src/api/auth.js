import axios from "./axios";

export const authAPI = {
    register: async (userData) => {
        const response = await axios.post("/auth/register", userData);
        return response.data;
    },

    login: async (credentials) => {
        const response = await axios.post(
            "/auth/login",
            new URLSearchParams({
                username: credentials.email,
                password: credentials.password,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await axios.get("/auth/me");
        return response.data;
    },

    updateProfile: async (userData) => {
        const response = await axios.put("/auth/me", userData);
        return response.data;
    },

    refreshToken: async (refreshToken) => {
        const response = await axios.post("/auth/refresh", {
            refresh_token: refreshToken
        });
        return response.data;
    },
};
