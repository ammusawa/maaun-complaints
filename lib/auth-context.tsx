'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from './api';

type User = {
  id: number;
  email: string;
  full_name: string;
  matric_number?: string;
  department?: string;
  role: 'student' | 'staff' | 'admin' | 'management' | 'auditor' | 'maintenance_officer';
  is_active: number;
  created_at: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('token', t);
      else localStorage.removeItem('token');
    }
  };

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (t && u) {
      setTokenState(t);
      try {
        setUser(JSON.parse(u));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // Hydrate user from localStorage when we have token but user is null (e.g. after login race)
  useEffect(() => {
    if (loading || user) return;
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (t && u) {
      try {
        setUser(JSON.parse(u));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
  }, [loading, user]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        setUser,
        setToken,
        loading,
        isAdmin: user?.role === 'admin',
        isStaff: user?.role === 'staff' || user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
