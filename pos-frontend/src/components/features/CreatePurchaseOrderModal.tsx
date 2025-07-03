import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Icon } from '../ui/Icon';
import { useAppContext } from '../../contexts/AppContext';
import { apiService } from '../../services/apiService';
import type { PurchaseOrderItem, Supplier, Product } from '../../types/definitions';

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOrderCreated: () => void;
    suppliers: Supplier[];
    products: Product[];
    lowStockProductIds: Set<string>;
    onOrderProductIds: Set<string>;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
    isOpen, onClose, onOrderCreated, suppliers, products, lowStockProductIds, onOrderProductIds
}) => {
    const { showModal } = useAppContext();
    const [step, setStep] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [items, setItems] = useState<Array<Omit<PurchaseOrderItem, 'id' | 'quantity_received'> & { product_name: string }>>([]);
    const [notes, setNotes] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

    const resetForm = () => {
        setStep(1);
        setSelectedSupplierId('');
        setItems([]);
        setNotes('');
        setExpectedDeliveryDate('');
    }

    const handleClose = () => {
        resetForm();
        onClose();
    }

    const handleAddItem = (product: Product, quantity: number) => {
        if (quantity <= 0) return;
        setItems(prev => {
            const existingIndex = prev.findIndex(i => i.product_id === product.id);
            if(existingIndex > -1) {
                const newItems = [...prev];
                newItems[existingIndex].quantity_ordered += quantity;
                return newItems;
            } else {
                return [...prev, {
                    product_id: product.id,
                    product_name: product.name,
                    quantity_ordered: quantity,
                    cost_price_at_purchase: product.cost_price || 0
                }];
            }
        });
    }

    const handleUpdateItemQuantity = (productId: string, newQuantity: number) => {
        if(newQuantity <= 0) {
            setItems(prev => prev.filter(i => i.product_id !== productId));
        } else {
            setItems(prev => prev.map(i => i.product_id === productId ? {...i, quantity_ordered: newQuantity} : i));
        }
    }

    const totalCost = items.reduce((sum, item) => sum + (item.cost_price_at_purchase * item.quantity_ordered), 0);

    const handleSubmit = async () => {
        if(items.length === 0) {
            showModal('Error', 'Debe agregar al menos un producto a la orden.', 'error');
            return;
        }

        const payload = {
            supplier_id: selectedSupplierId,
            items: items.map(({ product_id, quantity_ordered, cost_price_at_purchase }) => ({ product_id, quantity: quantity_ordered, cost_price: cost_price_at_purchase })),
            total_cost: totalCost,
            notes,
            expected_delivery_date: expectedDeliveryDate || null,
        }

        try {
            await apiService.post('/purchase-orders', payload);
            showModal('Éxito', 'Orden de compra creada correctamente.', 'success');
            onOrderCreated();
            handleClose();
        } catch (error: any) {
            showModal('Error', `No se pudo crear la orden: ${error.message}`, 'error');
        }
    }

    const availableProducts = products.filter(p => !selectedSupplierId || p.supplier_id === selectedSupplierId);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Crear Orden de Compra" size="4xl"
            footer={
                <div className="w-full flex justify-between">
                    {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}><Icon icon={ArrowLeft} /> Volver</Button>}
                    <div className="flex gap-3 ml-auto">
                        <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                        {step === 1 && <Button onClick={() => setStep(2)} disabled={!selectedSupplierId || items.length === 0}>Siguiente <Icon icon={ChevronRight} /></Button>}
                        {step === 2 && <Button onClick={handleSubmit}>Enviar Orden</Button>}
                    </div>
                </div>
            }
        >
            {step === 1 && (
                <div className="grid grid-cols-2 gap-6">
                    {/* Columna Izquierda: Selección de productos */}
                    <div>
                        <h4 className="font-bold text-lg mb-2">Paso 1: Agregar Productos</h4>
                        <Select label="Seleccionar Proveedor" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                            <option value="">Seleccione un proveedor...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>

                        {selectedSupplierId && (
                            <div className="mt-4 border-t pt-4">
                                <h5 className="font-semibold mb-2">Productos Disponibles</h5>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                     {availableProducts.map(p => {
                                        const isOnOrder = onOrderProductIds.has(p.id);
                                        const isLowStock = lowStockProductIds.has(p.id);
                                        
                                        let textColor = "text-gray-800"; // Default
                                        if (isOnOrder) {
                                            textColor = "text-blue-600"; // Blue if already on order
                                        } else if (isLowStock) {
                                            textColor = "text-red-600"; // Red if low stock and not on order
                                        }

                                        return (
                                            <div key={p.id} className="bg-gray-50 p-2 rounded-md flex justify-between items-center">
                                                <div>
                                                    <p className={`font-medium text-sm ${textColor}`}>{p.name}</p>
                                                    <p className="text-xs text-gray-500">Costo: ${p.cost_price?.toFixed(2)} / Stock: {p.stock}</p>
                                                </div>
                                                <Button size="sm" onClick={() => handleAddItem(p, 1)}>Agregar</Button>
                                            </div>
                                        );
                                     })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Columna Derecha: Resumen de la orden */}
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-2">Resumen de Orden</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {items.length === 0 ? <p className="text-sm text-gray-500">Aún no hay productos.</p> :
                                items.map(item => (
                                    <div key={item.product_id} className="bg-white p-2 rounded-md flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-sm">{item.product_name}</p>
                                            <p className="text-xs text-gray-500">Costo: ${item.cost_price_at_purchase.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input type="number" value={item.quantity_ordered} onChange={(e) => handleUpdateItemQuantity(item.product_id, parseInt(e.target.value))} className="w-16 text-center" />
                                            <Button variant="ghost" size="sm" onClick={() => handleUpdateItemQuantity(item.product_id, 0)}><Icon icon={Trash2} className="text-red-500"/></Button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="mt-4 border-t pt-3 font-bold text-right">
                            Total: ${totalCost.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- CÓDIGO CORREGIDO Y COMPLETO PARA EL PASO 2 --- */}
            {step === 2 && (
                <div>
                    <h4 className="font-bold text-lg mb-4">Paso 2: Confirmar y Enviar</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input 
                            label="Fecha de Entrega Estimada (Opcional)" 
                            type="date" 
                            value={expectedDeliveryDate} 
                            onChange={e => setExpectedDeliveryDate(e.target.value)} 
                        />
                        <Input 
                            label="Notas Adicionales (Opcional)" 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ej: Contactar antes de entregar"
                        />
                     </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold mb-2">Resumen Final de la Orden</h5>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-200">
                                <tr className="border-b">
                                    <th className="text-left p-2">Producto</th>
                                    <th className="text-center p-2">Cantidad Pedida</th>
                                    <th className="text-right p-2">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.product_id} className="border-b">
                                        <td className="p-2">{item.product_name}</td>
                                        <td className="p-2 text-center">{item.quantity_ordered}</td>
                                        <td className="p-2 text-right">${(item.quantity_ordered * item.cost_price_at_purchase).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t font-bold">
                                    <td colSpan={2} className="p-2 text-right text-lg">Total General:</td>
                                    <td className="p-2 text-right text-lg">${totalCost.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            {/* -------------------------------------------------- */}
        </Modal>
    );
}