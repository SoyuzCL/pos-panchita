import React, { createContext, useContext } from 'react';

interface AppContextType {
  showModal: (
    title: string, 
    message: React.ReactNode, 
    type?: 'success' | 'error' | 'info' | 'confirm', 
    onConfirm?: () => void
  ) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => { 
  const context = useContext(AppContext); 
  if (!context) throw new Error("useAppContext must be used within an AppProvider"); 
  return context; 
};
