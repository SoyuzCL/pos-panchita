import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { CashSession } from '../types/definitions';
import { useAuth } from './AuthContext';
import { apiService } from '../services/apiService';

interface CashSessionContextType {
  session: CashSession | null;
  setSession: (session: CashSession | null) => void;
  isLoading: boolean;
}

export const CashSessionContext = createContext<CashSessionContextType | null>(null);

export const useCashSession = () => {
  const context = useContext(CashSessionContext);
  if (!context) throw new Error("useCashSession must be used within a CashSessionProvider");
  return context;
};

export const CashSessionProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<CashSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { token } = useAuth();

    const updateSession = (activeSession: any) => {
        if (activeSession) {
            setSession({
                ...activeSession,
                current_balance: parseFloat(activeSession.current_balance)
            });
        } else {
            setSession(null);
        }
    };
    
    useEffect(() => {
        const checkActiveSession = async () => {
            if (!token) {
                setIsLoading(false);
                setSession(null);
                return;
            };
            setIsLoading(true);
            try {
                const activeSession = await apiService.get('/cash-sessions/active');
                updateSession(activeSession);
            } catch (error) {
                console.error("Failed to fetch active cash session", error);
                setSession(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkActiveSession();
    }, [token]);
    
    const value = { session, setSession: updateSession, isLoading };

    return (
        <CashSessionContext.Provider value={value}>
            {children}
        </CashSessionContext.Provider>
    );
};
