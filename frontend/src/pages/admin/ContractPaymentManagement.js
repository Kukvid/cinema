import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { contractsAPI } from '../../api/contracts';
import { cinemasAPI } from '../../api/cinemas';

const ContractPaymentManagement = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinema, setSelectedCinema] = useState('');
  const [cinemaFilter, setCinemaFilter] = useState('');

  useEffect(() => {
    loadCinemas();
    loadPayments();
  }, [cinemaFilter]);

  const loadCinemas = async () => {
    try {
      if (user.role === 'super_admin') {
        const cinemasData = await cinemasAPI.getCinemas();
        setCinemas(cinemasData);
      } else if (user.cinema_id) {
        // For admin users, get only their cinema
        const cinemaData = await cinemasAPI.getCinemaById(user.cinema_id);
        setCinemas([cinemaData]);
        setSelectedCinema(user.cinema_id);
        setCinemaFilter(user.cinema_id);
      }
    } catch (err) {
      console.error('Error loading cinemas:', err);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      let paymentsData;
      if (user.role === 'super_admin' && cinemaFilter) {
        // Super admin with cinema filter
        paymentsData = await contractsAPI.getAllPayments(cinemaFilter);
      } else if (user.role === 'admin') {
        // Admin users see only their cinema's payments
        paymentsData = await contractsAPI.getAllPayments(selectedCinema);
      } else if (user.role === 'super_admin') {
        // Super admin without filter sees all payments
        paymentsData = await contractsAPI.getAllPayments();
      } else {
        // Other roles shouldn't be here due to route protection
        paymentsData = [];
      }

      setPayments(paymentsData);
    } catch (err) {
      console.error('Error loading payments:', err);
      setError('Ошибка при загрузке данных о платежах');
    } finally {
      setLoading(false);
    }
  };

  const handlePayPayment = async (paymentId) => {
    try {
      await contractsAPI.payContractPayment(paymentId);
      // Reload payments after successful payment
      loadPayments();
    } catch (err) {
      console.error('Error paying payment:', err);
      setError('Ошибка при оплате. Пожалуйста, попробуйте снова.');
    }
  };

  const handleCinemaChange = (event) => {
    const value = event.target.value;
    setCinemaFilter(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      // hour: '2-digit',
      // minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0.00 ₽';
    return parseFloat(amount).toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Управление платежами по контрактам
        </Typography>
      </Box>

      {/* Cinema Filter for Super Admin */}
      {user.role === 'super_admin' && (
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Фильтр по кинотеатру</InputLabel>
                <Select
                  value={cinemaFilter}
                  onChange={handleCinemaChange}
                  label="Фильтр по кинотеатру"
                >
                  <MenuItem value="">Все кинотеатры</MenuItem>
                  {cinemas.map((cinema) => (
                    <MenuItem key={cinema.id} value={cinema.id}>
                      {cinema.name} - {cinema.city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                {cinemaFilter
                  ? `Показаны платежи для кинотеатра: ${cinemas.find(c => c.id === parseInt(cinemaFilter))?.name || ''}`
                  : 'Показаны все платежи по всем кинотеатрам'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper
          sx={{
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
            border: '1px solid rgba(229, 9, 20, 0.2)',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      color: '#e50914',
                      fontWeight: 600,
                      borderBottom: '2px solid rgba(229, 9, 20, 0.3)',
                    },
                  }}
                >
                  <TableCell>ID Платежа</TableCell>
                  <TableCell>Контракт</TableCell>
                  <TableCell>Фильм</TableCell>
                  <TableCell>Дистрибьютор</TableCell>
                  <TableCell>Кинотеатр</TableCell>
                  <TableCell>Сумма</TableCell>
                  <TableCell>Дата расчета</TableCell>
                  <TableCell>Дата оплаты</TableCell>
                  <TableCell>Документ оплаты</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                      <Typography variant="h6" color="text.secondary">
                        Нет платежей
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      sx={{
                        '&:nth-of-type(odd)': {
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(229, 9, 20, 0.05)',
                        },
                      }}
                    >
                      <TableCell>{payment.id}</TableCell>
                      <TableCell>
                        {payment.rental_contract?.contract_number || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payment.rental_contract?.film?.title || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payment.rental_contract?.distributor?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payment.rental_contract?.cinema?.name || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffd700' }}>
                        {formatCurrency(payment.calculated_amount)}
                      </TableCell>
                      <TableCell>{formatDate(payment.calculation_date)}</TableCell>
                      <TableCell>{payment.payment_date ? formatDate(payment.payment_date) : '—'}</TableCell>
                      <TableCell>{payment.payment_document_number || '—'}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'inline-block',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: payment.payment_status === 'PENDING' ? '#e5091422' : '#46d36922',
                            color: payment.payment_status === 'PENDING' ? '#e50914' : '#46d369',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          {payment.payment_status === 'PENDING' ? 'Ожидает оплаты' : 'Оплачено'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {payment.payment_status === 'PENDING' ? (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handlePayPayment(payment.id)}
                            sx={{
                              backgroundColor: '#e50914',
                              '&:hover': {
                                backgroundColor: '#ff0a16',
                              },
                            }}
                          >
                            Оплатить
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Оплачено
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Container>
  );
};

export default ContractPaymentManagement;