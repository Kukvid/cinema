import React, { useState, useEffect, useMemo } from "react";
import {
    Container,
    Grid,
    Typography,
    Box,
    Chip,
    Paper,
    Rating,
    Alert,
    Divider,
    Stack,
    Avatar,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import {
    AccessTime as TimeIcon,
    Public as GlobeIcon,
    CalendarToday as CalendarIcon,
    MovieCreation as DirectorIcon,
    Groups as ActorsIcon,
    Star as StarIcon,
    Hd as HdIcon,
    LocationOn as LocationIcon,
    Phone as PhoneIcon,
    ExpandMore as ExpandMoreIcon,
    TheaterComedy as TheaterIcon,
} from "@mui/icons-material";
import { useParams } from "react-router-dom";
import Loading from "../components/Loading";
import SessionList from "../components/SessionList";
import { filmsAPI } from "../api/films";
import { sessionsAPI } from "../api/sessions";

// Вспомогательный компонент для строки информации
const InfoRow = ({ icon, label, value }) => {
    if (!value) return null;
    return (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
            <Box sx={{ color: "rgba(229, 9, 20, 0.8)", mt: 0.5 }}>{icon}</Box>
            <Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mb: 0.5 }}
                >
                    {label}
                </Typography>
                <Typography
                    variant="body1"
                    color="text.primary"
                >
                    {value}
                </Typography>
            </Box>
        </Box>
    );
};

