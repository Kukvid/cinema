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
import { useAuth } from '../../context/AuthContext';
import { seatsAPI } from '../../api/seats';
import { hallsAPI } from '../../api/halls';
import { cinemasAPI } from '../../api/cinemas'; // Add cinema API import
import Loading from '../../components/Loading';

const SeatManagement = () => {
  const { user } = useAuth(); // Add auth context
  const [seats, setSeats] = useState([]);
  const [halls, setHalls] = useState([]);
  const [cinemas, setCinemas] = useState([]); // Add cinemas state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // Add success state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [selectedCinema, setSelectedCinema] = useState(
    user.role === "admin" ? user.cinema_id : ""
  );
  const [formData, setFormData] = useState({
    hall_id: '',
    row_number: 0,
    seat_number: 0,
    is_aisle: false, // This will be disabled
    is_available: true
  });

  useEffect(() => {
    loadData();
  }, [selectedCinema]); // Add selectedCinema to dependencies

  const loadData = async () => {
    try {
      setLoading(true);

      // Load cinemas based on user role (similar to SessionManagement)
      const cinemasData = await cinemasAPI.getCinemas();
      let filteredCinemas = cinemasData;
      if (user.role === "admin") {
        filteredCinemas = cinemasData.filter(
          (cinema) => cinema.id === user.cinema_id
        );
      }
      setCinemas(filteredCinemas);

      // Load halls with cinema filter
      let hallsParams = null;
      if (user.role === "admin") {
        hallsParams = user.cinema_id;
      } else if (selectedCinema) {
        hallsParams = selectedCinema;
      }
      const hallsWithCinemaData = await hallsAPI.getHallsWithCinema(hallsParams);
      setHalls(hallsWithCinemaData);

      // Load seats with cinema filter
      const seatsParams = {};
      if (user.role === "admin") {
        seatsParams.cinema_id = user.cinema_id;
      } else if (selectedCinema) {
        seatsParams.cinema_id = selectedCinema;
      }

      // Use the new endpoint that returns seats with cinema information
      const seatsData = await seatsAPI.getSeatsWithCinema(seatsParams);
      setSeats(seatsData);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (seat = null) => {
    if (seat) {
      // If seat already has cinema information from the 'with-cinema' endpoint
      if (seat.cinema_name) {
        setEditingSeat(seat);
        setFormData({
          hall_id: seat.hall_id || '',
          row_number: seat.row_number || 0,
          seat_number: seat.seat_number || 0,
          is_aisle: seat.is_aisle || false,
          is_available: seat.is_available || true
        });
        setDialogOpen(true); // Make sure dialog opens even in this case
      } else {
        // Otherwise, fetch seat with cinema information
        loadSeatWithCinema(seat.id);
      }
    } else {
      setEditingSeat(null);
      setFormData({
        hall_id: '',
        row_number: 0,
        seat_number: 0,
        is_aisle: false, // Default value, but will be disabled
        is_available: true
      });
      setDialogOpen(true);
    }
  };

  // Function to load seat with cinema information
  const loadSeatWithCinema = async (seatId) => {
    try {
      const seatDetailed = await seatsAPI.getSeatWithCinema(seatId);
      setEditingSeat(seatDetailed);
      setFormData({
        hall_id: seatDetailed.hall_id || '',
        row_number: seatDetailed.row_number || 0,
        seat_number: seatDetailed.seat_number || 0,
        is_aisle: seatDetailed.is_aisle || false,
        is_available: seatDetailed.is_available || true
      });
      setDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить информацию о месте');
      console.error('Error loading seat with cinema info:', err);
      // If the detailed API fails, try to use basic seat data
      const basicSeat = seats.find(s => s.id === seatId);
      if (basicSeat) {
        setEditingSeat(basicSeat);
        setFormData({
          hall_id: basicSeat.hall_id || '',
          row_number: basicSeat.row_number || 0,
          seat_number: basicSeat.seat_number || 0,
          is_aisle: basicSeat.is_aisle || false,
          is_available: basicSeat.is_available || true
        });
        setDialogOpen(true);
      } else {
        // If everything fails, just open the dialog
        setDialogOpen(true);
      }
    }
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
      setSuccess(editingSeat ? 'Место успешно обновлено' : 'Место успешно создано');
      await loadData();
      handleCloseDialog();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить место');
      console.error('Error saving seat:', err);
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Cinema filter dropdown */}
          {user.role === 'admin' || user.role === 'super_admin' ? (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Кинотеатр</InputLabel>
              <Select
                value={selectedCinema}
                label="Кинотеатр"
                onChange={(e) => setSelectedCinema(e.target.value)}
              >
                <MenuItem value="">
                  <em>Все кинотеатры</em>
                </MenuItem>
                {cinemas.map((cinema) => (
                  <MenuItem key={cinema.id} value={cinema.id}>
                    {cinema.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Кинотеатр</TableCell>
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
                <TableCell>{seat.cinema_name || 'N/A'}</TableCell>
                <TableCell>{seat.hall_name || 'N/A'}</TableCell>
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
            {/* Show cinema information if available */}
            {editingSeat && editingSeat.cinema_name && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Кинотеатр"
                  value={editingSeat.cinema_name || ''}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="outlined"
                  disabled
                />
              </Grid>
            )}
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
                    disabled // Disable as requested
                  />
                }
                label="Ряд/проход (отключен)"
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