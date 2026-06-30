import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function AppContent() {
  const { userProfile, isLoading, fetchProfile } = useAuth();

  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const idToken = params.get('id_token');

      if (accessToken && refreshToken && idToken) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('id_token', idToken);
        window.history.replaceState({}, document.title, '/');
        fetchProfile();
      }
    }
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        Initializing workspace...
      </div>
    );
  }

  return userProfile ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
