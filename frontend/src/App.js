import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';

// Components
import Header from './components/Header';
import PrivateRoute from './components/PrivateRoute';

// Public Pages
import Home from './pages/Home';
import FilmDetail from './pages/FilmDetail';
import SessionBooking from './pages/SessionBooking';
import Login from './pages/Login';
import Register from './pages/Register';

// User Pages
import Profile from './pages/Profile';
import MyTickets from './pages/MyTickets';
import MyOrders from './pages/MyOrders';
import PaymentPage from './pages/PaymentPage';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import CinemasManage from './pages/admin/CinemasManage';
import FilmsManage from './pages/admin/FilmsManage';
import SessionsManage from './pages/admin/SessionsManage';
import FoodCategoriesManage from './pages/admin/FoodCategoriesManage';
import PromocodesManage from './pages/admin/PromocodesManage';
import UserManagement from './pages/admin/UserManagement';
import GenreManagement from './pages/admin/GenreManagement';
import DistributorManagement from './pages/admin/DistributorManagement';
import ContractManagement from './pages/admin/ContractManagement';
import HallManagement from './pages/admin/HallManagement';
import SeatManagement from './pages/admin/SeatManagement';
import SessionManagement from './pages/admin/SessionManagement';
import ReportManagement from './pages/admin/ReportManagement';
import ConcessionManagement from './pages/admin/ConcessionManagement';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Box
            sx={{
              minHeight: '100vh',
              background: 'linear-gradient(180deg, #141414 0%, #1f1f1f 100%)',
            }}
          >
            <Header />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/films/:id" element={<FilmDetail />} />
              <Route path="/sessions/:id/booking" element={<SessionBooking />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* User Protected Routes */}
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/my-tickets"
                element={
                  <PrivateRoute>
                    <MyTickets />
                  </PrivateRoute>
                }
              />

              <Route
                path="/my-orders"
                element={
                  <PrivateRoute>
                    <MyOrders />
                  </PrivateRoute>
                }
              />

              <Route
                path="/payment/:id"
                element={
                  <PrivateRoute>
                    <PaymentPage />
                  </PrivateRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <PrivateRoute requireAdmin>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <PrivateRoute requireAdmin>
                    <UserManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/cinemas"
                element={
                  <PrivateRoute requireAdmin>
                    <CinemasManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/genres"
                element={
                  <PrivateRoute requireAdmin>
                    <GenreManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/distributors"
                element={
                  <PrivateRoute requireAdmin>
                    <DistributorManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/contracts"
                element={
                  <PrivateRoute requireAdmin>
                    <ContractManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/halls"
                element={
                  <PrivateRoute requireAdmin>
                    <HallManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/seats"
                element={
                  <PrivateRoute requireAdmin>
                    <SeatManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/sessions"
                element={
                  <PrivateRoute requireAdmin>
                    <SessionManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <PrivateRoute requireAdmin>
                    <ReportManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/session-management"
                element={
                  <PrivateRoute requireAdmin>
                    <SessionManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/films"
                element={
                  <PrivateRoute requireAdmin>
                    <FilmsManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/sessions"
                element={
                  <PrivateRoute requireAdmin>
                    <SessionsManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/food-categories"
                element={
                  <PrivateRoute requireAdmin>
                    <FoodCategoriesManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/promocodes"
                element={
                  <PrivateRoute requireAdmin>
                    <PromocodesManage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/concessions"
                element={
                  <PrivateRoute requireAdmin>
                    <ConcessionManagement />
                  </PrivateRoute>
                }
              />

              {/* Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
