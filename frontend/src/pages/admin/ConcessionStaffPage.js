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
import { qrScannerAPI } from '../../api/qrScanner';
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
      setError('Пожалуйста, введите QR-код');
      return;
    }

    try {
      // Try to validate as concession preorder first
      const validationResponse = await qrScannerAPI.validateConcession(qrCode);

      // Check if it's a single preorder or multiple items from an order
      if (validationResponse.concession_preorders) {
        // Multiple items from order QR code
        setSearchResult({
          type: 'multiple_concession',
          data: validationResponse,
          message: validationResponse.message,
          status: validationResponse.status
        });
      } else if (validationResponse.preorder) {
        // Single preorder
        setSearchResult({
          type: 'concession',
          data: validationResponse.preorder,
          message: validationResponse.message,
          status: validationResponse.status,
          is_valid: validationResponse.is_valid
        });
      } else {
        setError(validationResponse.message || 'Предзаказ не найден');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'QR-код недействителен или не найден');
    }
  };

  const handleMarkAsCompleted = async (preorderId) => {
    try {
      await ordersAPI.markConcessionItemAsCompleted(preorderId);
      // Refresh the validation by re-scanning the QR code
      const validationResponse = await qrScannerAPI.validateConcession(qrCode);

      // Check if it's a single preorder or multiple items from an order
      if (validationResponse.concession_preorders) {
        // Multiple items from order QR code
        setSearchResult({
          type: 'multiple_concession',
          data: validationResponse,
          message: validationResponse.message,
          status: validationResponse.status
        });
      } else if (validationResponse.preorder) {
        // Single preorder
        setSearchResult({
          type: 'concession',
          data: validationResponse.preorder,
          message: validationResponse.message,
          status: validationResponse.status,
          is_valid: validationResponse.is_valid
        });
      } else {
        setError(validationResponse.message || 'Предзаказ не найден');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса товара');
    }
  };

  const handleMarkAllAsCompleted = async (preorderIds) => {
    try {
      // Mark all items as completed
      const promises = preorderIds.map(preorderId => ordersAPI.markConcessionItemAsCompleted(preorderId));
      await Promise.all(promises);

      // Refresh the validation by re-scanning the QR code
      const validationResponse = await qrScannerAPI.validateConcession(qrCode);

      // Check if it's a single preorder or multiple items from an order
      if (validationResponse.concession_preorders) {
        // Multiple items from order QR code
        setSearchResult({
          type: 'multiple_concession',
          data: validationResponse,
          message: validationResponse.message,
          status: validationResponse.status
        });
      } else if (validationResponse.preorder) {
        // Single preorder
        setSearchResult({
          type: 'concession',
          data: validationResponse.preorder,
          message: validationResponse.message,
          status: validationResponse.status,
          is_valid: validationResponse.is_valid
        });
      } else {
        setError(validationResponse.message || 'Предзаказ не найден');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при обновлении статуса товаров');
    }
  };

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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
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
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {searchResult && (
          <Paper sx={{ p: 3 }}>
            {/* Handle single concession item */}
            {searchResult.type === 'concession' && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Предзаказ из кинобара
                </Typography>
                {searchResult.is_valid !== undefined ? (  // This means it's from QR validation
                  <Box sx={{ mb: 3 }}>
                    {searchResult.is_valid ? (
                      <Typography variant="body1">
                        {searchResult.message}
                      </Typography>
                    ) : (
                      <Alert severity="info">
                        {searchResult.message || 'Предзаказ уже выдан или недействителен'}
                      </Alert>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    {searchResult.message}
                  </Typography>
                )}

                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="h6" color="primary">
                          {searchResult.data.concession_item_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Количество: {searchResult.data.quantity} шт.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Статус: {searchResult.data.status}
                        </Typography>
                        {/* <Typography variant="body2" color="text.secondary">
                          Код получения: {searchResult.data.pickup_code}
                        </Typography> */}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2">Заказ:</Typography>
                        <Typography variant="body2">
                          ID: #{searchResult.data.order_id}
                        </Typography>
                        <Chip
                          label={searchResult.data.status === 'completed' ? 'Выдан' : 'Готов к выдаче'}
                          color={searchResult.data.status === 'completed' ? 'success' : 'warning'}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                        {searchResult.data.status !== 'completed' ? (
                          <Button
                            variant="contained"
                            startIcon={<CheckIcon />}
                            onClick={() => handleMarkAsCompleted(searchResult.data.id)}
                            sx={{ mt: 2 }}
                          >
                            Отметить как выданное
                          </Button>
                        ) : (
                          <Alert severity="success" sx={{ mt: 2 }}>
                            Товар уже выдан
                          </Alert>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Handle multiple concession items from order */}
            {searchResult.type === 'multiple_concession' && searchResult.data.concession_preorders && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Товары из кинобара
                </Typography>

                {/* Check if order is cancelled/refunded */}
                {searchResult.data.status === 'order_cancelled_or_refunded' && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {searchResult.data.message}
                  </Alert>
                )}

                {/* Common order info */}
                {searchResult.data.concession_preorders.length > 0 && (
                  <>
                    <Card sx={{ mb: 2 }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={8}>
                            <Typography variant="h6" color="primary">
                              Заказ: #{searchResult.data.order?.order_number || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Статус заказа: {searchResult.data.order?.status === 'refunded' ? 'Возвращен' :
                                              searchResult.data.order?.status === 'cancelled' ? 'Отменен' :
                                              searchResult.data.order?.status === 'paid' ? 'Оплачен' : searchResult.data.order?.status}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2">Всего товаров:</Typography>
                            <Typography variant="body2">
                              {searchResult.data.concession_preorders.length} шт.
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>

                    {/* Concession items list */}
                    <List>
                      {searchResult.data.concession_preorders.map((item, index) => (
                        <ListItem key={item.id} divider>
                          <ListItemIcon>
                            <ConcessionIcon sx={{ color: item.status === 'COMPLETED' ? '#8bc34a' : '#ffd700' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${item.concession_item_name} - ${item.quantity} шт.`}
                            secondary={`Статус: ${item.status === 'COMPLETED' ? 'Выдан' : 'Готов к выдаче'}`}
                          />
                          <Chip
                            label={item.status === 'COMPLETED' ? 'Выдан' : 'Готов к выдаче'}
                            color={item.status === 'COMPLETED' ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </ListItem>
                      ))}
                    </List>

                    {/* Mark all as completed button if not all items are completed and order is not cancelled */}
                    {searchResult.data.status !== 'order_cancelled_or_refunded' &&
                     searchResult.data.concession_preorders.some(item => item.status !== 'COMPLETED') && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                          variant="contained"
                          startIcon={<CheckIcon />}
                          onClick={() => handleMarkAllAsCompleted(searchResult.data.concession_preorders.map(i => i.id))}
                          sx={{ py: 1.5 }}
                        >
                          Отметить все товары как выданные
                        </Button>
                      </Box>
                    )}

                    {searchResult.data.concession_preorders.every(item => item.status === 'COMPLETED') && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        Все товары уже отмечены как выданные
                      </Alert>
                    )}
                  </>
                )}
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default ConcessionStaffPage;