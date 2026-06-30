import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      setUserProfile(data);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    saveTokens(data);
    await fetchProfile();
  };

  const signup = async (email, password, role_id) => {
    const { data } = await api.post('/api/auth/signup', { email, password, role_id });
    saveTokens(data);
    await fetchProfile();
  };

  const logout = async () => {
    const rfToken = localStorage.getItem('refresh_token');
    if (rfToken) {
      try {
        await api.post('/api/auth/revoke', { token: rfToken });
      } catch (err) {
        // Continue logout even if revoke fails
      }
    }
    localStorage.clear();
    setUserProfile(null);
    setIsLoading(false);
  };

  const saveTokens = (data) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('id_token', data.id_token);
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }

    const handleLogoutEvent = () => setUserProfile(null);
    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => window.removeEventListener('auth-logout', handleLogoutEvent);
  }, []);

  return (
    <AuthContext.Provider value={{ userProfile, isLoading, login, signup, logout, fetchProfile, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
