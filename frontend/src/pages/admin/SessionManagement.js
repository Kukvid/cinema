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
  InputAdornment
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ru } from 'date-fns/locale';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { sessionsAPI } from '../../api/sessions';
import { filmsAPI } from '../../api/films';
import { hallsAPI } from '../../api/halls';
import { cinemasAPI } from '../../api/cinemas';
import Loading from '../../components/Loading';

const SessionManagement = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [films, setFilms] = useState([]);
  const [halls, setHalls] = useState([]);
  const [cinemas, setCinemas] = useState([]);
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
      const [filmsData, hallsData, cinemasData] = await Promise.all([
        filmsAPI.getFilms(),
        hallsAPI.getHalls(),
        cinemasAPI.getCinemas() // Получаем все кинотеатры
      ]);

      // Для админа показываем только его кинотеатр
      let filteredCinemas = cinemasData;
      if (user.role === 'admin') {
        filteredCinemas = cinemasData.filter(cinema => cinema.id === user.cinema_id);
      }
      setCinemas(filteredCinemas);

      // Фильтруем залы по кинотеатрам пользователя
      let filteredHalls = hallsData;
      if (user.role === 'admin') {
        filteredHalls = hallsData.filter(hall => hall.cinema_id === user.cinema_id);
      }

      // Загружаем сеансы с учетом роли пользователя
      const sessionsParams = {};
      if (user.role === 'admin') {
        sessionsParams.cinema_id = user.cinema_id;
      }
      const sessionsData = await sessionsAPI.getSessions(sessionsParams);

      setSessions(sessionsData);
      setFilms(filmsData.items || filmsData);
      setHalls(filteredHalls);
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
    // Валидация данных перед отправкой
    if (!formData.film_id) {
      setError('Выберите фильм');
      return;
    }
    if (!formData.hall_id) {
      setError('Выберите зал');
      return;
    }
    if (!formData.start_datetime || !formData.end_datetime) {
      setError('Укажите дату и время начала и окончания');
      return;
    }

    const startDateTime = new Date(formData.start_datetime);
    const endDateTime = new Date(formData.end_datetime);
    const now = new Date();

    // Проверка, что сеанс не в прошлом
    if (startDateTime < now) {
      setError('Нельзя создать сеанс в прошлом');
      return;
    }

    // Проверка, что время окончания позже времени начала
    if (endDateTime <= startDateTime) {
      setError('Время окончания должно быть позже времени начала');
      return;
    }

    // Проверка, что цена билета положительная
    if (parseFloat(formData.ticket_price) <= 0) {
      setError('Цена билета должна быть положительной');
      return;
    }

    try {
      const submitData = {
        ...formData,
        ticket_price: parseFloat(formData.ticket_price),
        start_datetime: startDateTime.toISOString(),
        end_datetime: endDateTime.toISOString()
      };

      if (editingSession) {
        await sessionsAPI.updateSession(editingSession.id, submitData);
      } else {
        await sessionsAPI.createSession(submitData);
      }
      await loadData();
      handleCloseDialog();
      setError(null); // Сбросить ошибку после успешного сохранения
    } catch (err) {
      // Показываем сообщение об ошибке от сервера
      const errorMessage = err.response?.data?.detail || 'Не удалось сохранить сеанс';
      setError(errorMessage);
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
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
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
                <TableCell>Кинотеатр</TableCell>
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
                  <TableCell>{cinemas.find(c => c.id === halls.find(h => h.id === session.hall_id)?.cinema_id)?.name || 'N/A'}</TableCell>
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
                        {film.title} ({film.duration_minutes} мин.)
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
                        {hall.name} (Вместимость: {hall.capacity})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Дата и время начала"
                  value={formData.start_datetime ? new Date(formData.start_datetime) : null}
                  onChange={(newValue) => {
                    if (newValue) {
                      // Если выбрали фильм, автоматически вычисляем время окончания
                      if (formData.film_id && films.length > 0) {
                        const selectedFilm = films.find(film => film.id === parseInt(formData.film_id));
                        if (selectedFilm) {
                          const endTime = new Date(newValue.getTime() + selectedFilm.duration_minutes * 60000);
                          setFormData(prev => ({
                            ...prev,
                            start_datetime: newValue.toISOString(),
                            end_datetime: endTime.toISOString()
                          }));
                          return;
                        }
                      }
                      setFormData(prev => ({
                        ...prev,
                        start_datetime: newValue.toISOString()
                      }));
                    }
                  }}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="Дата и время окончания"
                  value={formData.end_datetime ? new Date(formData.end_datetime) : null}
                  onChange={(newValue) => {
                    if (newValue) {
                      setFormData(prev => ({
                        ...prev,
                        end_datetime: newValue.toISOString()
                      }));
                    }
                  }}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
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
                  InputProps={{
                    inputProps: { min: 0, step: 0.01 }
                  }}
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
    </LocalizationProvider>
  );
};

export default SessionManagement;