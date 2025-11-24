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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import Loading from '../../components/Loading';
import { filmsAPI } from '../../api/films';
import { useForm } from 'react-hook-form';

const FilmsManage = () => {
  const [films, setFilms] = useState([]);
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
  } = useForm();

  useEffect(() => {
    loadFilms();
  }, []);

  const loadFilms = async () => {
    try {
      setLoading(true);
      const data = await filmsAPI.getFilms();
      setFilms(data);
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
      reset(film);
    } else {
      reset({ title: '', description: '', genre: '', duration: 0, rating: 0 });
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
      let film;
      if (editingFilm) {
        film = await filmsAPI.updateFilm(editingFilm.id, data);
      } else {
        film = await filmsAPI.createFilm(data);
      }

      // Загружаем постер если выбран
      if (posterFile) {
        await filmsAPI.uploadPoster(film.id, posterFile);
      }

      await loadFilms();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить фильм');
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
                  {film.genre} • {film.duration} мин
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
            <TextField
              fullWidth
              label="Жанр"
              margin="normal"
              {...register('genre')}
            />
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
