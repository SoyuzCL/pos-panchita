import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Icon } from '../ui/Icon';

interface PaymentMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number;
    onProcessSale: (paymentMethod: 'efectivo' | 'tarjeta' | 'venta especial', details?: { amountPaid?: number; adminRut?: string; adminPassword?: string }) => Promise<void>;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({ isOpen, onClose, totalAmount, onProcessSale }) => {
    const [step, setStep] = useState<'selection' | 'cash_payment' | 'special_sale_auth'>('selection');
    const [amountPaid, setAmountPaid] = useState('');
    const [adminRut, setAdminRut] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setAmountPaid('');
            setAdminRut('');
            setAdminPassword('');
            setIsProcessing(false);
        }
    }, [isOpen]);

    const handleProcessCard = async () => {
        setIsProcessing(true);
        await onProcessSale('tarjeta');
        setIsProcessing(false);
    };
    
    const handleProcessCash = async () => {
        const paid = parseFloat(amountPaid);
        if (isNaN(paid) || paid < totalAmount) return;
        setIsProcessing(true);
        await onProcessSale('efectivo', { amountPaid: paid });
        setIsProcessing(false);
    };

    const handleProcessSpecialSale = async () => {
        if (!adminRut || !adminPassword) return;
        setIsProcessing(true);
        await onProcessSale('venta especial', { adminRut, adminPassword });
        setIsProcessing(false);
    };

    const change = parseFloat(amountPaid) - totalAmount;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Método de Pago">
            <div className="text-center mb-4">
                <p className="text-gray-600">Monto Total a Pagar</p>
                <p className="text-4xl font-bold text-blue-600">${totalAmount.toLocaleString('es-CL')}</p>
            </div>

            {step === 'selection' && (
                <div className="grid grid-cols-1 gap-3">
                    <Button onClick={() => setStep('cash_payment')} className="w-full bg-green-500 hover:bg-green-600 text-white" size="lg">Efectivo</Button>
                    <Button onClick={handleProcessCard} className="w-full bg-sky-500 hover:bg-sky-600 text-white" size="lg" disabled={isProcessing}>
                        {isProcessing ? 'Procesando...' : 'Tarjeta'}
                    </Button>
                    <Button onClick={() => setStep('special_sale_auth')} className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="lg">
                        <Icon icon={Star} /> Venta Especial
                    </Button>
                </div>
            )}

            {step === 'cash_payment' && (
                <div className="space-y-4">
                    <Input 
                        label="¿Con cuánto paga el cliente?"
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="Ingrese el monto recibido"
                        autoFocus
                    />
                    {change >= 0 && (
                        <div className="text-center bg-gray-100 p-3 rounded-lg">
                           <p className="text-gray-600">Cambio a entregar</p>
                           <p className="text-3xl font-bold text-green-700">${Math.round(change).toLocaleString('es-CL')}</p>
                        </div>
                    )}
                    <div className="flex gap-4">
                        <Button variant="secondary" onClick={() => setStep('selection')} className="w-full">Volver</Button>
                        <Button 
                            onClick={handleProcessCash} 
                            className="w-full" 
                            disabled={isProcessing || parseFloat(amountPaid) < totalAmount || isNaN(parseFloat(amountPaid))}
                        >
                            {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'special_sale_auth' && (
                <div className="space-y-4">
                    <h4 className="text-center font-semibold text-gray-700">Autorización de Administrador</h4>
                    <Input label="RUT del Administrador" value={adminRut} onChange={e => setAdminRut(e.target.value)} required placeholder="12.345.678-9"/>
                    <Input label="Contraseña del Administrador" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
                    <div className="flex gap-4">
                        <Button variant="secondary" onClick={() => setStep('selection')} className="w-full">Volver</Button>
                        <Button onClick={handleProcessSpecialSale} className="w-full" disabled={isProcessing || !adminRut || !adminPassword}>
                            {isProcessing ? 'Procesando...' : 'Confirmar Venta Especial'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
