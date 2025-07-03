import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { apiService } from '../services/apiService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface LoginViewProps {
  onSwitchToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSwitchToRegister }) => {
    const { login } = useAuth();
    const { showModal } = useAppContext();
    const [rut, setRut] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { token, user } = await apiService.post('/login', { rut, password });
            login(token, user);
        } catch (error: any) {
            showModal('Error de Autenticación', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-200">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Iniciar Sesión</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <Input label="RUT" id="rut" type="text" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="1-1" required />
                    <Input label="Contraseña" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? 'Ingresando...' : 'Ingresar'}</Button>
                </form>
                 <p className="text-sm text-center text-gray-600">¿No tienes una cuenta?{' '}<button onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:underline">Regístrate aquí</button></p>
            </div>
        </div>
    );
};
