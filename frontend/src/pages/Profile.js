import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Stars as StarsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      city: user?.city || '',
    },
  });

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const result = await updateUser(data);

      if (result.success) {
        setSuccess('Профиль успешно обновлен');
        setEditing(false);
      } else {
        setError(result.error || 'Не удалось обновить профиль');
      }
    } catch (err) {
      setError('Ошибка при обновлении профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      city: user?.city || '',
    });
    setEditing(false);
    setError('');
    setSuccess('');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          mb: 4,
          background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Мой профиль
      </Typography>

      <Grid container spacing={4}>
        {/* Левая колонка - аватар и бонусы */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '1px solid rgba(229, 9, 20, 0.3)',
            }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 2,
                fontSize: '3rem',
                background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
              }}
            >
              {user?.first_name?.[0] || user?.email?.[0].toUpperCase()}
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Paper>

          {/* Бонусный баланс */}
          <Card
            sx={{
              mt: 3,
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%)',
              border: '2px solid rgba(255, 215, 0, 0.3)',
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <StarsIcon sx={{ fontSize: 48, color: '#ffd700', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                Бонусный баланс
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#ffd700' }}>
                {user?.bonus_balance || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Используйте бонусы для оплаты билетов
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Правая колонка - информация и редактирование */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 4,
              background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
              border: '1px solid rgba(229, 9, 20, 0.2)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Личная информация
              </Typography>
              {!editing && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setEditing(true)}
                  sx={{
                    borderColor: '#e50914',
                    color: '#e50914',
                    '&:hover': {
                      borderColor: '#ff1a1a',
                      background: 'rgba(229, 9, 20, 0.1)',
                    },
                  }}
                >
                  Редактировать
                </Button>
              )}
            </Box>

            {success && (
              <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
                {success}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Имя"
                    {...register('first_name', {
                      required: 'Имя обязательно',
                    })}
                    error={!!errors.first_name}
                    helperText={errors.first_name?.message}
                    disabled={!editing}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Фамилия"
                    {...register('last_name', {
                      required: 'Фамилия обязательна',
                    })}
                    error={!!errors.last_name}
                    helperText={errors.last_name?.message}
                    disabled={!editing}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    {...register('phone', {
                      required: 'Телефон обязателен',
                    })}
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                    disabled={!editing}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    helperText="Email нельзя изменить"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Дата рождения"
                    value={user?.birth_date ? new Date(user.birth_date).toLocaleDateString('ru-RU') : ''}
                    disabled
                    helperText="Дата рождения не может быть изменена"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Пол"
                    value={user?.gender || ''}
                    disabled
                    helperText="Пол не может быть изменен"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Город"
                    {...register('city')}
                    disabled={!editing}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2, borderColor: 'rgba(229, 9, 20, 0.2)' }} />
                  <Typography variant="body2" color="text.secondary">
                    Роль: <strong>{user?.role === 'admin' ? 'Администратор' : 'Пользователь'}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Дата регистрации: {new Date(user?.registration_date).toLocaleDateString('ru-RU')}
                  </Typography>
                </Grid>
              </Grid>

              {editing && (
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading}
                    sx={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #46d369 0%, #2e7d32 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5ce67c 0%, #388e3c 100%)',
                      },
                    }}
                  >
                    {loading ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    sx={{
                      flex: 1,
                      borderColor: '#b3b3b3',
                      color: '#b3b3b3',
                      '&:hover': {
                        borderColor: '#fff',
                        color: '#fff',
                      },
                    }}
                  >
                    Отмена
                  </Button>
                </Box>
              )}
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile;
