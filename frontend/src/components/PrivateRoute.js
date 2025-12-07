import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

const PrivateRoute = ({ children, requireAdmin = false, requireStaff = false, requireSuperAdmin = false }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loading message="Проверка авторизации..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  // Проверка на супер-админа (допустим, роль 'superadmin')
  if (requireSuperAdmin && user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

    // Проверка на админа (допустим, роль 'admin')
  // 'superadmin' также может иметь доступ к админке, если это нужно, иначе уберите 'superadmin' из проверки
  if (requireAdmin && !['admin', 'super_admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  if (requireStaff && !['admin', 'staff', 'super_admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
