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
  Grid
} from '@mui/material';
import {
  PersonAdd as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { usersAPI } from '../../api/users';
import { rolesAPI } from '../../api/roles';
import { contractsAPI } from '../../api/contracts'; // Используем существующий API для получения кинотеатров
import Loading from '../../components/Loading';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role_id: '',
    cinema_id: 0, // Новое поле для cinema_id
    status: 'active',
    password: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, cinemasData] = await Promise.all([
        usersAPI.getUsers(),
        rolesAPI.getRoles(),
        contractsAPI.getAvailableCinemas(), // Загружаем кинотеатры
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setCinemas(cinemasData); // Устанавливаем данные о кинотеатрах
    } catch (err) {
      setError('Не удалось загрузить данные пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        role_id: user.role_id || '',
        cinema_id: user.cinema_id || 0, // Добавляем cinema_id
        status: user.status || 'active',
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role_id: '',
        cinema_id: 0, // Добавляем cinema_id
        status: 'active',
        password: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role_id: '',
      cinema_id: 0, // Добавляем cinema_id
      status: 'active'
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await usersAPI.updateUser(editingUser.id, formData);
      } else {
        await usersAPI.createUser(formData);
      }
      await loadData();
      handleCloseDialog();
    } catch (err) {
      setError('Не удалось сохранить пользователя');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Удалить пользователя?')) {
      try {
        await usersAPI.deleteUser(userId);
        await loadData();
      } catch (err) {
        setError('Не удалось удалить пользователя');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <Loading message="Загрузка пользователей..." />;
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
          Управление пользователями
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
          Добавить пользователя
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
              <TableCell>Имя</TableCell>
              <TableCell>Фамилия</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Кинотеатр</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Дата регистрации</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.first_name}</TableCell>
                <TableCell>{user.last_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{roles.find(r => r.id === user.role_id)?.name || 'N/A'}</TableCell>
                <TableCell>{cinemas.find(c => c.id === user.cinema_id)?.name || 'N/A'}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>{new Date(user.registration_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(user)}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Редактировать
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(user.id)}
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

      {/* Modal for creating/editing user */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Имя"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Фамилия"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Телефон"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Grid>
            {/* Добавляем поле пароля ТОЛЬКО для создания нового пользователя */}
            {!editingUser && ( // <-- Условный рендеринг
              <Grid item xs={12}>
                 <TextField
                    fullWidth
                    label="Пароль"
                    name="password"
                    type="password" // <-- Важно для безопасности
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!editingUser} // <-- Поле обязательно только при создании
                  />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Роль</InputLabel>
                <Select
                  name="role_id"
                  value={formData.role_id}
                  onChange={handleInputChange}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Кинотеатр</InputLabel>
                <Select
                  name="cinema_id"
                  value={formData.cinema_id}
                  onChange={handleInputChange}
                >
                  <MenuItem value="">Нет кинотеатра</MenuItem>
                  {cinemas.map((cinema) => (
                    <MenuItem key={cinema.id} value={cinema.id}>
                      {cinema.name} - {cinema.city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <MenuItem value="active">Активен</MenuItem>
                  <MenuItem value="inactive">Неактивен</MenuItem>
                  <MenuItem value="blocked">Заблокирован</MenuItem>
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

export default UserManagement;