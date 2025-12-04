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
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  ConfirmationNumber as TicketIcon,
  LocalCafe as ConcessionIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { ticketsAPI } from '../../api/tickets';
import { ordersAPI } from '../../api/orders';

const ControllerPage = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const handleScan = async () => {
    setError('');
    setSearchResult(null);

    if (!qrCode.trim()) {
      setError('Пожалуйста, введите QR-код или номер заказа');
      return;
    }

    try {
      // First try to validate as ticket QR code
      try {
        const ticketValidation = await ticketsAPI.validateTicket(qrCode);
        if (ticketValidation.is_valid) {
          setSearchResult({
            type: 'ticket',
            data: ticketValidation,
            order: ticketValidation.order
          });
          return;
        }
      } catch (ticketError) {
        // If ticket validation fails, try order validation
        try {
          const order = await ordersAPI.getOrderByQR(qrCode);
          if (order) {
            setSearchResult({
              type: 'order',
              data: order
            });
            return;
          }
        } catch (orderError) {
          // Both failed
        }
      }

      setError('QR-код недействителен или не найден');
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при проверке QR-кода');
    }
  };

  const handleMarkAsUsed = async (ticketId) => {
    try {
      await ticketsAPI.markTicketAsUsed(ticketId);
      // Refresh the search result
      if (searchResult && searchResult.type === 'ticket') {
        const ticketValidation = await ticketsAPI.validateTicket(qrCode);
        setSearchResult({
          type: 'ticket',
          data: ticketValidation,
          order: ticketValidation.order
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса билета');
    }
  };

  const getAllItemsUsed = (order) => {
    const allTicketsUsed = order.tickets?.every(ticket => ticket.status === 'used') || true;
    const allConcessionsUsed = order.concession_preorders?.every(item => item.status === 'completed') || true;
    return allTicketsUsed && allConcessionsUsed;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
          Контрольный пункт
        </Typography>

        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Сканирование QR-кода
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="QR-код или номер заказа"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Отсканируйте QR-код или введите номер заказа"
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
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {searchResult && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Результат проверки
            </Typography>
            
            {searchResult.type === 'ticket' && (
              <Box>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Билет действителен
                </Typography>
                <Card>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="h6" color="primary">
                          {searchResult.data.session?.film?.title || 'Фильм'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Ряд {searchResult.data.seat?.row_number}, Место {searchResult.data.seat?.seat_number}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Сеанс: {new Date(searchResult.data.session?.start_datetime).toLocaleString('ru-RU')}
                        </Typography>
                        <Chip
                          label={searchResult.data.status}
                          color={searchResult.data.status === 'used' ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2">Заказ:</Typography>
                        <Typography variant="body2">
                          #{searchResult.data.order?.order_number}
                        </Typography>
                        {!searchResult.data.used && (
                          <Button
                            variant="contained"
                            startIcon={<CheckIcon />}
                            onClick={() => handleMarkAsUsed(searchResult.data.id)}
                            sx={{ mt: 2 }}
                          >
                            Отметить как использованный
                          </Button>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}

            {searchResult.type === 'order' && (
              <Box>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Заказ: #{searchResult.data.order_number}
                </Typography>
                
                {/* Tickets Section */}
                <Typography variant="h6" sx={{ mt: 3, mb: 2, display: 'flex', alignItems: 'center' }}>
                  <TicketIcon sx={{ mr: 1, color: '#46d369' }} />
                  Билеты
                </Typography>
                <List>
                  {searchResult.data.tickets?.map((ticket, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <TicketIcon sx={{ color: '#46d369' }} />
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

                {/* Concession Items Section */}
                <Typography variant="h6" sx={{ mt: 3, mb: 2, display: 'flex', alignItems: 'center' }}>
                  <ConcessionIcon sx={{ mr: 1, color: '#ffd700' }} />
                  Товары из кинобара
                </Typography>
                <List>
                  {searchResult.data.concession_preorders?.map((item, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <ConcessionIcon sx={{ color: '#ffd700' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${item.concession_item?.name || 'Товар'} - ${item.quantity} шт.`}
                        secondary={`Статус: ${item.status} | Цена: ${item.total_price} ₽ | Код: ${item.pickup_code}`}
                      />
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
                    </ListItem>
                  ))}
                </List>

                {/* Order Status */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="h6">
                    Статус заказа: {getAllItemsUsed(searchResult.data) ? 'Завершён' : 'Активный'}
                  </Typography>
                  <Chip
                    label={getAllItemsUsed(searchResult.data) ? 'Завершён' : 'Активный'}
                    color={getAllItemsUsed(searchResult.data) ? 'success' : 'info'}
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default ControllerPage;