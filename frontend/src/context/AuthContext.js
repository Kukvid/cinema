import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to fetch user:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await authAPI.login({ email, password });
      const accessToken = data.access_token;

      localStorage.setItem('token', accessToken);
      setToken(accessToken);

      const userData = await authAPI.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);

      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);

      // Обработка ошибок валидации от FastAPI
      let errorMessage = 'Login failed';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Если detail - массив объектов ошибок FastAPI
          errorMessage = detail.map((err) => {
            // Пробуем получить сообщение об ошибке из разных возможных полей
            return err.msg || err.message || err.detail || JSON.stringify(err);
          }).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object' && detail !== null) {
          // Если detail - объект (а не массив), но не строка
          errorMessage = detail.msg || detail.message || detail.detail || JSON.stringify(detail);
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const register = async (userData) => {
    try {
      await authAPI.register(userData);
      // После регистрации автоматически логинимся
      return await login(userData.email, userData.password);
    } catch (error) {
      console.error('Registration failed:', error);

      // Обработка ошибок валидации от FastAPI
      let errorMessage = 'Registration failed';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Если detail - массив объектов ошибок FastAPI
          errorMessage = detail.map((err) => {
            // Пробуем получить сообщение об ошибке из разных возможных полей
            return err.msg || err.message || err.detail || JSON.stringify(err);
          }).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object' && detail !== null) {
          // Если detail - объект (а не массив), но не строка
          errorMessage = detail.msg || detail.message || detail.detail || JSON.stringify(detail);
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = async (userData) => {
    try {
      const updatedUser = await authAPI.updateProfile(userData);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Update failed:', error);

      // Обработка ошибок валидации от FastAPI
      let errorMessage = 'Update failed';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Если detail - массив объектов ошибок FastAPI
          errorMessage = detail.map((err) => {
            // Пробуем получить сообщение об ошибке из разных возможных полей
            return err.msg || err.message || err.detail || JSON.stringify(err);
          }).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object' && detail !== null) {
          // Если detail - объект (а не массив), но не строка
          errorMessage = detail.msg || detail.message || detail.detail || JSON.stringify(detail);
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
