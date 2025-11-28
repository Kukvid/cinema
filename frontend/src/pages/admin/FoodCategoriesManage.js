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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import Loading from '../../components/Loading';
import {
  getFoodCategories,
  createFoodCategory,
  updateFoodCategory,
  deleteFoodCategory,
} from '../../api/foodCategories';
import { useForm } from 'react-hook-form';

const FoodCategoriesManage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getFoodCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить категории');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category = null) => {
    setEditingCategory(category);
    if (category) {
      reset({
        name: category.name,
        display_order: category.display_order,
      });
    } else {
      reset({
        name: '',
        display_order: categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) + 1 : 1,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      setFormLoading(true);
      setError(null);

      const categoryData = {
        name: data.name,
        display_order: parseInt(data.display_order),
      };

      if (editingCategory) {
        await updateFoodCategory(editingCategory.id, categoryData);
        setSuccess('Категория успешно обновлена');
      } else {
        await createFoodCategory(categoryData);
        setSuccess('Категория успешно создана');
      }

      await loadCategories();
      handleCloseDialog();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить категорию');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Вы уверены, что хотите удалить категорию "${name}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteFoodCategory(id);
      setSuccess('Категория успешно удалена');
      await loadCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить категорию');
      console.error(err);
    }
  };

  const handleChangeOrder = async (category, direction) => {
    try {
      const newOrder = direction === 'up'
        ? category.display_order - 1
        : category.display_order + 1;

      await updateFoodCategory(category.id, { display_order: newOrder });
      await loadCategories();
    } catch (err) {
      setError('Не удалось изменить порядок');
      console.error(err);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#e50914' }}>
          Управление категориями еды
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
          Добавить категорию
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
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Название</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }}>Порядок отображения</TableCell>
              <TableCell sx={{ color: '#e50914', fontWeight: 700 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Категории не найдены. Создайте первую категорию.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow
                  key={category.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(229, 9, 20, 0.1)',
                    },
                  }}
                >
                  <TableCell>{category.id}</TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {category.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={category.display_order}
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.3) 0%, rgba(229, 9, 20, 0.1) 100%)',
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleChangeOrder(category, 'up')}
                        disabled={category.display_order <= 1}
                        sx={{ color: '#ffd700' }}
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleChangeOrder(category, 'down')}
                        sx={{ color: '#ffd700' }}
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => handleOpenDialog(category)}
                      sx={{ color: '#46d369', mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(category.id, category.name)}
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
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#e50914', fontWeight: 700 }}>
          {editingCategory ? 'Редактировать категорию' : 'Создать категорию'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Название категории"
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
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Порядок отображения"
              type="number"
              fullWidth
              variant="outlined"
              {...register('display_order', {
                required: 'Порядок отображения обязателен',
                min: {
                  value: 0,
                  message: 'Минимальное значение - 0',
                },
              })}
              error={!!errors.display_order}
              helperText={errors.display_order?.message || 'Чем меньше число, тем выше категория в списке'}
            />
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

export default FoodCategoriesManage;
