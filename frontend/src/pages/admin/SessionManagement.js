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
  FormControlLabel,
  Switch,
  DateTimePicker
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { sessionsAPI } from '../../api/sessions';
import { filmsAPI } from '../../api/films';
import { hallsAPI } from '../../api/halls';
import Loading from '../../components/Loading';

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [films, setFilms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    film_id: '',
    hall_id: '',
    start_datetime: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().substring(0, 5),
    end_datetime: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().substring(0, 5),
    ticket_price: 0,
    status: 'SCHEDULED'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsData, filmsData, hallsData] = await Promise.all([
        sessionsAPI.getSessions(),
        filmsAPI.getFilms(),
        hallsAPI.getHalls()
      ]);
      setSessions(sessionsData);
      setFilms(filmsData.items || filmsData);
      setHalls(hallsData);
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (session = null) => {
    if (session) {
      setEditingSession(session);
      setFormData({
        film_id: session.film_id || '',
        hall_id: session.hall_id || '',
        start_datetime: session.start_datetime ? new Date(session.start_datetime).toISOString().slice(0, 16) : '',
        end_datetime: session.end_datetime ? new Date(session.end_datetime).toISOString().slice(0, 16) : '',
        ticket_price: session.ticket_price || 0,
        status: session.status || 'SCHEDULED'
      });
    } else {
      setEditingSession(null);
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000); // через 1 час
      setFormData({
        film_id: '',
        hall_id: '',
        start_datetime: nextHour.toISOString().slice(0, 16),
        end_datetime: '', // будет вычислено автоматически
        ticket_price: 0,
        status: 'SCHEDULED'
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setFormData({
      film_id: '',
      hall_id: '',
      start_datetime: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().substring(0, 5),
      end_datetime: new Date().toISOString().split('T')[0] + 'T' + new Date().toTimeString().substring(0, 5),
      ticket_price: 0,
      status: 'SCHEDULED'
    });
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        ticket_price: parseFloat(formData.ticket_price)
      };
      
      if (editingSession) {
        await sessionsAPI.updateSession(editingSession.id, submitData);
      } else {
        await sessionsAPI.createSession(submitData);
      }
      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить сеанс');
    }
  };

  const handleDelete = async (sessionId) => {
    if (window.confirm('Удалить сеанс?')) {
      try {
        await sessionsAPI.deleteSession(sessionId);
        await loadData();
      } catch (err) {
        setError('Не удалось удалить сеанс');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Если изменили дату/время начала и фильм, вычислим продолжительность фильма и обновим end_datetime
    if ((name === 'start_datetime' || name === 'film_id') && films.length > 0 && formData.film_id) {
      const selectedFilm = films.find(film => film.id === parseInt(formData.film_id));
      if (selectedFilm && formData.start_datetime) {
        const start = new Date(formData.start_datetime);
        const duration = selectedFilm.duration_minutes || 120; // по умолчанию 120 минут
        const end = new Date(start.getTime() + duration * 60 * 1000);
        setFormData(prev => ({
          ...prev,
          end_datetime: end.toISOString().slice(0, 16)
        }));
      }
    }
  };

  if (loading) {
    return <Loading message="Загрузка сеансов..." />;
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
          Управление сеансами
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
          Добавить сеанс
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
              <TableCell>Фильм</TableCell>
              <TableCell>Зал</TableCell>
              <TableCell>Начало</TableCell>
              <TableCell>Конец</TableCell>
              <TableCell>Цена билета</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>{session.id}</TableCell>
                <TableCell>{films.find(f => f.id === session.film_id)?.title || 'N/A'}</TableCell>
                <TableCell>{halls.find(h => h.id === session.hall_id)?.name || 'N/A'}</TableCell>
                <TableCell>{new Date(session.start_datetime).toLocaleString('ru-RU')}</TableCell>
                <TableCell>{new Date(session.end_datetime).toLocaleString('ru-RU')}</TableCell>
                <TableCell>{session.ticket_price} ₽</TableCell>
                <TableCell>{session.status}</TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(session)}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Редактировать
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(session.id)}
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

      {/* Modal for creating/editing session */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSession ? 'Редактировать сеанс' : 'Добавить сеанс'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Фильм</InputLabel>
                <Select
                  name="film_id"
                  value={formData.film_id}
                  onChange={handleInputChange}
                >
                  {films.map((film) => (
                    <MenuItem key={film.id} value={film.id}>
                      {film.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
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
                label="Дата и время начала"
                type="datetime-local"
                name="start_datetime"
                value={formData.start_datetime}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата и время окончания"
                type="datetime-local"
                name="end_datetime"
                value={formData.end_datetime}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Цена билета (₽)"
                type="number"
                name="ticket_price"
                value={formData.ticket_price}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <MenuItem value="SCHEDULED">Запланирован</MenuItem>
                  <MenuItem value="ONGOING">Идет сеанс</MenuItem>
                  <MenuItem value="COMPLETED">Завершен</MenuItem>
                  <MenuItem value="CANCELLED">Отменен</MenuItem>
                </Select>
              </FormControl>
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

export default SessionManagement;