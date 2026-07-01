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
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    await fetchProfile();
  };

  const signup = async (email, password, role_id) => {
    await api.post('/api/auth/signup', { email, password, role_id });
    await fetchProfile();
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/revoke');
    } catch (err) {
      // Continue logout even if revoke fails
    }
    setUserProfile(null);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProfile();

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
