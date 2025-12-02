import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Container,
    Grid,
    Typography,
    Box,
    TextField,
    MenuItem,
    Chip,
    Paper,
    Alert,
    Button,
    CircularProgress,
    Select,
    InputLabel,
    FormControl,
    OutlinedInput,
    ListItemText,
    ListItemIcon,
    Checkbox,
    InputAdornment,
} from "@mui/material";
import {
    MovieFilter as MovieIcon,
    Clear as ClearIcon,
    Search as SearchIcon,
} from "@mui/icons-material";
import FilmCard from "../components/FilmCard";
import Loading from "../components/Loading";
import { filmsAPI } from "../api/films";
import { genresAPI } from "../api/genres";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};

const Home = () => {
    const [films, setFilms] = useState([]);
    const [genres, setGenres] = useState([]);

    // Разделяем состояния загрузки
    const [initialLoading, setInitialLoading] = useState(true); // Только для первой загрузки
    const [searching, setSearching] = useState(false); // Для поиска/фильтрации
    const [loadingMore, setLoadingMore] = useState(false);

    const [error, setError] = useState(null);
    const [selectedGenreIds, setSelectedGenreIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

    // Флаг первой загрузки
    const isFirstLoad = useRef(true);

    useEffect(() => {
        loadGenres();
    }, []);

    // Debounce для поиска
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Сброс страницы при изменении фильтров
    useEffect(() => {
        setPage(0);
        setHasMore(true);
    }, [debouncedSearchQuery, selectedGenreIds]);

    // Загрузка фильмов
    useEffect(() => {
        loadFilms();
    }, [page, debouncedSearchQuery, selectedGenreIds]);

    const loadGenres = async () => {
        try {
            const genresData = await genresAPI.getGenres();
            setGenres(genresData);
        } catch (err) {
            console.error("Failed to load genres:", err);
            setError("Не удалось загрузить жанры");
        }
    };

    const observer = useRef();
    const lastFilmRef = useCallback(
        (node) => {
            if (loadingMore) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setPage((prevPage) => prevPage + 1);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loadingMore, hasMore]
    );

    const loadFilms = useCallback(async () => {
        try {
            // Определяем тип загрузки
            if (isFirstLoad.current) {
                setInitialLoading(true);
            } else if (page === 0) {
                setSearching(true); // Поиск/фильтрация - НЕ скрываем страницу
            } else {
                setLoadingMore(true);
            }

            const params = {
                skip: page * 20,
                limit: 20,
            };

            if (selectedGenreIds.length > 0) {
                params.genre_ids = selectedGenreIds.join(",");
            }

            if (debouncedSearchQuery) {
                params.search = debouncedSearchQuery;
            }

            const data = await filmsAPI.getFilms(params);

            setTotal(data.total);
            setHasMore(data.hasMore);

            if (page === 0) {
                setFilms(data.items);
            } else {
                setFilms((prevFilms) => [...prevFilms, ...data.items]);
            }

            setError(null);
        } catch (err) {
            console.error("Failed to load films:", err);
            setError("Не удалось загрузить фильмы");
        } finally {
            isFirstLoad.current = false;
            setInitialLoading(false);
            setSearching(false);
            setLoadingMore(false);
        }
    }, [page, debouncedSearchQuery, selectedGenreIds]);

    const resetFilters = () => {
        setSelectedGenreIds([]);
        setSearchQuery("");
    };

    const hasActiveFilters = selectedGenreIds.length > 0 || searchQuery !== "";

    // Полноэкранная загрузка ТОЛЬКО при первом рендере
    if (initialLoading) {
        return <Loading message="Загрузка фильмов..." />;
    }

    const handleGenreChange = (event) => {
        const {
            target: { value },
        } = event;
        setSelectedGenreIds(
            typeof value === "string" ? value.split(",") : value
        );
    };

    const handleChipClick = (genreId) => {
        if (selectedGenreIds.includes(genreId)) {
            setSelectedGenreIds((prev) => prev.filter((id) => id !== genreId));
        } else {
            setSelectedGenreIds((prev) => [...prev, genreId]);
        }
    };

    const selectedGenres = genres.filter((genre) =>
        selectedGenreIds.includes(genre.id.toString())
    );

    return (
        <Box sx={{ minHeight: "100vh", pt: 4, pb: 8 }}>
            {/* Hero Section - без изменений */}
            <Box
                sx={{
                    background:
                        "linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(0, 0, 0, 0) 100%)",
                    borderRadius: 4,
                    p: 6,
                    mb: 6,
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <MovieIcon sx={{ fontSize: 60, color: "#e50914", mb: 2 }} />
                <Typography
                    variant="h2"
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        background:
                            "linear-gradient(135deg, #e50914 0%, #ffd700 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Добро пожаловать в CinemaBooking
                </Typography>
                <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ maxWidth: 800, mx: "auto" }}
                >
                    Забронируйте билеты на лучшие фильмы онлайн. Быстро, удобно,
                    безопасно.
                </Typography>
            </Box>

            <Container maxWidth="xl">
                {error && (
                    <Alert
                        severity="error"
                        sx={{ mb: 3 }}
                    >
                        {error}
                    </Alert>
                )}

                {/* Фильтры */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        mb: 4,
                        background:
                            "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                        border: "1px solid rgba(229, 9, 20, 0.2)",
                        borderRadius: 2,
                    }}
                >
                    <Grid
                        container
                        spacing={3}
                        alignItems="center"
                    >
                        <Grid
                            item
                            xs={12}
                            md={hasActiveFilters ? 5 : 6}
                        >
                            <TextField
                                fullWidth
                                label="Поиск фильмов"
                                variant="outlined"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Введите название фильма..."
                                InputProps={{
                                    // Индикатор поиска прямо в поле ввода
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            {searching ? (
                                                <CircularProgress
                                                    size={20}
                                                    sx={{ color: "#e50914" }}
                                                />
                                            ) : (
                                                <SearchIcon
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                />
                                            )}
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid
                            item
                            xs={12}
                            md={hasActiveFilters ? 5 : 6}
                        >
                            <FormControl
                                fullWidth
                                variant="outlined"
                            >
                                <InputLabel id="genre-select-label">
                                    Жанры
                                </InputLabel>
                                <Select
                                    labelId="genre-select-label"
                                    id="genre-select"
                                    multiple
                                    value={selectedGenreIds}
                                    onChange={handleGenreChange}
                                    input={<OutlinedInput label="Жанры" />}
                                    MenuProps={MenuProps}
                                    renderValue={(selected) => {
                                        if (selected.length === 0)
                                            return "Все жанры";
                                        if (selected.length === 1) {
                                            const genre = genres.find(
                                                (g) =>
                                                    g.id.toString() ===
                                                    selected[0]
                                            );
                                            return genre ? genre.name : "";
                                        }
                                        return `${selected.length} жанров выбрано`;
                                    }}
                                >
                                    {genres.map((genre) => (
                                        <MenuItem
                                            key={genre.id}
                                            value={genre.id.toString()}
                                        >
                                            <ListItemIcon>
                                                <Checkbox
                                                    edge="start"
                                                    checked={
                                                        selectedGenreIds.indexOf(
                                                            genre.id.toString()
                                                        ) !== -1
                                                    }
                                                    disableRipple
                                                />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={genre.name}
                                            />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {hasActiveFilters && (
                            <Grid
                                item
                                xs={12}
                                md={2}
                            >
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={resetFilters}
                                    startIcon={<ClearIcon />}
                                    sx={{
                                        borderColor: "#e50914",
                                        color: "#e50914",
                                        height: "56px",
                                        fontWeight: 600,
                                        "&:hover": {
                                            borderColor: "#ff1a1a",
                                            background: "rgba(229, 9, 20, 0.1)",
                                        },
                                    }}
                                >
                                    Сбросить
                                </Button>
                            </Grid>
                        )}
                    </Grid>

                    {/* Чипы жанров */}
                    <Box
                        sx={{
                            mt: 2,
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        {genres.map((genre) => (
                            <Chip
                                key={genre.id}
                                label={genre.name}
                                onClick={() =>
                                    handleChipClick(genre.id.toString())
                                }
                                variant={
                                    selectedGenreIds.includes(
                                        genre.id.toString()
                                    )
                                        ? "filled"
                                        : "outlined"
                                }
                                sx={{
                                    background: selectedGenreIds.includes(
                                        genre.id.toString()
                                    )
                                        ? "linear-gradient(135deg, #e50914 0%, #b00710 100%)"
                                        : "transparent",
                                    borderColor: "#e50914",
                                    color: selectedGenreIds.includes(
                                        genre.id.toString()
                                    )
                                        ? "#fff"
                                        : "#e50914",
                                    fontWeight: 600,
                                    "&:hover": {
                                        background: selectedGenreIds.includes(
                                            genre.id.toString()
                                        )
                                            ? "linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)"
                                            : "rgba(229, 9, 20, 0.1)",
                                    },
                                }}
                            />
                        ))}
                    </Box>
                </Paper>

                {/* Заголовок с индикатором поиска */}
                <Box
                    sx={{
                        mb: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                    }}
                >
                    <Box>
                        <Typography
                            variant="h5"
                            sx={{ fontWeight: 600, mb: 1 }}
                        >
                            {selectedGenreIds.length === 0
                                ? "Все фильмы"
                                : `Фильмы (${selectedGenres.map((g) => g.name).join(", ")})`}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            Найдено фильмов: {total}
                        </Typography>
                    </Box>
                    {/* Показываем спиннер рядом с заголовком при поиске */}
                    {searching && (
                        <CircularProgress
                            size={24}
                            sx={{ color: "#e50914" }}
                        />
                    )}
                </Box>

                {/* Список фильмов - показываем с opacity при поиске */}
                <Box
                    sx={{
                        opacity: searching ? 0.6 : 1,
                        transition: "opacity 0.2s ease",
                        pointerEvents: searching ? "none" : "auto",
                    }}
                >
                    {films.length > 0 ? (
                        <>
                            <Grid
                                container
                                spacing={3}
                            >
                                {films.map((film, index) => {
                                    if (films.length === index + 1) {
                                        return (
                                            <Grid
                                                item
                                                xs={12}
                                                sm={6}
                                                md={4}
                                                lg={3}
                                                key={film.id}
                                                ref={lastFilmRef}
                                            >
                                                <FilmCard film={film} />
                                            </Grid>
                                        );
                                    }
                                    return (
                                        <Grid
                                            item
                                            xs={12}
                                            sm={6}
                                            md={4}
                                            lg={3}
                                            key={film.id}
                                        >
                                            <FilmCard film={film} />
                                        </Grid>
                                    );
                                })}
                            </Grid>

                            {loadingMore && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        mt: 4,
                                    }}
                                >
                                    <CircularProgress
                                        sx={{ color: "#e50914" }}
                                    />
                                </Box>
                            )}

                            {!hasMore && films.length > 0 && (
                                <Box sx={{ textAlign: "center", mt: 4 }}>
                                    <Typography
                                        variant="body1"
                                        color="text.secondary"
                                    >
                                        Все фильмы загружены
                                    </Typography>
                                </Box>
                            )}
                        </>
                    ) : (
                        <Paper
                            sx={{
                                p: 6,
                                textAlign: "center",
                                background: "rgba(31, 31, 31, 0.5)",
                                border: "1px solid rgba(229, 9, 20, 0.2)",
                            }}
                        >
                            <MovieIcon
                                sx={{ fontSize: 80, color: "#404040", mb: 2 }}
                            />
                            <Typography
                                variant="h6"
                                color="text.secondary"
                            >
                                Фильмы не найдены
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                            >
                                Попробуйте изменить параметры поиска
                            </Typography>
                        </Paper>
                    )}
                </Box>
            </Container>
        </Box>
    );
};

export default Home;
