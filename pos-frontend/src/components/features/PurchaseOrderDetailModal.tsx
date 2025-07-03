// src/components/features/PurchaseOrderDetailModal.tsx

import React, { useState, useEffect } from 'react';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/definitions';
import { useAppContext } from '../../contexts/AppContext';
import { apiService } from '../../services/apiService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ReceptionItem extends PurchaseOrderItem {
    product_name: string;
    reception_qty: string;
    new_cost: string;
}

interface PurchaseOrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder | null;
    onOrderUpdated: () => void;
}

export const PurchaseOrderDetailModal: React.FC<PurchaseOrderDetailModalProps> = ({ isOpen, onClose, order, onOrderUpdated }) => {
    const { showModal } = useAppContext();
    const [mode, setMode] = useState<'view' | 'receive'>('view');
    const [receptionItems, setReceptionItems] = useState<ReceptionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fullOrder, setFullOrder] = useState<PurchaseOrder | null>(null);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            if (isOpen && order) {
                setIsLoading(true);
                try {
                    const detailedOrderData = await apiService.get(`/purchase-orders/${order.id}`);
                    setFullOrder(detailedOrderData);
                } catch (error: any) {
                    showModal('Error', `No se pudieron cargar los detalles de la orden: ${error.message}`, 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchOrderDetails();
        // Resetear el modo a 'view' cada vez que el modal se abre o cambia la orden
        setMode('view');
    }, [isOpen, order, showModal]);

    const handleStartReception = () => {
        if (!fullOrder) return;
        const itemsToReceive = fullOrder.items.map(item => ({
            ...item,
            reception_qty: (item.quantity_ordered - item.quantity_received).toString(),
            new_cost: item.cost_price_at_purchase.toString(),
        }));
        setReceptionItems(itemsToReceive as ReceptionItem[]);
        setMode('receive');
    };
    
    const handleItemChange = (itemId: string, field: 'reception_qty' | 'new_cost', value: string) => {
        setReceptionItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
    };

    const handleConfirmReception = async () => {
        if (!fullOrder) return;
        const payload = {
            items_received: receptionItems.map(item => ({
                item_id: item.id,
                quantity_received: parseInt(item.reception_qty) || 0,
                new_cost_price: parseFloat(item.new_cost) || 0
            }))
        };
        
        setIsLoading(true);
        try {
            await apiService.put(`/purchase-orders/${fullOrder.id}/receive`, payload);
            showModal('Éxito', 'Recepción registrada correctamente. El stock ha sido actualizado.', 'success');
            onOrderUpdated(); // Recarga la lista de órdenes en la vista principal
            onClose(); // Cierra el modal
        } catch (error: any) {
            showModal('Error', `No se pudo registrar la recepción: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderFooter = () => {
        if (mode === 'view') {
            const isReceivable = fullOrder?.status === 'ordenado' || fullOrder?.status === 'recibido_parcial';
            return (
                <div className="flex justify-between w-full">
                    <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                    {isReceivable && <Button onClick={handleStartReception}>Recibir Mercancía</Button>}
                </div>
            );
        }
        return (
            <div className="flex justify-between w-full">
                <Button variant="secondary" onClick={() => setMode('view')}>Cancelar</Button>
                <Button onClick={handleConfirmReception} disabled={isLoading}>{isLoading ? 'Procesando...' : 'Confirmar Recepción'}</Button>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle Orden #${order?.id.substring(0,8)}`} size="3xl" footer={renderFooter()}>
            {isLoading && <p>Cargando detalles...</p>}
            {!isLoading && fullOrder && (
                <div className="space-y-4">
                    <div>
                        <p><strong>Proveedor:</strong> {fullOrder.supplier_name}</p>
                        <p><strong>Estado:</strong> <span className="font-semibold">{fullOrder.status.replace('_', ' ').toUpperCase()}</span></p>
                        <p><strong>Fecha de Orden:</strong> {new Date(fullOrder.order_date).toLocaleDateString('es-CL')}</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2 text-left">Producto</th>
                                {mode === 'view' ? (
                                    <>
                                        <th className="p-2 text-center">Pedido</th>
                                        <th className="p-2 text-center">Recibido</th>
                                        <th className="p-2 text-right">Costo Unit.</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-2 text-center">Cant. a Recibir</th>
                                        <th className="p-2 text-center">Nuevo Costo</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {mode === 'view' ? (
                                fullOrder.items.map(item => (
                                    <tr key={item.id} className="border-b">
                                        <td className="p-2 font-medium">{(item as any).product_name}</td>
                                        <td className="p-2 text-center">{item.quantity_ordered}</td>
                                        <td className="p-2 text-center">{item.quantity_received}</td>
                                        <td className="p-2 text-right">${parseFloat(item.cost_price_at_purchase as any).toFixed(2)}</td>
                                    </tr>
                                ))
                            ) : (
                                receptionItems.map(item => (
                                    <tr key={item.id} className="border-b bg-yellow-50">
                                        <td className="p-2 font-medium">{item.product_name}</td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                value={item.reception_qty}
                                                onChange={e => handleItemChange(item.id, 'reception_qty', e.target.value)}
                                                className="w-24 text-center mx-auto"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={item.new_cost}
                                                onChange={e => handleItemChange(item.id, 'new_cost', e.target.value)}
                                                className="w-28 text-center mx-auto"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    );
};