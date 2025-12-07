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
import { qrScannerAPI } from '../../api/qrScanner';

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
      // First try to validate as ticket QR code using the new QR scanner API
      const ticketValidation = await qrScannerAPI.validateTicket(qrCode);
      if (ticketValidation.is_valid) {
        setSearchResult({
          type: 'ticket',
          data: ticketValidation
        });
        return;
      }
      // Ticket validation will throw error if not found, so we'll catch it and try order
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
  };

  const handleMarkAsUsed = async (ticketId) => {
    try {
      await ticketsAPI.markTicketAsUsed(ticketId);
      // Refresh the search result
      if (searchResult && searchResult.type === 'ticket') {
        const ticketValidation = await qrScannerAPI.validateTicket(qrCode);
        setSearchResult({
          type: 'ticket',
          data: ticketValidation,
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса билета');
    }
  };

  const handleMarkAllTicketsAsUsed = async (ticketIds) => {
    try {
      // Mark all tickets as used
      const promises = ticketIds.map(ticketId => ticketsAPI.markTicketAsUsed(ticketId));
      await Promise.all(promises);

      // Refresh the search result
      if (searchResult && searchResult.type === 'ticket') {
        const ticketValidation = await qrScannerAPI.validateTicket(qrCode);
        setSearchResult({
          type: 'ticket',
          data: ticketValidation,
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса билетов');
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
                {/* Handle single ticket */}
                {searchResult.data.ticket && !searchResult.data.tickets && (
                  <Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      Билет действителен
                    </Typography>
                    <Card>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="h6" color="primary">
                              {searchResult.data.ticket?.session?.film?.title || 'Фильм'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Ряд {searchResult.data.ticket?.seat?.row_number}, Место {searchResult.data.ticket?.seat?.seat_number}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Сеанс: {new Date(searchResult.data.ticket?.session?.start_datetime).toLocaleString('ru-RU')}
                            </Typography>
                            <Chip
                              label={searchResult.data.ticket?.status === 'USED' ? 'Использован' : searchResult.data.ticket?.status === 'RESERVED' ? 'Забронирован' : searchResult.data.ticket?.status === 'PAID' ? 'Оплачен' : searchResult.data.ticket?.status}
                              color={searchResult.data.ticket?.status === 'USED' ? 'success' : 'default'}
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2">Заказ:</Typography>
                            <Typography variant="body2">
                              #{searchResult.data.order?.order_number}
                            </Typography>
                            {/* Check if session has ended for single ticket */}
                            {(() => {
                              const sessionEnd = new Date(searchResult.data.ticket?.session?.end_datetime);
                              const currentTime = new Date();
                              const sessionEnded = sessionEnd < currentTime;

                              return (
                                <>
                                  {sessionEnded && (
                                    <Alert severity="warning" sx={{ mt: 1 }}>
                                      Сеанс уже завершён
                                    </Alert>
                                  )}
                                  {searchResult.data.ticket?.status !== 'USED' && !sessionEnded && (
                                    <Button
                                      variant="contained"
                                      startIcon={<CheckIcon />}
                                      onClick={() => handleMarkAsUsed(searchResult.data.ticket.id)}
                                      sx={{ mt: 2 }}
                                    >
                                      Отметить как использованный
                                    </Button>
                                  )}
                                  {searchResult.data.ticket?.status === 'USED' && (
                                    <Alert severity="success" sx={{ mt: 2 }}>
                                      Билет уже использован
                                    </Alert>
                                  )}
                                </>
                              );
                            })()}
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Box>
                )}

                {/* Handle multiple tickets from order */}
                {searchResult.data.tickets && (
                  <Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {searchResult.data.message}
                    </Typography>

                    {/* Check if order is cancelled/refunded */}
                    {searchResult.data.status === 'order_cancelled_or_refunded' && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {searchResult.data.message}
                      </Alert>
                    )}

                    {/* Common session info */}
                    {searchResult.data.tickets.length > 0 && (
                      <>
                        <Card sx={{ mb: 2 }}>
                          <CardContent>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={8}>
                                <Typography variant="h6" color="primary">
                                  {searchResult.data.tickets[0]?.session?.film?.title || 'Фильм'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Сеанс: {new Date(searchResult.data.tickets[0]?.session?.start_datetime).toLocaleString('ru-RU')}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Typography variant="subtitle2">Заказ:</Typography>
                                <Typography variant="body2">
                                  #{searchResult.data.order?.order_number}
                                </Typography>
                                <Typography variant="body2">
                                  Статус: {searchResult.data.order?.status === 'refunded' ? 'Возвращен' :
                                          searchResult.data.order?.status === 'cancelled' ? 'Отменен' :
                                          searchResult.data.order?.status === 'paid' ? 'Оплачен' :
                                          searchResult.data.order?.status}
                                </Typography>
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>

                        {/* Tickets list */}
                        <List>
                          {searchResult.data.tickets.map((ticket, index) => (
                            <ListItem key={ticket.id} divider>
                              <ListItemIcon>
                                <TicketIcon sx={{ color: ticket.status === 'USED' ? '#8bc34a' : '#46d369' }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={`Ряд ${ticket.seat?.row_number}, Место ${ticket.seat?.seat_number}`}
                                secondary={`Статус: ${ticket.status === 'USED' ? 'Использован' : ticket.status === 'RESERVED' ? 'Забронирован' : ticket.status === 'PAID' ? 'Оплачен' : ticket.status}`}
                              />
                              <Chip
                                label={ticket.status === 'USED' ? 'Использован' : ticket.status === 'RESERVED' ? 'Забронирован' : ticket.status === 'PAID' ? 'Оплачен' : ticket.status}
                                color={ticket.status === 'USED' ? 'success' : 'default'}
                                variant="outlined"
                              />
                            </ListItem>
                          ))}
                        </List>

                        {/* Check if session has ended */}
                        {searchResult.data.tickets.length > 0 && (() => {
                          const sessionEnd = new Date(searchResult.data.tickets[0].session?.end_datetime);
                          const currentTime = new Date();
                          return sessionEnd < currentTime ? (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                              Сеанс уже завершён
                            </Alert>
                          ) : null;
                        })()}

                        {/* Mark all as used button if not all tickets are used and order is not cancelled */}
                        {searchResult.data.status !== 'order_cancelled_or_refunded' &&
                         searchResult.data.can_be_used !== false && (
                          <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Button
                              variant="contained"
                              startIcon={<CheckIcon />}
                              onClick={() => handleMarkAllTicketsAsUsed(searchResult.data.tickets.map(t => t.id))}
                              sx={{ py: 1.5 }}
                            >
                              Отметить все билеты как использованные
                            </Button>
                          </Box>
                        )}

                        {searchResult.data.tickets.every(ticket => ticket.status === 'USED') && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            Все билеты уже отмечены как использованные
                          </Alert>
                        )}
                      </>
                    )}
                  </Box>
                )}
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

                {/* Check if session has ended for tickets in order */}
                {searchResult.data.tickets && searchResult.data.tickets.length > 0 && (() => {
                  const sessionEnd = new Date(searchResult.data.tickets[0]?.session?.end_datetime);
                  const currentTime = new Date();
                  return sessionEnd < currentTime ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Сеанс уже завершён
                    </Alert>
                  ) : null;
                })()}

                <List>
                  {searchResult.data.tickets?.map((ticket, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <TicketIcon sx={{ color: ticket.status === 'used' ? '#8bc34a' : '#46d369' }} />
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
                          item.status === 'pending' ? 'В обработке' :
                          item.status
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