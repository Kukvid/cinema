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

  // Helper function to decode JWT token to check expiration
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      return null;
    }
  };

  // Function to refresh token
  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authAPI.refreshToken(refreshToken);
      const newAccessToken = response.access_token;

      localStorage.setItem('token', newAccessToken);
      setToken(newAccessToken);

      // Update user data as well
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true, token: newAccessToken };
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      return { success: false, error: error.message };
    }
  };

  // Set up token refresh interval (refresh 5 minutes before expiration)
  useEffect(() => {
    let refreshTimer;

    const scheduleTokenRefresh = () => {
      if (token) {
        const decoded = decodeToken(token);
        if (decoded && decoded.exp) {
          const expiryTime = decoded.exp * 1000; // Convert to milliseconds
          const currentTime = Date.now();
          const timeUntilExpiry = expiryTime - currentTime;
          const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000); // Refresh 5 minutes early

          if (refreshTime > 0) {
            refreshTimer = setTimeout(async () => {
              await refreshToken();
            }, refreshTime);
          } else {
            // Token already expired, try to refresh immediately
            refreshToken();
          }
        }
      }
    };

    if (isAuthenticated) {
      scheduleTokenRefresh();
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          // Decode the token to check if it's expired
          const decoded = decodeToken(savedToken);
          if (decoded && decoded.exp) {
            const expiryTime = decoded.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();

            if (currentTime < expiryTime) {
              // Token is still valid, use it directly
              const userData = await authAPI.getCurrentUser();
              setUser(userData);
              setIsAuthenticated(true);
            } else {
              // Token has expired, try to refresh it
              const refreshSuccess = await refreshToken();
              if (refreshSuccess.success) {
                setIsAuthenticated(true);
              } else {
                // Refresh failed, user needs to log in again
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                setToken(null);
              }
            }
          } else {
            // Invalid token format
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setToken(null);
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
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
      const refreshToken = data.refresh_token;

      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
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
    localStorage.removeItem('refreshToken');
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
