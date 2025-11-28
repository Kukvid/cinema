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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

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

  const menuItems = [
    {
      title: 'Управление кинотеатрами',
      icon: <PlaceIcon />,
      path: '/admin/cinemas',
      description: 'Добавление и редактирование кинотеатров и залов',
    },
    {
      title: 'Управление фильмами',
      icon: <MovieIcon />,
      path: '/admin/films',
      description: 'Каталог фильмов, постеры, описания',
    },
    {
      title: 'Управление сеансами',
      icon: <EventIcon />,
      path: '/admin/sessions',
      description: 'Расписание показов, цены, залы',
    },
    {
      title: 'Кинобар',
      icon: <FoodIcon />,
      path: '/admin/concessions',
      description: 'Товары кинобара и их цены',
    },
    {
      title: 'Категории кинобара',
      icon: <CategoryIcon />,
      path: '/admin/food-categories',
      description: 'Управление категориями товаров',
    },
  ];

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
      </Grid>
    </Container>
  );
};

export default Dashboard;
