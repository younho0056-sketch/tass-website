"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'staff' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  role: UserRole;
  canEdit: boolean;
  isAuthModalOpen: boolean;
  targetUrl: string | null;
  login: (pin: string) => { success: boolean; role?: UserRole; error?: string };
  logout: () => void;
  openAuthModal: (targetPath?: string) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'tass_auth_role';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedRole = sessionStorage.getItem(AUTH_STORAGE_KEY) as UserRole;
    if (savedRole === 'admin' || savedRole === 'staff') {
      setRole(savedRole);
    }
  }, []);

  const login = (pin: string) => {
    const trimmedPin = pin.trim();
    if (trimmedPin === '0056') {
      setRole('admin');
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'admin');
      setIsAuthModalOpen(false);
      return { success: true, role: 'admin' as UserRole };
    } else if (trimmedPin === '1234') {
      setRole('staff');
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'staff');
      setIsAuthModalOpen(false);
      return { success: true, role: 'staff' as UserRole };
    } else {
      return { success: false, error: '비밀번호가 일치하지 않습니다. (직원: 1234 / 관리자: 0056)' };
    }
  };

  const logout = () => {
    setRole(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const openAuthModal = (targetPath?: string) => {
    if (targetPath) setTargetUrl(targetPath);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const isAuthenticated = role !== null;
  const canEdit = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: mounted ? isAuthenticated : false,
        role: mounted ? role : null,
        canEdit: mounted ? canEdit : false,
        isAuthModalOpen,
        targetUrl,
        login,
        logout,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
