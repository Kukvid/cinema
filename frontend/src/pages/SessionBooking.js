import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Divider,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  FormControlLabel,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ConfirmationNumber as TicketIcon,
  AccessTime as TimeIcon,
  Place as PlaceIcon,
  EventSeat as SeatIcon,
  LocalOffer as PromoIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Loading from '../components/Loading';
import SeatMap from '../components/SeatMap';
import { sessionsAPI } from '../api/sessions';
import { concessionsAPI } from '../api/concessions';
import { bookingsAPI } from '../api/bookings';
import { useAuth } from '../context/AuthContext';

const SessionBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [session, setSession] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [concessions, setConcessions] = useState([]);
  const [selectedConcessions, setSelectedConcessions] = useState({});
  const [promoCode, setPromoCode] = useState('');
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionData, seatsData, concessionsData] = await Promise.all([
        sessionsAPI.getSessionById(id),
        sessionsAPI.getSessionSeats(id),
        concessionsAPI.getConcessionItems(),
      ]);
      setSession(sessionData);
      setSeats(seatsData);
      setConcessions(concessionsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Не удалось загрузить информацию о сеансе');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSelect = (seat) => {
    setSelectedSeats((prev) =>
      prev.includes(seat.id)
        ? prev.filter((id) => id !== seat.id)
        : [...prev, seat.id]
    );
  };

  const handleConcessionChange = (itemId, change) => {
    setSelectedConcessions((prev) => {
      const current = prev[itemId] || 0;
      const newValue = Math.max(0, current + change);
      if (newValue === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newValue };
    });
  };

  const calculateTotal = () => {
    // Стоимость билетов
    const ticketsTotal = selectedSeats.length * (session?.base_price || 0);

    // Стоимость товаров из кинобара
    const concessionsTotal = Object.entries(selectedConcessions).reduce(
      (sum, [itemId, quantity]) => {
        const item = concessions.find((c) => c.id === parseInt(itemId));
        return sum + (item?.price || 0) * quantity;
      },
      0
    );

    let total = ticketsTotal + concessionsTotal;

    // Вычитаем бонусы
    if (useBonuses && bonusAmount > 0) {
      total = Math.max(0, total - bonusAmount);
    }

    return { ticketsTotal, concessionsTotal, total };
  };

  const handleBooking = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (selectedSeats.length === 0) {
      setError('Выберите хотя бы одно место');
      return;
    }

    try {
      setBookingLoading(true);
      setError(null);

      const bookingData = {
        session_id: parseInt(id),
        seat_ids: selectedSeats,
        concession_items: Object.entries(selectedConcessions).map(([id, quantity]) => ({
          concession_id: parseInt(id),
          quantity,
        })),
        promo_code: promoCode || undefined,
        use_bonuses: useBonuses,
        bonus_amount: useBonuses ? bonusAmount : 0,
      };

      const booking = await bookingsAPI.createBooking(bookingData);

      // Создаем платеж
      await bookingsAPI.createPayment(booking.id, {
        amount: calculateTotal().total,
        payment_method: 'card',
      });

      // Перенаправляем на страницу с билетами
      navigate('/my-tickets');
    } catch (err) {
      console.error('Booking failed:', err);
      setError(err.response?.data?.detail || 'Не удалось создать бронирование');
    } finally {
      setBookingLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), 'd MMMM yyyy, HH:mm', { locale: ru });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return <Loading message="Загрузка информации о сеансе..." />;
  }

  if (error && !session) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const { ticketsTotal, concessionsTotal, total } = calculateTotal();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Левая колонка - выбор мест и кинобар */}
        <Grid item xs={12} lg={8}>
          {/* Информация о сеансе */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '1px solid rgba(229, 9, 20, 0.3)',
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  {session?.film?.title || 'Фильм'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<TimeIcon />}
                    label={formatDate(session?.start_time)}
                    sx={{ background: 'rgba(229, 9, 20, 0.2)' }}
                  />
                  <Chip
                    icon={<PlaceIcon />}
                    label={`${session?.hall?.cinema?.name}, Зал ${session?.hall?.name}`}
                    sx={{ background: 'rgba(255, 215, 0, 0.2)' }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
                <Typography variant="h6" color="text.secondary">
                  Цена билета
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#46d369' }}>
                  {session?.base_price} ₽
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Схема зала */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '1px solid rgba(229, 9, 20, 0.2)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Выберите места
            </Typography>
            <SeatMap
              seats={seats}
              selectedSeats={selectedSeats}
              onSeatSelect={handleSeatSelect}
            />
          </Paper>

          {/* Кинобар */}
          <Paper
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '1px solid rgba(229, 9, 20, 0.2)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Кинобар
            </Typography>
            <Grid container spacing={2}>
              {concessions.map((item) => (
                <Grid item xs={12} sm={6} key={item.id}>
                  <Card
                    sx={{
                      display: 'flex',
                      background: '#2a2a2a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <CardMedia
                      component="img"
                      sx={{ width: 100, objectFit: 'cover' }}
                      image={item.image_url || 'https://via.placeholder.com/100x100/2a2a2a/ffffff?text=Food'}
                      alt={item.name}
                    />
                    <CardContent sx={{ flex: 1, p: 2 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#46d369', fontWeight: 700 }}>
                        {item.price} ₽
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleConcessionChange(item.id, -1)}
                          disabled={!selectedConcessions[item.id]}
                          sx={{ background: 'rgba(229, 9, 20, 0.2)' }}
                        >
                          <RemoveIcon />
                        </IconButton>
                        <Typography sx={{ minWidth: 30, textAlign: 'center', fontWeight: 600 }}>
                          {selectedConcessions[item.id] || 0}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleConcessionChange(item.id, 1)}
                          sx={{ background: 'rgba(46, 125, 50, 0.2)' }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Правая колонка - итоговая информация */}
        <Grid item xs={12} lg={4}>
          <Paper
            sx={{
              p: 3,
              position: 'sticky',
              top: 80,
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '2px solid rgba(229, 9, 20, 0.3)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Ваш заказ
            </Typography>

            {/* Выбранные места */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Выбрано мест: {selectedSeats.length}
              </Typography>
              {selectedSeats.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {selectedSeats.map((seatId) => {
                    const seat = seats.find((s) => s.id === seatId);
                    return (
                      <Chip
                        key={seatId}
                        icon={<SeatIcon />}
                        label={`Ряд ${seat?.row_number}, Место ${seat?.seat_number}`}
                        size="small"
                        sx={{ background: 'rgba(33, 150, 243, 0.2)' }}
                      />
                    );
                  })}
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2, borderColor: 'rgba(229, 9, 20, 0.2)' }} />

            {/* Стоимость */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Билеты ({selectedSeats.length})</Typography>
                <Typography sx={{ fontWeight: 600 }}>{ticketsTotal} ₽</Typography>
              </Box>
              {concessionsTotal > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Кинобар</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{concessionsTotal} ₽</Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2, borderColor: 'rgba(229, 9, 20, 0.2)' }} />

            {/* Промокод */}
            <TextField
              fullWidth
              size="small"
              label="Промокод"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <PromoIcon sx={{ mr: 1, color: '#ffd700' }} />,
              }}
            />

            {/* Бонусы */}
            {isAuthenticated && user?.bonus_balance > 0 && (
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useBonuses}
                      onChange={(e) => setUseBonuses(e.target.checked)}
                    />
                  }
                  label={`Использовать бонусы (доступно: ${user.bonus_balance})`}
                />
                {useBonuses && (
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Количество бонусов"
                    value={bonusAmount}
                    onChange={(e) =>
                      setBonusAmount(Math.min(parseInt(e.target.value) || 0, user.bonus_balance, total))
                    }
                    inputProps={{ min: 0, max: Math.min(user.bonus_balance, total) }}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            )}

            <Divider sx={{ my: 2, borderColor: 'rgba(229, 9, 20, 0.2)' }} />

            {/* Итого */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Итого
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#46d369' }}>
                  {total} ₽
                </Typography>
              </Box>
            </Box>

            {/* Кнопка оплаты */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PaymentIcon />}
              onClick={handleBooking}
              disabled={selectedSeats.length === 0 || bookingLoading}
              sx={{
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(229, 9, 20, 0.4)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              {bookingLoading ? 'Обработка...' : 'Оплатить'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SessionBooking;
