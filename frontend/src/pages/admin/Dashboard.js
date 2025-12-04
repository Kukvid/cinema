import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Movie as MovieIcon,
  Event as EventIcon,
  Place as PlaceIcon,
  Fastfood as FoodIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  LocalOffer as PromoIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Roles that should have restricted access
  const isStaff = user?.role === 'staff';

  const stats = [
    {
      title: 'Пользователи',
      value: '1,234',
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: '#2196f3',
      trend: '+12%',
    },
    {
      title: 'Активные фильмы',
      value: '42',
      icon: <MovieIcon sx={{ fontSize: 40 }} />,
      color: '#e50914',
      trend: '+5%',
    },
    {
      title: 'Сеансы сегодня',
      value: '156',
      icon: <EventIcon sx={{ fontSize: 40 }} />,
      color: '#ffd700',
      trend: '+8%',
    },
    {
      title: 'Выручка (месяц)',
      value: '₽1,245,000',
      icon: <MoneyIcon sx={{ fontSize: 40 }} />,
      color: '#46d369',
      trend: '+23%',
    },
  ];

  // All menu items with restriction flag
  const allMenuItems = [
    {
      title: 'Управление пользователями',
      icon: <PeopleIcon />,
      path: '/admin/users',
      description: 'Управление учетными записями пользователей',
      restrictedForStaff: true,
    },
    {
      title: 'Управление кинотеатрами',
      icon: <PlaceIcon />,
      path: '/admin/cinemas',
      description: 'Добавление и редактирование кинотеатров и залов',
      restrictedForStaff: true,
    },
    {
      title: 'Управление фильмами',
      icon: <MovieIcon />,
      path: '/admin/films',
      description: 'Каталог фильмов, постеры, описания',
      restrictedForStaff: true,
    },
    {
      title: 'Управление жанрами',
      icon: <CategoryIcon />,
      path: '/admin/genres',
      description: 'Управление жанрами фильмов',
      restrictedForStaff: true,
    },
    {
      title: 'Управление сеансами',
      icon: <EventIcon />,
      path: '/admin/sessions',
      description: 'Расписание показов, цены, залы',
      restrictedForStaff: true,
    },
    {
      title: 'Управление залами',
      icon: <PlaceIcon />,
      path: '/admin/halls',
      description: 'Настройка залов и вместимости',
      restrictedForStaff: true,
    },
    {
      title: 'Управление местами',
      icon: <EventIcon />,
      path: '/admin/seats',
      description: 'Конфигурация мест в залах',
      restrictedForStaff: true,
    },
    {
      title: 'Управление дистрибьюторами',
      icon: <PersonIcon />,
      path: '/admin/distributors',
      description: 'Управление контрактами с дистрибьюторами',
      restrictedForStaff: true,
    },
    {
      title: 'Управление договорами',
      icon: <AssignmentIcon />,
      path: '/admin/contracts',
      description: 'Управление договорами с дистрибьюторами',
      restrictedForStaff: true,
    },
    {
      title: 'Кинобар',
      icon: <FoodIcon />,
      path: '/admin/concessions',
      description: 'Товары кинобара и их цены',
      restrictedForStaff: false,
    },
    {
      title: 'Категории кинобара',
      icon: <CategoryIcon />,
      path: '/admin/food-categories',
      description: 'Управление категориями товаров',
      restrictedForStaff: true,
    },
    {
      title: 'Отчеты',
      icon: <AssessmentIcon />,
      path: '/admin/reports',
      description: 'Формирование и анализ отчетов',
      restrictedForStaff: true,
    },
    {
      title: 'Промокоды',
      icon: <PromoIcon />,
      path: '/admin/promocodes',
      description: 'Управление промокодами и скидками',
      restrictedForStaff: true,
    },
  ];

  // Filter menu items based on user role
  const menuItems = isStaff
    ? allMenuItems.filter(item => !item.restrictedForStaff)
    : allMenuItems;

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <DashboardIcon sx={{ fontSize: 40, color: '#e50914' }} />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #e50914 0%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Панель администратора
        </Typography>
      </Box>

      {/* Статистика */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                border: `2px solid ${stat.color}33`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${stat.color}33`,
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                      {stat.value}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingIcon sx={{ fontSize: 16, color: '#46d369' }} />
                      <Typography variant="body2" sx={{ color: '#46d369', fontWeight: 600 }}>
                        {stat.trend}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: `${stat.color}22`,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Меню управления */}
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Управление системой
      </Typography>

      {/* Display message for staff users */}
      {isStaff && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Вы видите ограниченную версию панели управления как сотрудник кинотеатра
        </Typography>
      )}

      <Grid container spacing={3}>
        {menuItems.map((item, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Paper
              sx={{
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                border: '1px solid rgba(229, 9, 20, 0.2)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: 'rgba(229, 9, 20, 0.5)',
                  transform: 'translateX(8px)',
                },
              }}
            >
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  p: 3,
                  '&:hover': {
                    background: 'rgba(229, 9, 20, 0.1)',
                  },
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.2) 0%, rgba(176, 7, 16, 0.2) 100%)',
                      color: '#e50914',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {React.cloneElement(item.icon, { sx: { fontSize: 32 } })}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {item.title}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.description}
                    </Typography>
                  }
                />
              </ListItemButton>
            </Paper>
          </Grid>
        ))}
        {isStaff && menuItems.length === 0 && (
          <Grid item xs={12}>
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)',
                border: '1px solid rgba(229, 9, 20, 0.2)',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                У вас нет доступа к разделам панели администрирования
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Обратитесь к администратору системы для получения необходимых прав
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard;
