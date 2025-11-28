import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from '@mui/material';
import { MovieFilter as MovieIcon, Clear as ClearIcon } from '@mui/icons-material';
import FilmCard from '../components/FilmCard';
import Loading from '../components/Loading';
import { filmsAPI } from '../api/films';
import { getGenres } from '../api/genres';

const Home = () => {
  const [films, setFilms] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

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

  useEffect(() => {
    loadGenres();
  }, []);

  useEffect(() => {
    // Reset and load when filters change
    setFilms([]);
    setPage(0);
    setHasMore(true);
  }, [selectedGenre, searchQuery]);

  useEffect(() => {
    loadFilms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedGenre, searchQuery]);

  const loadGenres = async () => {
    try {
      const genresData = await getGenres();
      setGenres(genresData);
    } catch (err) {
      console.error('Failed to load genres:', err);
    }
  };

  const loadFilms = async () => {
    try {
      if (page === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params = {
        skip: page * 20,
        limit: 20,
      };

      if (selectedGenre !== 'all') {
        params.genre_id = parseInt(selectedGenre);
      }

      if (searchQuery) {
        params.search = searchQuery;
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
      console.error('Failed to load films:', err);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const resetFilters = () => {
    setSelectedGenre('all');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedGenre !== 'all' || searchQuery !== '';

  if (loading && page === 0) {
    return <Loading message="Загрузка фильмов..." />;
  }

  return (
    <Box sx={{ minHeight: '100vh', pt: 4, pb: 8 }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(0, 0, 0, 0) 100%)',
          borderRadius: 4,
          p: 6,
          mb: 6,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e50914\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3,
          },
        }}
      >
        <MovieIcon sx={{ fontSize: 60, color: '#e50914', mb: 2 }} />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            mb: 2,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Добро пожаловать в CinemaBooking
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto' }}>
          Забронируйте билеты на лучшие фильмы онлайн. Быстро, удобно, безопасно.
        </Typography>
      </Box>

      <Container maxWidth="xl">
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Фильтры */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
            borderRadius: 2,
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={hasActiveFilters ? 5 : 6}>
              <TextField
                fullWidth
                label="Поиск фильмов"
                variant="outlined"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите название фильма..."
              />
            </Grid>
            <Grid item xs={12} md={hasActiveFilters ? 5 : 6}>
              <TextField
                fullWidth
                select
                label="Жанр"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <MenuItem value="all">Все жанры</MenuItem>
                {genres.map((genre) => (
                  <MenuItem key={genre.id} value={genre.id.toString()}>
                    {genre.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {hasActiveFilters && (
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={resetFilters}
                  startIcon={<ClearIcon />}
                  sx={{
                    borderColor: '#e50914',
                    color: '#e50914',
                    height: '56px',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#ff1a1a',
                      background: 'rgba(229, 9, 20, 0.1)',
                    },
                  }}
                >
                  Сбросить
                </Button>
              </Grid>
            )}
          </Grid>

          {/* Быстрые фильтры по жанрам */}
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="Все"
              onClick={() => setSelectedGenre('all')}
              variant={selectedGenre === 'all' ? 'filled' : 'outlined'}
              sx={{
                background:
                  selectedGenre === 'all'
                    ? 'linear-gradient(135deg, #e50914 0%, #b00710 100%)'
                    : 'transparent',
                borderColor: '#e50914',
                color: selectedGenre === 'all' ? '#fff' : '#e50914',
                fontWeight: 600,
                '&:hover': {
                  background:
                    selectedGenre === 'all'
                      ? 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)'
                      : 'rgba(229, 9, 20, 0.1)',
                },
              }}
            />
            {genres.map((genre) => (
              <Chip
                key={genre.id}
                label={genre.name}
                onClick={() => setSelectedGenre(genre.id.toString())}
                variant={selectedGenre === genre.id.toString() ? 'filled' : 'outlined'}
                sx={{
                  background:
                    selectedGenre === genre.id.toString()
                      ? 'linear-gradient(135deg, #e50914 0%, #b00710 100%)'
                      : 'transparent',
                  borderColor: '#e50914',
                  color: selectedGenre === genre.id.toString() ? '#fff' : '#e50914',
                  fontWeight: 600,
                  '&:hover': {
                    background:
                      selectedGenre === genre.id.toString()
                        ? 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)'
                        : 'rgba(229, 9, 20, 0.1)',
                  },
                }}
              />
            ))}
          </Box>
        </Paper>

        {/* Список фильмов */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            {selectedGenre === 'all'
              ? 'Все фильмы'
              : `Фильмы в жанре "${genres.find((g) => g.id.toString() === selectedGenre)?.name || ''}"`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Найдено фильмов: {total}
          </Typography>
        </Box>

        {films.length > 0 ? (
          <>
            <Grid container spacing={3}>
              {films.map((film, index) => {
                // Attach ref to the last film
                if (films.length === index + 1) {
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={film.id} ref={lastFilmRef}>
                      <FilmCard film={film} />
                    </Grid>
                  );
                } else {
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={film.id}>
                      <FilmCard film={film} />
                    </Grid>
                  );
                }
              })}
            </Grid>

            {/* Loading indicator for infinite scroll */}
            {loadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress sx={{ color: '#e50914' }} />
              </Box>
            )}

            {/* End of list message */}
            {!hasMore && films.length > 0 && (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  Все фильмы загружены
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(31, 31, 31, 0.5)',
              border: '1px solid rgba(229, 9, 20, 0.2)',
            }}
          >
            <MovieIcon sx={{ fontSize: 80, color: '#404040', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Фильмы не найдены
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Попробуйте изменить параметры поиска
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default Home;
