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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import Loading from '../../components/Loading';
import { cinemasAPI } from '../../api/cinemas';
import { useForm } from 'react-hook-form';

const CinemasManage = () => {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    loadCinemas();
  }, []);

  const loadCinemas = async () => {
    try {
      setLoading(true);
      const data = await cinemasAPI.getCinemas();
      setCinemas(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить кинотеатры');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (cinema = null) => {
    setEditingCinema(cinema);
    if (cinema) {
      reset(cinema);
    } else {
      reset({ name: '', address: '', phone: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCinema(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      setFormLoading(true);
      if (editingCinema) {
        await cinemasAPI.updateCinema(editingCinema.id, data);
      } else {
        await cinemasAPI.createCinema(data);
      }
      await loadCinemas();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить кинотеатр');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить кинотеатр?')) {
      try {
        await cinemasAPI.deleteCinema(id);
        await loadCinemas();
      } catch (err) {
        setError('Не удалось удалить кинотеатр');
      }
    }
  };

  if (loading) {
    return <Loading message="Загрузка кинотеатров..." />;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Управление кинотеатрами
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
          }}
        >
          Добавить кинотеатр
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <TableContainer
        component={Paper}
        sx={{
          background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
          border: '1px solid rgba(229, 9, 20, 0.2)',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ background: 'rgba(229, 9, 20, 0.1)' }}>
              <TableCell sx={{ fontWeight: 600 }}>Название</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Адрес</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Телефон</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cinemas.map((cinema) => (
              <TableRow key={cinema.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlaceIcon sx={{ color: '#e50914' }} />
                    {cinema.name}
                  </Box>
                </TableCell>
                <TableCell>{cinema.address}</TableCell>
                <TableCell>{cinema.phone}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(cinema)} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(cinema.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCinema ? 'Редактировать кинотеатр' : 'Добавить кинотеатр'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <TextField
              fullWidth
              label="Название"
              margin="normal"
              {...register('name', { required: 'Название обязательно' })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <TextField
              fullWidth
              label="Адрес"
              margin="normal"
              {...register('address', { required: 'Адрес обязателен' })}
              error={!!errors.address}
              helperText={errors.address?.message}
            />
            <TextField
              fullWidth
              label="Телефон"
              margin="normal"
              {...register('phone')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Отмена</Button>
            <Button type="submit" variant="contained" disabled={formLoading}>
              {formLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default CinemasManage;
