import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Container,
    Typography,
    Box,
    Button,
    Grid,
    Card,
    CardContent,
    CardMedia,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    OutlinedInput,
    Checkbox,
    ListItemText,
    ListItem,
    Paper,
    InputAdornment,
    CircularProgress,
    ListItemIcon,
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Upload as UploadIcon,
    Clear as ClearIcon,
    Search as SearchIcon,
} from "@mui/icons-material";
import Loading from "../../components/Loading";
import { filmsAPI } from "../../api/films";
import { genresAPI } from "../../api/genres";
import { useForm } from "react-hook-form";

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

const FilmsManage = () => {
    const [films, setFilms] = useState([]);
    const [genres, setGenres] = useState([]);
    // Разделяем состояния загрузки
    const [initialLoading, setInitialLoading] = useState(true); // Только для первой загрузки
    const [searching, setSearching] = useState(false); // Для поиска/фильтрации
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingFilm, setEditingFilm] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGenreIds, setSelectedGenreIds] = useState([]);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

    // Флаг первой загрузки
    const isFirstLoad = useRef(true);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
        setValue,
        watch,
    } = useForm();

    // Watch for selected genres
    const watchedGenreIds = watch("genre_ids") || [];

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

    useEffect(() => {
        loadGenres();
    }, []);

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

    const loadData = async () => {
        try {
            setInitialLoading(true);
            const genresData = await genresAPI.getGenres();
            setGenres(genresData);
            setError(null);
        } catch (err) {
            setError("Не удалось загрузить данные");
        } finally {
            setInitialLoading(false);
        }
    };

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

    const handleOpenDialog = (film = null) => {
        setEditingFilm(film);
        if (film) {
            // For editing, convert existing genre or genre_ids to an array of genre IDs
            let genreIds = [];
            if (film.genres && Array.isArray(film.genres)) {
                // If the film object has a genres property with actual genre objects
                genreIds = film.genres.map((g) => g.id);
            } else if (film.genre_ids && Array.isArray(film.genre_ids)) {
                // If the film object has genre_ids property
                genreIds = film.genre_ids;
            } else if (film.genre) {
                // If the film object has a single genre string, try to find it in our genres
                const genreObj = genres.find(
                    (g) => g.name.toLowerCase() === film.genre.toLowerCase()
                );
                if (genreObj) {
                    genreIds = [genreObj.id];
                }
            }

            reset({
                ...film,
                genre_ids: genreIds,
                duration_minutes: film.duration_minutes || 0,
                imdb_rating: film.imdb_rating,
                kinopoisk_rating: film.kinopoisk_rating,
                poster_url: film.poster_url || "",
                original_title: film.original_title || "",
                age_rating: film.age_rating || "",
                release_year: film.release_year || "",
                country: film.country || "",
                director: film.director || "",
                actors: film.actors || "",
            });
        } else {
            reset({
                title: "",
                original_title: "",
                description: "",
                age_rating: "",
                duration_minutes: 0,
                release_year: "",
                country: "",
                director: "",
                actors: "",
                genre_ids: [],
                imdb_rating: null,
                kinopoisk_rating: null,
                trailer_url: "",
                poster_url: ''
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingFilm(null);
        reset();
    };

    const onSubmit = async (data) => {
        try {
            setFormLoading(true);
            setError(null);

            // Prepare film data with proper field mapping
            const filmData = {
                ...data,
                genre_ids: data.genre_ids || [], // Ensure genre_ids is always an array
                duration_minutes: parseInt(data.duration_minutes) || 0,  // Ensure this field name matches backend
                imdb_rating: data.imdb_rating ? parseFloat(data.imdb_rating) : null,  // Ensure proper type conversion
                kinopoisk_rating: data.kinopoisk_rating ? parseFloat(data.kinopoisk_rating) : null,  // Ensure proper type conversion
                poster_url: data.poster_url || null,
                trailer_url: data.trailer_url || null
            };

            let film;
            if (editingFilm) {
                film = await filmsAPI.updateFilm(editingFilm.id, filmData);
            } else {
                film = await filmsAPI.createFilm(filmData);
            }

            // After creating/updating, refresh the film list starting from first page
            setPage(0);
            setHasMore(true);
            isFirstLoad.current = false;
            await loadFilms();
            handleCloseDialog();
        } catch (err) {
            setError(
                err.response?.data?.detail || "Не удалось сохранить фильм"
            );
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Удалить фильм?")) {
            try {
                await filmsAPI.deleteFilm(id);
                // After deletion, refresh the film list starting from first page
                setPage(0);
                setHasMore(true);
                isFirstLoad.current = false;
                await loadFilms();
            } catch (err) {
                setError("Не удалось удалить фильм");
            }
        }
    };


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
                    Управление фильмами
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
                    Добавить фильм
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
                            ? "Фильмы"
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
                                    <Card
                                        sx={{
                                            height: "100%",
                                            background:
                                                "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                                            border: "1px solid rgba(229, 9, 20, 0.2)",
                                        }}
                                    >
                                        <CardMedia
                                            component="img"
                                            height="300"
                                            image={
                                                film.poster_url ||
                                                "https://via.placeholder.com/300x450/1f1f1f/ffffff?text=No+Poster"
                                            }
                                            alt={film.title}
                                        />
                                        <CardContent>
                                            <Typography
                                                variant="h6"
                                                sx={{ fontWeight: 600, mb: 1 }}
                                            >
                                                {film.title}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mb: 2 }}
                                            >
                                                {film.genres &&
                                                Array.isArray(film.genres) &&
                                                film.genres.length > 0
                                                    ? film.genres
                                                          .map((g) => g.name)
                                                          .join(", ")
                                                    : film.genre || "Без жанра"}{" "}
                                                • {film.duration_minutes || film.duration} мин{" "}
                                                • {film.release_year || "Год не указан"}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mb: 1, fontSize: '0.8rem' }}
                                            >
                                                {film.country || "Страна не указана"}
                                            </Typography>
                                            <Box sx={{ display: "flex", gap: 1 }}>
                                                <IconButton
                                                    onClick={() => handleOpenDialog(film)}
                                                    color="primary"
                                                    size="small"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton
                                                    onClick={() => handleDelete(film.id)}
                                                    color="error"
                                                    size="small"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        </CardContent>
                                    </Card>
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
                                <Card
                                    sx={{
                                        height: "100%",
                                        background:
                                            "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)",
                                        border: "1px solid rgba(229, 9, 20, 0.2)",
                                    }}
                                >
                                    <CardMedia
                                        component="img"
                                        height="300"
                                        image={
                                            film.poster_url ||
                                            "https://via.placeholder.com/300x450/1f1f1f/ffffff?text=No+Poster"
                                        }
                                        alt={film.title}
                                    />
                                    <CardContent>
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 600, mb: 1 }}
                                        >
                                            {film.title}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mb: 2 }}
                                        >
                                            {film.genres &&
                                            Array.isArray(film.genres) &&
                                            film.genres.length > 0
                                                ? film.genres
                                                      .map((g) => g.name)
                                                      .join(", ")
                                                : film.genre || "Без жанра"}{" "}
                                            • {film.duration_minutes || film.duration} мин{" "}
                                            • {film.release_year || "Год не указан"}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mb: 1, fontSize: '0.8rem' }}
                                        >
                                            {film.country || "Страна не указана"}
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <IconButton
                                                onClick={() => handleOpenDialog(film)}
                                                color="primary"
                                                size="small"
                                            >
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleDelete(film.id)}
                                                color="error"
                                                size="small"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>

            {loadingMore && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        my: 4,
                    }}
                >
                    <CircularProgress
                        sx={{ color: "#e50914" }}
                    />
                </Box>
            )}

            {/* Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {editingFilm ? "Редактировать фильм" : "Добавить фильм"}
                </DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        <TextField
                            fullWidth
                            label="Название"
                            margin="normal"
                            {...register("title", {
                                required: "Название обязательно",
                            })}
                            error={!!errors.title}
                            helperText={errors.title?.message}
                        />
                        <TextField
                            fullWidth
                            label="Оригинальное название"
                            margin="normal"
                            {...register("original_title")}
                        />
                        <TextField
                            fullWidth
                            label="Описание"
                            margin="normal"
                            multiline
                            rows={3}
                            {...register("description")}
                        />
                        <TextField
                            fullWidth
                            label="Возрастной рейтинг"
                            margin="normal"
                            {...register("age_rating")}
                            helperText="Например: 0+, 6+, 12+, 16+, 18+"
                        />
                        <TextField
                            fullWidth
                            label="Длительность (мин)"
                            margin="normal"
                            type="number"
                            {...register("duration_minutes", {
                                required: "Дллительность обязательна",
                            })}
                        />
                        <TextField
                            fullWidth
                            label="Год выпуска"
                            margin="normal"
                            type="number"
                            inputProps={{ min: 1895, max: 2100 }}
                            {...register("release_year", {
                                required: "Год выпуска обязателен",
                            })}
                        />
                        <TextField
                            fullWidth
                            label="Страна"
                            margin="normal"
                            {...register("country")}
                        />
                        <TextField
                            fullWidth
                            label="Режиссёр"
                            margin="normal"
                            {...register("director")}
                        />
                        <TextField
                            fullWidth
                            label="Актеры"
                            margin="normal"
                            multiline
                            rows={2}
                            {...register("actors")}
                        />
                        <FormControl
                            fullWidth
                            margin="normal"
                            error={!!errors.genre_ids}
                        >
                            <InputLabel>Жанры</InputLabel>
                            <Select
                                label="Жанры"
                                multiple
                                value={watchedGenreIds}
                                onChange={(e) => {
                                    setValue("genre_ids", e.target.value);
                                }}
                                input={<OutlinedInput label="Жанры" />}
                                renderValue={(selected) => (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 0.5,
                                        }}
                                    >
                                        {selected.map((genreId) => {
                                            const genre = genres.find(
                                                (g) => g.id === genreId
                                            );
                                            return (
                                                <Chip
                                                    key={genreId}
                                                    label={genre?.name}
                                                    size="small"
                                                    sx={{
                                                        background:
                                                            "linear-gradient(135deg, rgba(229, 9, 20, 0.3) 0%, rgba(229, 9, 20, 0.1) 100%)",
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                )}
                            >
                                {genres.map((genre) => (
                                    <MenuItem
                                        key={genre.id}
                                        value={genre.id}
                                    >
                                        <Checkbox
                                            checked={
                                                watchedGenreIds.indexOf(
                                                    genre.id
                                                ) > -1
                                            }
                                        />
                                        <ListItemText primary={genre.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.genre_ids && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                >
                                    Выберите хотя бы один жанр
                                </Typography>
                            )}
                        </FormControl>
                        <TextField
                            fullWidth
                            label="IMDB Рейтинг (0-10)"
                            margin="normal"
                            type="number"
                            inputProps={{ step: 0.1, min: 0, max: 10 }}
                            {...register("imdb_rating")}
                        />
                        <TextField
                            fullWidth
                            label="Кинопоиск Рейтинг (0-10)"
                            margin="normal"
                            type="number"
                            inputProps={{ step: 0.1, min: 0, max: 10 }}
                            {...register("kinopoisk_rating")}
                        />
                        <TextField
                            fullWidth
                            label="URL трейлера"
                            margin="normal"
                            {...register("trailer_url")}
                        />
                        <TextField
                            fullWidth
                            label="URL постера"
                            margin="normal"
                            {...register("poster_url")}
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

export default FilmsManage;