const FilmDetail = () => {
    const { id } = useParams();
    const [film, setFilm] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadFilmData();
    }, [id]);

    const loadFilmData = async () => {
        try {
            setLoading(true);
            const [filmData, sessionsData] = await Promise.all([
                filmsAPI.getFilmById(id),
                sessionsAPI.getSessionsByFilmId(id),
            ]);
            setFilm(filmData);
            setSessions(sessionsData);
            setError(null);
        } catch (err) {
            console.error("Failed to load film:", err);
            setError("Не удалось загрузить информацию о фильме");
        } finally {
            setLoading(false);
        }
    };

    // Группировка сеансов по кинотеатрам
    const sessionsByCinema = useMemo(() => {
        const grouped = {};

        sessions.forEach((session) => {
            const cinemaId = session.hall?.cinema?.id;
            if (!cinemaId) return;

            if (!grouped[cinemaId]) {
                grouped[cinemaId] = {
                    cinema: session.hall.cinema,
                    sessions: [],
                };
            }

            grouped[cinemaId].sessions.push(session);
        });

        return Object.values(grouped);
    }, [sessions]);

    if (loading) {
        return <Loading message="Загрузка информации о фильме..." />;
    }

    if (error || !film) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{error || "Фильм не найден"}</Alert>
            </Container>
        );
    }

    // Обработка жанров (если массив объектов или строка)
    const renderGenres = () => {
        if (Array.isArray(film.genres)) {
            return film.genres.map((g) => (
                <Chip
                    key={g.id || g.name}
                    label={g.name}
                    variant="outlined"
                    sx={{
                        color: "#e0e0e0",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        "&:hover": {
                            borderColor: "#e50914",
                            bgcolor: "rgba(229, 9, 20, 0.1)",
                        },
                    }}
                />
            ));
        }
        return film.genre ? (
            <Chip
                label={film.genre}
                variant="outlined"
                sx={{ color: "#e0e0e0" }}
            />
        ) : null;
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                pb: 8,
                bgcolor: "#141414",
                color: "#fff",
            }}
        >
            {/* Hero Background */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "70vh",
                    backgroundImage: `url(${film.poster_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                    filter: "blur(60px) brightness(0.3)",
                    zIndex: 0,
                    maskImage:
                        "linear-gradient(to bottom, black 0%, transparent 100%)",
                }}
            />

            <Container
                maxWidth="xl"
                sx={{ position: "relative", zIndex: 2, pt: { xs: 4, md: 8 } }}
            >
                <Grid
                    container
                    spacing={6}
                >
                    {/* Левая колонка: Постер */}
                    <Grid
                        item
                        xs={12}
                        md={4}
                        lg={3}
                    >
                        <Paper
                            elevation={24}
                            sx={{
                                borderRadius: 4,
                                overflow: "hidden",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                boxShadow: "0 0 40px rgba(229, 9, 20, 0.15)",
                                position: "sticky",
                                top: 20,
                            }}
                        >
                            <Box
                                component="img"
                                src={film.poster_url}
                                alt={film.title}
                                sx={{
                                    width: "100%",
                                    display: "block",
                                    aspectRatio: "2/3",
                                    objectFit: "cover",
                                }}
                            />
                        </Paper>
                    </Grid>

                    {/* Правая колонка: Информация */}
                    <Grid
                        item
                        xs={12}
                        md={8}
                        lg={9}
                    >
                        <Box sx={{ mb: 4 }}>
                            {/* Заголовок и оригинальное название */}
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={2}
                                sx={{ mb: 1 }}
                            >
                                <Typography
                                    variant="h2"
                                    sx={{ fontWeight: 800, lineHeight: 1.1 }}
                                >
                                    {film.title}
                                </Typography>
                                {film.age_rating && (
                                    <Chip
                                        label={film.age_rating}
                                        sx={{
                                            fontWeight: 900,
                                            bgcolor: "rgba(255,255,255,0.1)",
                                            color: "#e50914",
                                            border: "1px solid #e50914",
                                            height: 32,
                                        }}
                                    />
                                )}
                            </Stack>

                            <Typography
                                variant="h5"
                                sx={{
                                    color: "text.secondary",
                                    fontWeight: 300,
                                    mb: 3,
                                    fontStyle: "italic",
                                }}
                            >
                                {film.original_title}
                            </Typography>

                            {/* Блок с рейтингами */}
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={3}
                                sx={{ mb: 4, alignItems: { sm: "center" } }}
                            >
                                {/* Внутренний рейтинг */}
                                {film.rating && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <Rating
                                            value={film.rating / 2}
                                            precision={0.1}
                                            readOnly
                                            icon={
                                                <StarIcon
                                                    sx={{ color: "#e50914" }}
                                                />
                                            }
                                            emptyIcon={
                                                <StarIcon
                                                    sx={{ color: "#404040" }}
                                                />
                                            }
                                        />
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 700 }}
                                        >
                                            {film.rating}
                                        </Typography>
                                    </Box>
                                )}

                                <Divider
                                    orientation="vertical"
                                    flexItem
                                    sx={{
                                        bgcolor: "rgba(255,255,255,0.1)",
                                        display: { xs: "none", sm: "block" },
                                    }}
                                />

                                {/* Внешние рейтинги */}
                                <Stack
                                    direction="row"
                                    spacing={2}
                                >
                                    {film.imdb_rating && (
                                        <Box sx={{ textAlign: "center" }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: "#f5c518",
                                                    fontWeight: 900,
                                                    display: "block",
                                                }}
                                            >
                                                IMDb
                                            </Typography>
                                            <Typography
                                                variant="body1"
                                                sx={{ fontWeight: 600 }}
                                            >
                                                {film.imdb_rating}
                                            </Typography>
                                        </Box>
                                    )}
                                    {film.kinopoisk_rating && (
                                        <Box sx={{ textAlign: "center" }}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: "#ff6600",
                                                    fontWeight: 900,
                                                    display: "block",
                                                }}
                                            >
                                                Кинопоиск
                                            </Typography>
                                            <Typography
                                                variant="body1"
                                                sx={{ fontWeight: 600 }}
                                            >
                                                {film.kinopoisk_rating}
                                            </Typography>
                                        </Box>
                                    )}
                                </Stack>
                            </Stack>

                            {/* Жанры */}
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    flexWrap: "wrap",
                                    mb: 4,
                                }}
                            >
                                {renderGenres()}
                            </Box>

                            {/* Основное описание */}
                            <Typography
                                variant="body1"
                                sx={{
                                    fontSize: "1.1rem",
                                    lineHeight: 1.8,
                                    color: "#d1d1d1",
                                    mb: 5,
                                }}
                            >
                                {film.description}
                            </Typography>

                            {/* Детальная информация (Grid) */}
                            <Grid
                                container
                                spacing={4}
                                sx={{ mb: 5 }}
                            >
                                <Grid
                                    item
                                    xs={12}
                                    sm={6}
                                >
                                    <InfoRow
                                        icon={<DirectorIcon />}
                                        label="Режиссер"
                                        value={film.director}
                                    />
                                    <InfoRow
                                        icon={<GlobeIcon />}
                                        label="Страна"
                                        value={film.country}
                                    />
                                    <InfoRow
                                        icon={<CalendarIcon />}
                                        label="Год выпуска"
                                        value={film.release_year}
                                    />
                                </Grid>
                                <Grid
                                    item
                                    xs={12}
                                    sm={6}
                                >
                                    <InfoRow
                                        icon={<ActorsIcon />}
                                        label="В главных ролях"
                                        value={film.actors}
                                    />
                                    <InfoRow
                                        icon={<TimeIcon />}
                                        label="Продолжительность"
                                        value={
                                            film.duration_minutes
                                                ? `${film.duration_minutes} мин.`
                                                : null
                                        }
                                    />
                                </Grid>
                            </Grid>

                            {/* Трейлер */}
                            {film.trailer_url && (
                                <Box sx={{ mb: 6 }}>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            mb: 2,
                                            fontWeight: 700,
                                            borderLeft: "4px solid #e50914",
                                            pl: 2,
                                        }}
                                    >
                                        Трейлер
                                    </Typography>
                                    <Box
                                        sx={{
                                            position: "relative",
                                            paddingBottom: "56.25%",
                                            height: 0,
                                            overflow: "hidden",
                                            borderRadius: 3,
                                            bgcolor: "#000",
                                            boxShadow:
                                                "0 4px 20px rgba(0,0,0,0.5)",
                                        }}
                                    >
                                        <iframe
                                            src={film.trailer_url}
                                            title="Trailer"
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "100%",
                                                height: "100%",
                                                border: 0,
                                            }}
                                            allowFullScreen
                                        />
                                    </Box>
                                </Box>
                            )}

                            {/* Расписание сеансов по кинотеатрам */}
                            <Box>
                                <Typography
                                    variant="h5"
                                    sx={{
                                        mb: 3,
                                        fontWeight: 700,
                                        borderLeft: "4px solid #e50914",
                                        pl: 2,
                                    }}
                                >
                                    Расписание сеансов
                                </Typography>

                                {sessionsByCinema.length > 0 ? (
                                    <Stack spacing={3}>
                                        {sessionsByCinema.map(
                                            ({
                                                cinema,
                                                sessions: cinemaSessions,
                                            }) => (
                                                <Accordion
                                                    key={cinema.id}
                                                    sx={{
                                                        bgcolor:
                                                            "rgba(255,255,255,0.05)",
                                                        backdropFilter:
                                                            "blur(10px)",
                                                        borderRadius:
                                                            "12px !important",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        "&:before": {
                                                            display: "none",
                                                        },
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <AccordionSummary
                                                        expandIcon={
                                                            <ExpandMoreIcon
                                                                sx={{
                                                                    color: "#e50914",
                                                                }}
                                                            />
                                                        }
                                                        sx={{
                                                            "&:hover": {
                                                                bgcolor:
                                                                    "rgba(229, 9, 20, 0.05)",
                                                            },
                                                            transition:
                                                                "background-color 0.3s",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "flex-start",
                                                                gap: 2,
                                                                width: "100%",
                                                                pr: 2,
                                                            }}
                                                        >
                                                            <TheaterIcon
                                                                sx={{
                                                                    color: "#e50914",
                                                                    fontSize: 32,
                                                                    mt: 0.5,
                                                                }}
                                                            />
                                                            <Box
                                                                sx={{ flex: 1 }}
                                                            >
                                                                <Typography
                                                                    variant="h6"
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        mb: 0.5,
                                                                        color: "#fff",
                                                                    }}
                                                                >
                                                                    {
                                                                        cinema.name
                                                                    }
                                                                </Typography>
                                                                <Stack
                                                                    direction={{
                                                                        xs: "column",
                                                                        sm: "row",
                                                                    }}
                                                                    spacing={{
                                                                        xs: 0.5,
                                                                        sm: 3,
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            display:
                                                                                "flex",
                                                                            alignItems:
                                                                                "center",
                                                                            gap: 0.5,
                                                                        }}
                                                                    >
                                                                        <LocationIcon
                                                                            sx={{
                                                                                fontSize: 16,
                                                                                color: "text.secondary",
                                                                            }}
                                                                        />
                                                                        <Typography
                                                                            variant="body2"
                                                                            color="text.secondary"
                                                                        >
                                                                            {
                                                                                cinema.city
                                                                            }
                                                                            ,{" "}
                                                                            {
                                                                                cinema.address
                                                                            }
                                                                        </Typography>
                                                                    </Box>
                                                                    {cinema.phone && (
                                                                        <Box
                                                                            sx={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap: 0.5,
                                                                            }}
                                                                        >
                                                                            <PhoneIcon
                                                                                sx={{
                                                                                    fontSize: 16,
                                                                                    color: "text.secondary",
                                                                                }}
                                                                            />
                                                                            <Typography
                                                                                variant="body2"
                                                                                color="text.secondary"
                                                                            >
                                                                                {
                                                                                    cinema.phone
                                                                                }
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                </Stack>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        color: "#e50914",
                                                                        fontWeight: 600,
                                                                        mt: 0.5,
                                                                        display:
                                                                            "block",
                                                                    }}
                                                                >
                                                                    {
                                                                        cinemaSessions.length
                                                                    }{" "}
                                                                    {cinemaSessions.length ===
                                                                    1
                                                                        ? "сеанс"
                                                                        : "сеансов"}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </AccordionSummary>
                                                    <AccordionDetails
                                                        sx={{ pt: 0 }}
                                                    >
                                                        <Divider
                                                            sx={{
                                                                mb: 2,
                                                                bgcolor:
                                                                    "rgba(255,255,255,0.1)",
                                                            }}
                                                        />
                                                        <SessionList
                                                            sessions={
                                                                cinemaSessions
                                                            }
                                                        />
                                                    </AccordionDetails>
                                                </Accordion>
                                            )
                                        )}
                                    </Stack>
                                ) : (
                                    <Paper
                                        sx={{
                                            p: 4,
                                            textAlign: "center",
                                            bgcolor: "rgba(255,255,255,0.05)",
                                            borderRadius: 2,
                                        }}
                                    >
                                        <Typography color="text.secondary">
                                            На данный момент сеансов нет
                                        </Typography>
                                    </Paper>
                                )}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default FilmDetail;
