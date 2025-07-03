import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { apiService } from '../services/apiService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

interface RegisterViewProps {
  onSwitchToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onSwitchToLogin }) => {
    const { showModal } = useAppContext();
    const [formData, setFormData] = useState({ first_name: '', last_name: '', rut: '', password: '', role: 'cajero' });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { 
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); 
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.first_name || !formData.rut || !formData.password) { 
            showModal("Campos Incompletos", "Nombre, RUT y contraseña son obligatorios.", "info"); 
            return; 
        }
        setIsLoading(true);
        try {
            await apiService.post('/employees', formData);
            showModal("Registro Exitoso", "La cuenta ha sido creada. Ahora puedes iniciar sesión.", "success", onSwitchToLogin);
        } catch (error: any) {
            showModal("Error de Registro", error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-200">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Crear Cuenta</h2>
                <form className="space-y-4" onSubmit={handleRegister}>
                    <Input label="Nombre" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                    <Input label="Apellido" name="last_name" value={formData.last_name} onChange={handleInputChange} />
                    <Input label="RUT" name="rut" value={formData.rut} onChange={handleInputChange} placeholder="12.345.678-9" required />
                    <Input label="Contraseña" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
                    <Select label="Rol" name="role" value={formData.role} onChange={handleInputChange}>
                        <option value="cajero">Cajero</option>
                        <option value="admin">Administrador</option>
                    </Select>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? 'Registrando...' : 'Crear Cuenta'}</Button>
                </form>
                <p className="text-sm text-center text-gray-600">¿Ya tienes una cuenta?{' '}<button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:underline">Inicia Sesión</button></p>
            </div>
        </div>
    );
};
