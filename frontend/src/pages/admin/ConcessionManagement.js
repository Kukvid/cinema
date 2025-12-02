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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Fastfood as FoodIcon,
} from '@mui/icons-material';
import Loading from '../../components/Loading';
import { concessionsAPI } from '../../api/concessions';
import * as foodCategoriesAPI from '../../api/foodCategories';
import { useForm } from 'react-hook-form';

const ConcessionManagement = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch
  } = useForm();

  const watchedCategoryId = watch('category_id');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, categoriesData] = await Promise.all([
        concessionsAPI.getConcessionItems(),
        foodCategoriesAPI.getFoodCategories()
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить данные кинобара');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (item = null) => {
    setEditingItem(item);
    if (item) {
      reset({
        name: item.name,
        description: item.description,
        price: item.price,
        category_id: item.category_id,
        is_available: item.is_available,
        stock_quantity: item.stock_quantity,
        image_url: item.image_url || ''
      });
    } else {
      reset({
        name: '',
        description: '',
        price: '',
        category_id: '',
        is_available: true,
        stock_quantity: 0,
        image_url: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      setFormLoading(true);
      setError(null);

      const itemData = {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        category_id: parseInt(data.category_id),
        is_available: data.is_available,
        stock_quantity: parseInt(data.stock_quantity),
        image_url: data.image_url || null
      };

      if (editingItem) {
        await concessionsAPI.updateConcessionItem(editingItem.id, itemData);
        setSuccess('Товар успешно обновлен');
      } else {
        await concessionsAPI.createConcessionItem(itemData);
        setSuccess('Товар успешно создан');
      }

      await loadData();
      handleCloseDialog();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить товар');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Вы уверены, что хотите удалить товар "${name}"?`)) {
      return;
    }

    try {
      setError(null);
      await concessionsAPI.deleteConcessionItem(id);
      setSuccess('Товар успешно удален');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить товар');
      console.error(err);
    }
  };

  if (loading) {
    return <Loading message="Загрузка товаров кинобара..." />;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#e50914' }}>
          Управление кинобаром
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
          Добавить товар
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

      <TableContainer component={Paper} sx={{ background: 'rgba(31, 31, 31, 0.8)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Товар</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Категория</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Цена</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Наличие</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>На складе</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Товары не найдены. Создайте первый товар.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(229, 9, 20, 0.1)',
                    },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FoodIcon sx={{ color: '#ffd700' }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.description}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.category ? (
                      <Chip
                        label={item.category.name}
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.3) 0%, rgba(229, 9, 20, 0.1) 100%)',
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      />
                    ) : (
                      'Нет категории'
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#46d369' }}>
                      {item.price} ₽
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.is_available ? 'Доступен' : 'Недоступен'}
                      size="small"
                      color={item.is_available ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.stock_quantity}
                      size="small"
                      sx={{
                        background: item.stock_quantity > 10 
                          ? 'linear-gradient(135deg, rgba(70, 211, 105, 0.3) 0%, rgba(70, 211, 105, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(245, 124, 0, 0.3) 0%, rgba(245, 124, 0, 0.1) 100%)',
                        color: item.stock_quantity > 10 ? '#46d369' : '#f57c00',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => handleOpenDialog(item)}
                      sx={{ color: '#46d369', mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(item.id, item.name)}
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
          {editingItem ? 'Редактировать товар' : 'Создать товар'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Название товара"
                  type="text"
                  fullWidth
                  variant="outlined"
                  {...register('name', {
                    required: 'Название обязательно',
                    minLength: {
                      value: 1,
                      message: 'Минимальная длина - 1 символ',
                    },
                    maxLength: {
                      value: 100,
                      message: 'Максимальная длина - 100 символов',
                    },
                  })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  label="Описание"
                  type="text"
                  fullWidth
                  variant="outlined"
                  multiline
                  rows={2}
                  {...register('description', {
                    maxLength: {
                      value: 500,
                      message: 'Максимальная длина - 500 символов',
                    },
                  })}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  margin="dense"
                  label="Цена (₽)"
                  type="number"
                  fullWidth
                  variant="outlined"
                  inputProps={{ step: "0.01" }}
                  {...register('price', {
                    required: 'Цена обязательна',
                    min: {
                      value: 0,
                      message: 'Цена не может быть отрицательной',
                    },
                    max: {
                      value: 999999,
                      message: 'Цена слишком большая',
                    },
                  })}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="dense" error={!!errors.category_id}>
                  <InputLabel>Категория</InputLabel>
                  <Select
                    label="Категория"
                    {...register('category_id', {
                      required: 'Категория обязательна',
                      validate: (value) => value !== '' || 'Категория обязательна',
                    })}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.category_id && (
                    <Typography variant="caption" color="error">
                      {errors.category_id.message}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  margin="dense"
                  label="Количество на складе"
                  type="number"
                  fullWidth
                  variant="outlined"
                  {...register('stock_quantity', {
                    required: 'Количество обязательно',
                    min: {
                      value: 0,
                      message: 'Количество не может быть отрицательным',
                    },
                  })}
                  error={!!errors.stock_quantity}
                  helperText={errors.stock_quantity?.message}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={watch('is_available') || false}
                      onChange={(e) => setValue('is_available', e.target.checked)}
                      color="success"
                    />
                  }
                  label="Доступен для продажи"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  margin="dense"
                  label="Ссылка на изображение (опционально)"
                  type="text"
                  fullWidth
                  variant="outlined"
                  {...register('image_url')}
                  placeholder="https://example.com/image.jpg"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleCloseDialog}
              sx={{ color: '#fff' }}
            >
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

export default ConcessionManagement;