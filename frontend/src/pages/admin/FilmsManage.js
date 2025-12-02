import React, { useState, useEffect } from 'react';
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
  ListItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import Loading from '../../components/Loading';
import { filmsAPI } from '../../api/films';
import { genresAPI } from '../../api/genres';
import { useForm } from 'react-hook-form';

const FilmsManage = () => {
  const [films, setFilms] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFilm, setEditingFilm] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [posterFile, setPosterFile] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch
  } = useForm();

  // Watch for selected genres
  const watchedGenreIds = watch('genre_ids') || [];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [filmsData, genresData] = await Promise.all([
        filmsAPI.getFilms(),
        genresAPI.getGenres()
      ]);
      // API returns paginated response with items field
      setFilms(filmsData.items || filmsData);  // Handle both paginated and non-paginated responses
      setGenres(genresData);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const loadFilms = async () => {
    try {
      setLoading(true);
      const data = await filmsAPI.getFilms();
      // API returns paginated response with items field
      setFilms(data.items || data);  // Handle both paginated and non-paginated responses
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить фильмы');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (film = null) => {
    setEditingFilm(film);
    if (film) {
      // For editing, convert existing genre or genre_ids to an array of genre IDs
      let genreIds = [];
      if (film.genres && Array.isArray(film.genres)) {
        // If the film object has a genres property with actual genre objects
        genreIds = film.genres.map(g => g.id);
      } else if (film.genre_ids && Array.isArray(film.genre_ids)) {
        // If the film object has genre_ids property
        genreIds = film.genre_ids;
      } else if (film.genre) {
        // If the film object has a single genre string, try to find it in our genres
        const genreObj = genres.find(g => g.name.toLowerCase() === film.genre.toLowerCase());
        if (genreObj) {
          genreIds = [genreObj.id];
        }
      }

      reset({
        ...film,
        genre_ids: genreIds
      });
    } else {
      reset({
        title: '',
        description: '',
        genre_ids: [],
        duration: 0,
        rating: 0,
        trailer_url: ''
      });
    }
    setPosterFile(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFilm(null);
    reset();
    setPosterFile(null);
  };

  const onSubmit = async (data) => {
    try {
      setFormLoading(true);
      setError(null);

      // Prepare film data with genre_ids
      const filmData = {
        ...data,
        genre_ids: data.genre_ids || []  // Ensure genre_ids is always an array
      };

      let film;
      if (editingFilm) {
        film = await filmsAPI.updateFilm(editingFilm.id, filmData);
      } else {
        film = await filmsAPI.createFilm(filmData);
      }

      // Загружаем постер если выбран
      if (posterFile) {
        await filmsAPI.uploadPoster(film.id, posterFile);
      }

      await loadFilms();
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить фильм');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить фильм?')) {
      try {
        await filmsAPI.deleteFilm(id);
        await loadFilms();
      } catch (err) {
        setError('Не удалось удалить фильм');
      }
    }
  };

  if (loading) {
    return <Loading message="Загрузка фильмов..." />;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Управление фильмами
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
          }}
        >
          Добавить фильм
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {films.map((film) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={film.id}>
            <Card
              sx={{
                height: '100%',
                background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                border: '1px solid rgba(229, 9, 20, 0.2)',
              }}
            >
              <CardMedia
                component="img"
                height="300"
                image={film.poster_url || 'https://via.placeholder.com/300x450/1f1f1f/ffffff?text=No+Poster'}
                alt={film.title}
              />
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {film.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {film.genres && Array.isArray(film.genres) && film.genres.length > 0
                    ? film.genres.map(g => g.name).join(', ')
                    : film.genre || 'Без жанра'} • {film.duration} мин
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton onClick={() => handleOpenDialog(film)} color="primary" size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(film.id)} color="error" size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingFilm ? 'Редактировать фильм' : 'Добавить фильм'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <TextField
              fullWidth
              label="Название"
              margin="normal"
              {...register('title', { required: 'Название обязательно' })}
              error={!!errors.title}
              helperText={errors.title?.message}
            />
            <TextField
              fullWidth
              label="Описание"
              margin="normal"
              multiline
              rows={3}
              {...register('description')}
            />
            <FormControl fullWidth margin="normal" error={!!errors.genre_ids}>
              <InputLabel>Жанры</InputLabel>
              <Select
                label="Жанры"
                multiple
                value={watchedGenreIds}
                onChange={(e) => {
                  setValue('genre_ids', e.target.value);
                }}
                input={<OutlinedInput label="Жанры" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((genreId) => {
                      const genre = genres.find(g => g.id === genreId);
                      return (
                        <Chip
                          key={genreId}
                          label={genre?.name}
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.3) 0%, rgba(229, 9, 20, 0.1) 100%)',
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {genres.map((genre) => (
                  <MenuItem key={genre.id} value={genre.id}>
                    <Checkbox checked={watchedGenreIds.indexOf(genre.id) > -1} />
                    <ListItemText primary={genre.name} />
                  </MenuItem>
                ))}
              </Select>
              {errors.genre_ids && (
                <Typography variant="caption" color="error">
                  Выберите хотя бы один жанр
                </Typography>
              )}
            </FormControl>
            <TextField
              fullWidth
              label="Длительность (мин)"
              margin="normal"
              type="number"
              {...register('duration')}
            />
            <TextField
              fullWidth
              label="Рейтинг (0-10)"
              margin="normal"
              type="number"
              inputProps={{ step: 0.1, min: 0, max: 10 }}
              {...register('rating')}
            />
            <TextField
              fullWidth
              label="URL трейлера"
              margin="normal"
              {...register('trailer_url')}
            />
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
              >
                Загрузить постер
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => setPosterFile(e.target.files[0])}
                />
              </Button>
              {posterFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Выбран файл: {posterFile.name}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Отмена</Button>
            <Button type="submit" variant="contained" disabled={formLoading}>
              {formLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default FilmsManage;
