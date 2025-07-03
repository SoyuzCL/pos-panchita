import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useCashSession } from '../../contexts/CashSessionContext';
import { apiService } from '../../services/apiService';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface CashMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({ isOpen, onClose }) => {
    const { showModal } = useAppContext();
    const { setSession } = useCashSession();
    const [type, setType] = useState<'ADD' | 'REMOVE'>('ADD');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [adminRut, setAdminRut] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const newSessionState = await apiService.post('/cash-movements', { type, amount: parseFloat(amount), reason, adminRut, adminPassword });
            if (setSession) setSession(newSessionState);
            showModal('Éxito', 'El movimiento de caja se ha registrado correctamente.', 'success');
            onClose();
        } catch (error: any) {
            showModal('Error en Movimiento', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
      if(isOpen) {
        setAmount('');
        setReason('');
        setAdminRut('');
        setAdminPassword('');
        setType('ADD');
      }
    }, [isOpen]);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Gestionar Efectivo de Caja"
            footer={
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" form="cash-form" disabled={isLoading}>
                        {isLoading ? 'Procesando...' : 'Confirmar Movimiento'}
                    </Button>
                </div>
            }
        >
            <form id="cash-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                    <button type="button" onClick={() => setType('ADD')} className={`flex-1 p-2 rounded-md font-semibold text-sm ${type === 'ADD' ? 'bg-green-500 text-white shadow' : 'text-gray-600'}`}>Agregar Dinero</button>
                    <button type="button" onClick={() => setType('REMOVE')} className={`flex-1 p-2 rounded-md font-semibold text-sm ${type === 'REMOVE' ? 'bg-red-500 text-white shadow' : 'text-gray-600'}`}>Retirar Dinero</button>
                </div>
                <Input label="Monto" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
                <Input label="Motivo" value={reason} onChange={e => setReason(e.target.value)} required />
                <div className="p-3 border-t border-dashed space-y-3">
                    <h4 className="font-semibold text-gray-700">Aprobación de Administrador</h4>
                    <Input label="RUT del Administrador" value={adminRut} onChange={e => setAdminRut(e.target.value)} required />
                    <Input label="Contraseña del Administrador" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
                </div>
            </form>
        </Modal>
    );
};
