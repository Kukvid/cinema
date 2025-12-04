import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  LocalCafe as ConcessionIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { ordersAPI } from '../../api/orders';

const ConcessionStaffPage = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [pickupCode, setPickupCode] = useState('');

  const handleScan = async () => {
    setError('');
    setSearchResult(null);

    if (!qrCode.trim()) {
      setError('Пожалуйста, введите QR-код или номер заказа');
      return;
    }

    try {
      const order = await ordersAPI.getOrderByQR(qrCode);
      if (order) {
        setSearchResult(order);
      } else {
        setError('Заказ не найден');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при поиске заказа');
    }
  };

  const handleSearchByCode = async () => {
    setError('');
    setSearchResult(null);

    if (!pickupCode.trim()) {
      setError('Пожалуйста, введите код получения');
      return;
    }

    try {
      const orders = await ordersAPI.getOrdersByPickupCode(pickupCode);
      if (orders && orders.length > 0) {
        setSearchResult(orders[0]); // Take the first matching order
      } else {
        setError('Заказ с таким кодом не найден');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при поиске заказа');
    }
  };

  const handleMarkAsCompleted = async (preorderId) => {
    try {
      await ordersAPI.markConcessionItemAsCompleted(preorderId);
      // Refresh the search result
      const order = await ordersAPI.getOrderByQR(qrCode);
      if (order) {
        setSearchResult(order);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса товара');
    }
  };

  const getAllItemsUsed = (order) => {
    const allTicketsUsed = order.tickets?.every(ticket => ticket.status === 'used') || true;
    const allConcessionsUsed = order.concession_preorders?.every(item => item.status === 'completed') || true;
    return allTicketsUsed && allConcessionsUsed;
  };

  const updateOrderStatusIfNeeded = async (order) => {
    // Check if all items are used/complete and update order status
    const allItemsComplete = getAllItemsUsed(order);
    if (allItemsComplete && order.status !== 'completed') {
      try {
        await ordersAPI.updateOrderStatus(order.id, 'completed');
        // Update the search result
        setSearchResult(prev => ({ ...prev, status: 'completed' }));
      } catch (err) {
        console.error('Error updating order status:', err);
      }
    }
  };

  useEffect(() => {
    if (searchResult) {
      updateOrderStatusIfNeeded(searchResult);
    }
  }, [searchResult]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
          Работник кинобара
        </Typography>

        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Сканирование QR-кода заказа
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
            <TextField
              fullWidth
              label="QR-код заказа"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Отсканируйте QR-код заказа"
            />
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon />}
              onClick={handleScan}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)'
                }
              }}
            >
              Проверить
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Поиск по коду получения
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="Код получения"
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value)}
              placeholder="Введите код получения из заказа"
            />
            <Button
              variant="contained"
              startIcon={<ScheduleIcon />}
              onClick={handleSearchByCode}
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #33aaff 0%, #2196f3 100%)'
                }
              }}
            >
              Найти
            </Button>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {searchResult && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Заказ: #{searchResult.order_number}
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Статус заказа: {getAllItemsUsed(searchResult) ? 'Завершён' : searchResult.status}
            </Typography>
            
            <Chip
              label={getAllItemsUsed(searchResult) ? 'Завершён' : searchResult.status}
              color={getAllItemsUsed(searchResult) ? 'success' : 'info'}
              variant="outlined"
              sx={{ mb: 3 }}
            />

            {/* Concession Items Section */}
            <Typography variant="h6" sx={{ mt: 3, mb: 2, display: 'flex', alignItems: 'center' }}>
              <ConcessionIcon sx={{ mr: 1, color: '#ffd700' }} />
              Товары из кинобара
            </Typography>
            <List>
              {searchResult.concession_preorders?.map((item, index) => (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    <ConcessionIcon sx={{ color: item.status === 'completed' ? '#8bc34a' : '#ffd700' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${item.concession_item?.name || 'Товар'} - ${item.quantity} шт.`}
                    secondary={`Статус: ${item.status} | Цена: ${item.total_price} ₽ | Код получения: ${item.pickup_code}`}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={
                        item.status === 'completed' ? 'Выдан' : 
                        item.status === 'ready' ? 'Готов' : 
                        'В обработке'
                      }
                      color={
                        item.status === 'completed' ? 'success' : 
                        item.status === 'ready' ? 'info' : 
                        'default'
                      }
                      variant="outlined"
                    />
                    {item.status !== 'completed' && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<CheckIcon />}
                        onClick={() => handleMarkAsCompleted(item.id)}
                        disabled={item.status !== 'ready'}
                      >
                        Выдать
                      </Button>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>

            {/* Tickets Section (for reference) */}
            {searchResult.tickets && searchResult.tickets.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 3, mb: 2, display: 'flex', alignItems: 'center' }}>
                  <CheckIcon as TicketIcon sx={{ mr: 1, color: '#46d369' }} />
                  Билеты
                </Typography>
                <List>
                  {searchResult.tickets.map((ticket, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <CheckIcon as TicketIcon sx={{ color: ticket.status === 'used' ? '#8bc34a' : '#46d369' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${ticket.session?.film?.title || 'Фильм'} - Ряд ${ticket.seat?.row_number}, Место ${ticket.seat?.seat_number}`}
                        secondary={`Статус: ${ticket.status} | Цена: ${ticket.price} ₽`}
                      />
                      <Chip
                        label={ticket.status === 'used' ? 'Использован' : 'Доступен'}
                        color={ticket.status === 'used' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default ConcessionStaffPage;