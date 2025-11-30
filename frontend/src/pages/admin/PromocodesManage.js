import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as PromoIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import Loading from '../../components/Loading';
import {
  getPromocodes,
  createPromocode,
  updatePromocode,
  deletePromocode,
} from '../../api/promocodes';
import { useForm } from 'react-hook-form';

const PromocodesManage = () => {
  const [promocodes, setPromocodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromocode, setEditingPromocode] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();

  const discountType = watch('discount_type', 'percentage');

  useEffect(() => {
    loadPromocodes();
  }, []);

  const loadPromocodes = async () => {
    try {
      setLoading(true);
      const data = await getPromocodes();
      setPromocodes(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить промокоды');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (promocode = null) => {
    setEditingPromocode(promocode);
    if (promocode) {
      reset({
        code: promocode.code,
        discount_type: promocode.discount_type,
        discount_value: promocode.discount_value,
        min_order_amount: promocode.min_order_amount || '',
        max_uses: promocode.max_uses || '',
        valid_from: promocode.valid_from ? promocode.valid_from.split('T')[0] : '',
        valid_until: promocode.valid_until ? promocode.valid_until.split('T')[0] : '',
        category: promocode.category || '',
        is_active: promocode.is_active,
      });
    } else {
      reset({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_amount: '',
        max_uses: '',
        valid_from: '',
        valid_until: '',
        category: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPromocode(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      setFormLoading(true);
      setError(null);

      const promocodeData = {
        code: data.code.toUpperCase(),
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        min_order_amount: data.min_order_amount ? parseFloat(data.min_order_amount) : null,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        valid_from: data.valid_from ? `${data.valid_from}T00:00:00` : null,
        valid_until: data.valid_until ? `${data.valid_until}T23:59:59` : null,
        category: data.category || null,
        is_active: data.is_active !== false,
      };

      if (editingPromocode) {
        await updatePromocode(editingPromocode.id, promocodeData);
        setSuccess('Промокод успешно обновлён');
      } else {
        await createPromocode(promocodeData);
        setSuccess('Промокод успешно создан');
      }

      await loadPromocodes();
      handleCloseDialog();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить промокод');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Вы уверены, что хотите удалить промокод "${code}"?`)) {
      return;
    }

    try {
      setError(null);
      await deletePromocode(id);
      setSuccess('Промокод успешно удалён');
      await loadPromocodes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить промокод');
      console.error(err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: '#46d369',
      EXPIRED: '#e50914',
      DEPLETED: '#ff9800',
      INACTIVE: '#757575',
    };
    return colors[status] || '#757575';
  };

  const getStatusLabel = (status) => {
    const labels = {
      ACTIVE: 'Активен',
      EXPIRED: 'Истёк',
      DEPLETED: 'Исчерпан',
      INACTIVE: 'Неактивен',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return format(parseISO(dateString), 'd MMM yyyy', { locale: ru });
    } catch {
      return dateString;
    }
  };

  const filteredPromocodes = promocodes.filter((promo) => {
    if (statusFilter === 'all') return true;
    return promo.status === statusFilter;
  });

  if (loading) {
    return <Loading />;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#e50914' }}>
          Управление промокодами
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
            },
          }}
        >
          Добавить промокод
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Фильтр по статусу</InputLabel>
          <Select
            value={statusFilter}
            label="Фильтр по статусу"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="ACTIVE">Активные</MenuItem>
            <MenuItem value="EXPIRED">Истёкшие</MenuItem>
            <MenuItem value="DEPLETED">Исчерпанные</MenuItem>
            <MenuItem value="INACTIVE">Неактивные</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} sx={{ background: 'rgba(31, 31, 31, 0.8)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Код</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Скидка</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Мин. сумма</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Использований</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Срок действия</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Категория</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Статус</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPromocodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    {statusFilter === 'all'
                      ? 'Промокоды не найдены. Создайте первый промокод.'
                      : 'Промокоды с данным статусом не найдены.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredPromocodes.map((promocode) => (
                <TableRow
                  key={promocode.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(229, 9, 20, 0.1)',
                    },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PromoIcon sx={{ color: '#ffd700' }} />
                      <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {promocode.code}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#46d369' }}>
                      {promocode.discount_value}
                      {promocode.discount_type === 'percentage' ? '%' : '₽'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {promocode.min_order_amount ? `${promocode.min_order_amount}₽` : '—'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {promocode.used_count}
                      {promocode.max_uses ? ` / ${promocode.max_uses}` : ' / ∞'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(promocode.valid_from)} — {formatDate(promocode.valid_until)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {promocode.category ? (
                      <Chip
                        label={promocode.category}
                        size="small"
                        sx={{
                          background: 'rgba(33, 150, 243, 0.2)',
                          color: '#2196f3',
                        }}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(promocode.status)}
                      size="small"
                      sx={{
                        background: `${getStatusColor(promocode.status)}33`,
                        color: getStatusColor(promocode.status),
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => handleOpenDialog(promocode)}
                      sx={{ color: '#46d369', mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(promocode.id, promocode.code)}
                      sx={{ color: '#e50914' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Диалог создания/редактирования */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#e50914', fontWeight: 700 }}>
          {editingPromocode ? 'Редактировать промокод' : 'Создать промокод'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                autoFocus
                margin="dense"
                label="Код промокода"
                type="text"
                fullWidth
                variant="outlined"
                {...register('code', {
                  required: 'Код обязателен',
                  minLength: {
                    value: 3,
                    message: 'Минимальная длина - 3 символа',
                  },
                  maxLength: {
                    value: 50,
                    message: 'Максимальная длина - 50 символов',
                  },
                  pattern: {
                    value: /^[A-Z0-9_-]+$/i,
                    message: 'Только латиница, цифры, дефис и подчёркивание',
                  },
                })}
                error={!!errors.code}
                helperText={errors.code?.message || 'Латиница, цифры, - и _'}
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />

              <FormControl fullWidth margin="dense" error={!!errors.discount_type}>
                <InputLabel>Тип скидки</InputLabel>
                <Select
                  label="Тип скидки"
                  defaultValue="percentage"
                  {...register('discount_type', { required: 'Тип скидки обязателен' })}
                >
                  <MenuItem value="percentage">Процент (%)</MenuItem>
                  <MenuItem value="fixed">Фиксированная сумма (₽)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                margin="dense"
                label="Размер скидки"
                type="number"
                fullWidth
                variant="outlined"
                {...register('discount_value', {
                  required: 'Размер скидки обязателен',
                  min: {
                    value: 0.01,
                    message: 'Минимальное значение - 0.01',
                  },
                  max: {
                    value: discountType === 'percentage' ? 100 : 999999,
                    message: discountType === 'percentage'
                      ? 'Максимальное значение - 100%'
                      : 'Слишком большое значение',
                  },
                })}
                error={!!errors.discount_value}
                helperText={errors.discount_value?.message}
                inputProps={{ step: '0.01' }}
              />

              <TextField
                margin="dense"
                label="Минимальная сумма заказа"
                type="number"
                fullWidth
                variant="outlined"
                {...register('min_order_amount', {
                  min: {
                    value: 0,
                    message: 'Минимальное значение - 0',
                  },
                })}
                error={!!errors.min_order_amount}
                helperText={errors.min_order_amount?.message || 'Оставьте пустым для любой суммы'}
                inputProps={{ step: '0.01' }}
              />

              <TextField
                margin="dense"
                label="Максимальное количество использований"
                type="number"
                fullWidth
                variant="outlined"
                {...register('max_uses', {
                  min: {
                    value: 1,
                    message: 'Минимальное значение - 1',
                  },
                })}
                error={!!errors.max_uses}
                helperText={errors.max_uses?.message || 'Оставьте пустым для неограниченного'}
              />

              <TextField
                margin="dense"
                label="Категория"
                type="text"
                fullWidth
                variant="outlined"
                {...register('category', {
                  maxLength: {
                    value: 50,
                    message: 'Максимальная длина - 50 символов',
                  },
                })}
                error={!!errors.category}
                helperText={errors.category?.message || 'Опционально (например: tickets, food)'}
              />

              <TextField
                margin="dense"
                label="Действителен с"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                {...register('valid_from')}
                helperText="Оставьте пустым, если нет ограничения"
              />

              <TextField
                margin="dense"
                label="Действителен до"
                type="date"
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                {...register('valid_until')}
                helperText="Оставьте пустым, если нет ограничения"
              />

              <FormControl fullWidth margin="dense">
                <InputLabel>Статус</InputLabel>
                <Select
                  label="Статус"
                  defaultValue={true}
                  {...register('is_active')}
                >
                  <MenuItem value={true}>Активен</MenuItem>
                  <MenuItem value={false}>Неактивен</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog} sx={{ color: '#fff' }}>
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formLoading}
              sx={{
                background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
                },
              }}
            >
              {formLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default PromocodesManage;
