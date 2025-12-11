import React, { useState, useEffect } from "react";
import { addMinutes } from "date-fns";
import {
    Container,
    Typography,
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Alert,
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Event as EventIcon,
} from "@mui/icons-material";
import { format, parseISO } from "date-fns";
import Loading from "../../components/Loading";
import { sessionsAPI } from "../../api/sessions";
import { filmsAPI } from "../../api/films";
import { cinemasAPI } from "../../api/cinemas";
import { useForm } from "react-hook-form";

const SessionsManage = () => {
    const [sessions, setSessions] = useState([]);
    const [films, setFilms] = useState([]);
    const [cinemas, setCinemas] = useState([]);
    const [halls, setHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [endDateTime, setEndDateTime] = useState("");

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm();

    const selectedCinemaId = watch("cinema_id");
    const selectedFilmId = watch("film_id");
    const startDateTime = watch("start_datetime");

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedCinemaId) {
            loadHalls(selectedCinemaId);
        }
    }, [selectedCinemaId]);

    // Calculate end datetime when start datetime or selected film changes
    useEffect(() => {
        if (startDateTime && selectedFilmId) {
            const selectedFilm = films.find(film => film.id === parseInt(selectedFilmId));
            if (selectedFilm && selectedFilm.duration_minutes) {
                const startDate = new Date(startDateTime);
                const endDate = addMinutes(startDate, selectedFilm.duration_minutes);
                // Format to datetime-local input format (YYYY-MM-DDTHH:mm)
                const formattedEndDate = endDate.toISOString().slice(0, 16);
                setEndDateTime(formattedEndDate);
            }
        }
    }, [startDateTime, selectedFilmId, films]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [sessionsData, filmsData, cinemasData] = await Promise.all([
                sessionsAPI.getSessions(),
                filmsAPI.getFilms(),
                cinemasAPI.getCinemas(),
            ]);
            setSessions(sessionsData);
            setFilms(filmsData.items || filmsData);  // Handle both paginated and non-paginated responses
            setCinemas(cinemasData);
            setError(null);
        } catch (err) {
            setError("Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    };

    const loadHalls = async (cinemaId) => {
        try {
            const hallsData = await cinemasAPI.getHalls(cinemaId);
            setHalls(hallsData);
        } catch (err) {
            console.error("Failed to load halls:", err);
        }
    };

    const handleOpenDialog = (session = null) => {
        setEditingSession(session);
        if (session) {
            reset({
                film_id: session.film_id,
                hall_id: session.hall_id,
                cinema_id: session.hall?.cinema_id,
                start_datetime: session.start_datetime?.split(".")[0],
                base_price: session.base_price,
            });
            // Calculate end datetime for editing
            if (session.start_datetime && session.film?.duration_minutes) {
                const startDate = new Date(session.start_datetime.split(".")[0]);
                const endDate = addMinutes(startDate, session.film.duration_minutes);
                const formattedEndDate = endDate.toISOString().slice(0, 16);
                setEndDateTime(formattedEndDate);
            }
            if (session.hall?.cinema_id) {
                loadHalls(session.hall.cinema_id);
            }
        } else {
            reset({
                film_id: "",
                hall_id: "",
                cinema_id: "",
                start_datetime: "",
                base_price: 300,
            });
            setEndDateTime("");
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingSession(null);
        reset();
    };

    const onSubmit = async (data) => {
        try {
            setFormLoading(true);
            const sessionData = {
                film_id: parseInt(data.film_id),
                hall_id: parseInt(data.hall_id),
                start_datetime: data.start_datetime,
                base_price: parseFloat(data.base_price),
            };

            if (editingSession) {
                await sessionsAPI.updateSession(editingSession.id, sessionData);
            } else {
                await sessionsAPI.createSession(sessionData);
            }

            await loadData();
            handleCloseDialog();
        } catch (err) {
            setError("Не удалось сохранить сеанс");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Удалить сеанс?")) {
            try {
                await sessionsAPI.deleteSession(id);
                await loadData();
            } catch (err) {
                setError("Не удалось удалить сеанс");
            }
        }
    };

    const formatDate = (dateString) => {
        try {
            return format(parseISO(dateString), "dd.MM.yyyy HH:mm");
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return <Loading message="Загрузка сеансов..." />;
    }

    return (
        <Container
            maxWidth="xl"
            sx={{ py: 6 }}
        >
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 4,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        background:
                            "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Управление сеансами
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                        background:
                            "linear-gradient(135deg, #e50914 0%, #b00710 100%)",
                    }}
                >
                    Добавить сеанс
                </Button>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                >
                    {error}
                </Alert>
            )}

            <TableContainer
                component={Paper}
                sx={{
                    background:
                        "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                    border: "1px solid rgba(229, 9, 20, 0.2)",
                }}
            >
                <Table>
                    <TableHead>
                        <TableRow sx={{ background: "rgba(229, 9, 20, 0.1)" }}>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Фильм
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Кинотеатр
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Зал</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                Время
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Цена</TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontWeight: 600 }}
                            >
                                Действия
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sessions.map((session) => (
                            <TableRow
                                key={session.id}
                                hover
                            >
                                <TableCell>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <EventIcon sx={{ color: "#e50914" }} />
                                        {session.film?.title}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    {session.hall?.cinema?.name}
                                </TableCell>
                                <TableCell>{session.hall?.name}</TableCell>
                                <TableCell>
                                    {formatDate(session.start_datetime)}
                                </TableCell>
                                <TableCell>{session.base_price} ₽</TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        onClick={() =>
                                            handleOpenDialog(session)
                                        }
                                        color="primary"
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        onClick={() => handleDelete(session.id)}
                                        color="error"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editingSession ? "Редактировать сеанс" : "Добавить сеанс"}
                </DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        <TextField
                            fullWidth
                            select
                            label="Фильм"
                            margin="normal"
                            {...register("film_id", {
                                required: "Фильм обязателен",
                            })}
                            error={!!errors.film_id}
                            helperText={errors.film_id?.message}
                        >
                            {films.map((film) => (
                                <MenuItem
                                    key={film.id}
                                    value={film.id}
                                >
                                    {film.title}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            select
                            label="Кинотеатр"
                            margin="normal"
                            {...register("cinema_id", {
                                required: "Кинотеатр обязателен",
                            })}
                            error={!!errors.cinema_id}
                            helperText={errors.cinema_id?.message}
                        >
                            {cinemas.map((cinema) => (
                                <MenuItem
                                    key={cinema.id}
                                    value={cinema.id}
                                >
                                    {cinema.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            select
                            label="Зал"
                            margin="normal"
                            {...register("hall_id", {
                                required: "Зал обязателен",
                            })}
                            error={!!errors.hall_id}
                            helperText={errors.hall_id?.message}
                            disabled={!selectedCinemaId}
                        >
                            {halls.map((hall) => (
                                <MenuItem
                                    key={hall.id}
                                    value={hall.id}
                                >
                                    {hall.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            label="Время начала"
                            type="datetime-local"
                            margin="normal"
                            InputLabelProps={{ shrink: true }}
                            {...register("start_datetime", {
                                required: "Время обязательно",
                            })}
                            error={!!errors.start_datetime}
                            helperText={errors.start_datetime?.message}
                        />

                        <TextField
                            fullWidth
                            label="Время окончания"
                            type="datetime-local"
                            margin="normal"
                            InputLabelProps={{ shrink: true }}
                            value={endDateTime}
                            InputProps={{
                                readOnly: true, // Make it read-only since it's calculated automatically
                            }}
                            disabled // Disable editing since it's auto-calculated
                        />

                        <TextField
                            fullWidth
                            label="Базовая цена"
                            type="number"
                            margin="normal"
                            inputProps={{ step: 50, min: 0 }}
                            {...register("base_price", {
                                required: "Цена обязательна",
                            })}
                            error={!!errors.base_price}
                            helperText={errors.base_price?.message}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Отмена</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={formLoading}
                        >
                            {formLoading ? "Сохранение..." : "Сохранить"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Container>
    );
};

export default SessionsManage;
