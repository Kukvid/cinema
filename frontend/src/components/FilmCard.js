import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Rating,
} from '@mui/material';
import { Star as StarIcon, ConfirmationNumber as TicketIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const FilmCard = ({ film }) => {
  const navigate = useNavigate();

  const handleBooking = () => {
    navigate(`/films/${film.id}`);
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 12px 32px rgba(229, 9, 20, 0.3)',
          '& .film-poster': {
            transform: 'scale(1.1)',
          },
          '& .overlay': {
            opacity: 1,
          },
        },
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={handleBooking}
    >
      <Box sx={{ position: 'relative', paddingTop: '150%', overflow: 'hidden' }}>
        <CardMedia
          className="film-poster"
          component="img"
          image={film.poster_url || 'https://via.placeholder.com/300x450/1f1f1f/ffffff?text=No+Poster'}
          alt={film.title}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
          }}
        />
        <Box
          className="overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%)',
            opacity: 0,
            transition: 'opacity 0.4s ease',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 2,
          }}
        >
          <Button
            variant="contained"
            startIcon={<TicketIcon />}
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
              fontWeight: 600,
              py: 1.5,
            }}
          >
            Купить билет
          </Button>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography
          gutterBottom
          variant="h6"
          component="div"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '3.6em',
          }}
        >
          {film.title}
        </Typography>

        {film.genre && (
          <Chip
            label={film.genre}
            size="small"
            sx={{
              mb: 1,
              background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.2) 0%, rgba(176, 7, 16, 0.2) 100%)',
              border: '1px solid rgba(229, 9, 20, 0.3)',
              fontWeight: 500,
            }}
          />
        )}

        {film.rating && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Rating
              value={film.rating / 2}
              precision={0.1}
              readOnly
              size="small"
              icon={<StarIcon sx={{ color: '#ffd700' }} fontSize="inherit" />}
              emptyIcon={<StarIcon sx={{ color: '#404040' }} fontSize="inherit" />}
            />
            <Typography variant="body2" sx={{ ml: 1, color: '#ffd700', fontWeight: 600 }}>
              {film.rating?.toFixed(1)}
            </Typography>
          </Box>
        )}

        {film.duration && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {film.duration} мин
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {film.description || 'Описание отсутствует'}
        </Typography>
      </CardActions>
    </Card>
  );
};

export default FilmCard;
