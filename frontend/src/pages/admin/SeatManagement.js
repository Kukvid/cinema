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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { seatsAPI } from '../../api/seats';
import { hallsAPI } from '../../api/halls';
import Loading from '../../components/Loading';

const SeatManagement = () => {
  const [seats, setSeats] = useState([]);
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [formData, setFormData] = useState({
    hall_id: '',
    row_number: 0,
    seat_number: 0,
    is_aisle: false,
    is_available: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [seatsData, hallsData] = await Promise.all([
        seatsAPI.getSeats(),
        hallsAPI.getHalls()
      ]);
      setSeats(seatsData);
      setHalls(hallsData);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (seat = null) => {
    if (seat) {
      setEditingSeat(seat);
      setFormData({
        hall_id: seat.hall_id || '',
        row_number: seat.row_number || 0,
        seat_number: seat.seat_number || 0,
        is_aisle: seat.is_aisle || false,
        is_available: seat.is_available || true
      });
    } else {
      setEditingSeat(null);
      setFormData({
        hall_id: '',
        row_number: 0,
        seat_number: 0,
        is_aisle: false,
        is_available: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSeat(null);
    setFormData({
      hall_id: '',
      row_number: 0,
      seat_number: 0,
      is_aisle: false,
      is_available: true
    });
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        row_number: parseInt(formData.row_number),
        seat_number: parseInt(formData.seat_number)
      };

      if (editingSeat) {
        await seatsAPI.updateSeat(editingSeat.id, submitData);
      } else {
        await seatsAPI.createSeat(submitData);
      }
      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить место');
    }
  };

  const handleDelete = async (seatId) => {
    if (window.confirm('Удалить место?')) {
      try {
        await seatsAPI.deleteSeat(seatId);
        await loadData();
      } catch (err) {
        setError('Не удалось удалить место');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) {
    return <Loading message="Загрузка мест..." />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
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
          Управление местами
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
          Добавить место
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Зал</TableCell>
              <TableCell>Ряд</TableCell>
              <TableCell>Место</TableCell>
              <TableCell>Ряд/проход</TableCell>
              <TableCell>Доступно</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {seats.map((seat) => (
              <TableRow key={seat.id}>
                <TableCell>{seat.id}</TableCell>
                <TableCell>{halls.find(h => h.id === seat.hall_id)?.name || 'N/A'}</TableCell>
                <TableCell>{seat.row_number}</TableCell>
                <TableCell>{seat.seat_number}</TableCell>
                <TableCell>{seat.is_aisle ? 'Да' : 'Нет'}</TableCell>
                <TableCell>{seat.is_available ? 'Да' : 'Нет'}</TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(seat)}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Редактировать
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(seat.id)}
                    color="error"
                    size="small"
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal for creating/editing seat */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSeat ? 'Редактировать место' : 'Добавить место'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Зал</InputLabel>
                <Select
                  name="hall_id"
                  value={formData.hall_id}
                  onChange={handleInputChange}
                >
                  {halls.map((hall) => (
                    <MenuItem key={hall.id} value={hall.id}>
                      {hall.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Номер ряда"
                type="number"
                name="row_number"
                value={formData.row_number}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Номер места"
                type="number"
                name="seat_number"
                value={formData.seat_number}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="is_aisle"
                    checked={formData.is_aisle}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_aisle: e.target.checked }))}
                  />
                }
                label="Ряд/проход"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_available: e.target.checked }))}
                  />
                }
                label="Доступно для бронирования"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #46d369 0%, #2e7d32 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5ce67c 0%, #388e3c 100%)',
              },
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SeatManagement;