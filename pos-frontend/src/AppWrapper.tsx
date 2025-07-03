import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useCashSession } from './contexts/CashSessionContext';
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { MainApp } from './MainApp';
import { InitialCashModal } from './components/features/InitialCashModal';

export const AppWrapper: React.FC = () => {
    const { token } = useAuth();
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const { session, isLoading: isSessionLoading } = useCashSession();

    if (!token) {
        if (authView === 'login') {
            return <LoginView onSwitchToRegister={() => setAuthView('register')} />;
        }
        return <RegisterView onSwitchToLogin={() => setAuthView('login')} />;
    }
    
    if (isSessionLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <p className="text-xl font-semibold animate-pulse text-gray-700">Verificando sesión de caja...</p>
            </div>
        );
    }

    if (session) {
        return <MainApp />;
    }

    return (
        <div className="h-screen w-screen bg-gray-200">
             <InitialCashModal />
        </div>
    );
};
