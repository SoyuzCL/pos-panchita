import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User } from '../types/definitions';
import { apiService } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
  canManageInventory: boolean;
  canManageSuppliers: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));
    
    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser && token) { 
            try { 
                setUser(JSON.parse(storedUser)); 
            } catch (e) { 
                console.error("Failed to parse user data from session storage", e);
                sessionStorage.clear(); 
            } 
        } 
        else if (!token) { 
            sessionStorage.clear(); 
        }
    }, [token]);
    
    const login = (newToken: string, userData: User) => {
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("user", JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };
    
    const logout = async () => {
        try {
            await apiService.post('/cash-sessions/close', {});
        } catch (error) {
            console.error("Failed to close cash session on server:", error);
        } finally {
            sessionStorage.clear();
            setToken(null);
            setUser(null);
            window.location.reload(); // Reload to clear all state
        }
    };

    const isAdmin = user?.role === 'admin';
    const canManageInventory = user?.role === 'admin' || user?.role === 'cajero';
    const canManageSuppliers = user?.role === 'admin' || user?.role === 'cajero';

    const value = { user, token, login, logout, isAdmin, canManageInventory, canManageSuppliers };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
