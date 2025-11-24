import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Star as StarIcon,
  AccessTime as TimeIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import Loading from '../components/Loading';
import SessionList from '../components/SessionList';
import { filmsAPI } from '../api/films';
import { sessionsAPI } from '../api/sessions';

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
        sessionsAPI.getSessions({ film_id: id }),
      ]);
      setFilm(filmData);
      setSessions(sessionsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load film:', err);
      setError('Не удалось загрузить информацию о фильме');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Загрузка информации о фильме..." />;
  }

  if (error || !film) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Фильм не найден'}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', pb: 8 }}>
      {/* Hero Section с постером */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: '300px', md: '500px' },
          overflow: 'hidden',
          mb: 4,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(180deg, transparent 0%, #141414 100%)`,
            zIndex: 1,
          },
        }}
      >
        <Box
          component="img"
          src={film.poster_url || 'https://via.placeholder.com/1920x1080/1f1f1f/ffffff?text=No+Image'}
          alt={film.title}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(8px) brightness(0.4)',
          }}
        />
      </Box>

      <Container maxWidth="xl" sx={{ mt: -25, position: 'relative', zIndex: 2 }}>
        <Grid container spacing={4}>
          {/* Постер */}
          <Grid item xs={12} md={4} lg={3}>
            <Paper
              elevation={8}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '2px solid rgba(229, 9, 20, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
              }}
            >
              <Box
                component="img"
                src={film.poster_url || 'https://via.placeholder.com/400x600/1f1f1f/ffffff?text=No+Poster'}
                alt={film.title}
                sx={{
                  width: '100%',
                  display: 'block',
                }}
              />
            </Paper>
          </Grid>

          {/* Информация о фильме */}
          <Grid item xs={12} md={8} lg={9}>
            <Paper
              sx={{
                p: 4,
                background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                border: '1px solid rgba(229, 9, 20, 0.2)',
                borderRadius: 3,
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {film.title}
              </Typography>

              {/* Рейтинг и жанр */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {film.rating && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Rating
                      value={film.rating / 2}
                      precision={0.1}
                      readOnly
                      icon={<StarIcon sx={{ color: '#ffd700' }} fontSize="large" />}
                      emptyIcon={<StarIcon sx={{ color: '#404040' }} fontSize="large" />}
                    />
                    <Typography variant="h6" sx={{ color: '#ffd700', fontWeight: 700 }}>
                      {film.rating?.toFixed(1)}
                    </Typography>
                  </Box>
                )}

                {film.genre && (
                  <Chip
                    icon={<CategoryIcon />}
                    label={film.genre}
                    sx={{
                      background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.3) 0%, rgba(176, 7, 16, 0.3) 100%)',
                      border: '1px solid rgba(229, 9, 20, 0.5)',
                      fontWeight: 600,
                      fontSize: '1rem',
                      px: 2,
                      py: 2.5,
                    }}
                  />
                )}

                {film.duration && (
                  <Chip
                    icon={<TimeIcon />}
                    label={`${film.duration} мин`}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      fontWeight: 600,
                      fontSize: '1rem',
                      px: 2,
                      py: 2.5,
                    }}
                  />
                )}
              </Box>

              <Divider sx={{ my: 3, borderColor: 'rgba(229, 9, 20, 0.2)' }} />

              {/* Описание */}
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Описание
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
                {film.description || 'Описание отсутствует'}
              </Typography>

              {/* Трейлер */}
              {film.trailer_url && (
                <>
                  <Divider sx={{ my: 3, borderColor: 'rgba(229, 9, 20, 0.2)' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Трейлер
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      paddingBottom: '56.25%',
                      height: 0,
                      overflow: 'hidden',
                      borderRadius: 2,
                      border: '2px solid rgba(229, 9, 20, 0.3)',
                    }}
                  >
                    <iframe
                      src={film.trailer_url}
                      title="Трейлер"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 0,
                      }}
                      allowFullScreen
                    />
                  </Box>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Расписание сеансов */}
        <Box sx={{ mt: 6 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 3,
              background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Расписание сеансов
          </Typography>

          {sessions.length > 0 ? (
            <SessionList sessions={sessions} />
          ) : (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'rgba(31, 31, 31, 0.5)',
                border: '1px solid rgba(229, 9, 20, 0.2)',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                Сеансы пока не запланированы
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Проверьте позже
              </Typography>
            </Paper>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default FilmDetail;
