import axios from "./axios";

export const filmsAPI = {
    getFilms: async (params = {}) => {
      const response = await axios.get('/films', { params });
      return response.data;
    },

    getFilmById: async (id) => {
        const response = await axios.get(`/films/${id}`);
        return response.data;
    },

    createFilm: async (filmData) => {
        const response = await axios.post("/films", filmData);
        return response.data;
    },

    updateFilm: async (id, filmData) => {
        const response = await axios.put(`/films/${id}`, filmData);
        return response.data;
    },

    deleteFilm: async (id) => {
        const response = await axios.delete(`/films/${id}`);
        return response.data;
    },

    uploadPoster: async (id, file) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await axios.post(`/films/${id}/poster`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },

    getFilmsWithActiveContracts: async (cinemaId) => {
        const response = await axios.get(`/films/cinema/${cinemaId}/with-contracts`);
        return response.data;
    },
};
