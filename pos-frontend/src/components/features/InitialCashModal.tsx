import React, { useState } from 'react';
import { useCashSession } from '../../contexts/CashSessionContext';
import { useAppContext } from '../../contexts/AppContext';
import { apiService } from '../../services/apiService';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export const InitialCashModal: React.FC = () => {
    const { setSession } = useCashSession();
    const { showModal } = useAppContext();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const start_amount = parseFloat(amount);
        if(isNaN(start_amount) || start_amount < 0) {
            showModal('Monto Inválido', 'Por favor, ingrese un número válido para el fondo de caja inicial.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const newSession = await apiService.post('/cash-sessions/start', { start_amount });
            if (setSession) setSession(newSession);
        } catch(error: any) {
            showModal('Error al Iniciar Caja', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Iniciar Sesión de Caja</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-gray-600 text-center">No hay una sesión de caja activa. Ingrese el monto inicial para continuar.</p>
                    <Input label="Monto Inicial en Caja" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ej: 50000" required autoFocus/>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? 'Iniciando...' : 'Iniciar Caja'}
                    </Button>
                </form>
            </div>
        </div>
    );
};
