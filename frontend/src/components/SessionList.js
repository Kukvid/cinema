import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Place as PlaceIcon,
  EventSeat as SeatIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const SessionList = ({ sessions, groupByDate = true }) => {
  const navigate = useNavigate();

  const handleBookSession = (sessionId) => {
    navigate(`/sessions/${sessionId}/booking`);
  };

  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), 'd MMMM, EEEE', { locale: ru });
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  // Группировка сеансов по датам
  const groupedSessions = groupByDate
    ? sessions.reduce((acc, session) => {
        if (!session.start_datetime) {
          return acc;
        }
        const date = session.start_datetime.split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(session);
        return acc;
      }, {})
    : { all: sessions };

  const sortedDates = Object.keys(groupedSessions).sort();

  return (
    <Box>
      {sortedDates.map((date) => (
        <Box key={date} sx={{ mb: 4 }}>
          {groupByDate && (
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontWeight: 600,
                color: '#e50914',
                textTransform: 'capitalize',
              }}
            >
              {formatDate(date)}
            </Typography>
          )}

          <Grid container spacing={2}>
            {groupedSessions[date].map((session) => (
              <Grid item xs={12} key={session.id}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                    border: '1px solid rgba(229, 9, 20, 0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateX(8px)',
                      borderColor: 'rgba(229, 9, 20, 0.5)',
                      boxShadow: '0 4px 16px rgba(229, 9, 20, 0.2)',
                    },
                  }}
                >
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      {/* Время */}
                      <Grid item xs={12} sm={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TimeIcon sx={{ color: '#e50914' }} />
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {formatTime(session.start_datetime)}
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Кинотеатр и зал */}
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PlaceIcon sx={{ color: '#ffd700', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {session.hall?.cinema?.name || 'Кинотеатр'}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Зал {session.hall?.name || session.hall_id}
                        </Typography>
                      </Grid>

                      {/* Цена */}
                      <Grid item xs={12} sm={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#46d369' }}>
                            {session.ticket_price} ₽
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Доступные места */}
                      <Grid item xs={12} sm={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SeatIcon sx={{ fontSize: 20 }} />
                          <Typography
                            variant="body2"
                            color={session.available_seats > 0 ? "text.secondary" : "error"}
                            sx={{ fontWeight: session.available_seats === 0 ? 700 : 400 }}
                          >
                            {session.available_seats !== undefined && session.available_seats !== null
                              ? session.available_seats === 0
                                ? 'Нет мест'
                                : `${session.available_seats} мест`
                              : 'Доступно'}
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Кнопка бронирования */}
                      <Grid item xs={12} sm={2}>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => handleBookSession(session.id)}
                          disabled={session.available_seats === 0}
                          sx={{
                            background: session.available_seats === 0
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
                            fontWeight: 600,
                            '&:hover': {
                              background: session.available_seats === 0
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
                              transform: session.available_seats === 0 ? 'none' : 'translateY(-2px)',
                              boxShadow: session.available_seats === 0
                                ? 'none'
                                : '0 4px 12px rgba(229, 9, 20, 0.4)',
                            },
                            '&.Mui-disabled': {
                              color: 'rgba(255, 255, 255, 0.3)',
                            },
                          }}
                        >
                          {session.available_seats === 0 ? 'Нет мест' : 'Выбрать'}
                        </Button>
                      </Grid>
                    </Grid>

                    {/* Дополнительная информация */}
                    {session.format && (
                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={session.format}
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.1) 100%)',
                            color: '#ffd700',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {sessions.length === 0 && (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            background: 'rgba(31, 31, 31, 0.5)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Сеансы не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Попробуйте выбрать другую дату или кинотеатр
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default SessionList;
