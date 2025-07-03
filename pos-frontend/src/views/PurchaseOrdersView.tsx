// src/views/PurchaseOrdersView.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { FilePlus, Eye as EyeIcon } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { apiService } from '../services/apiService';
import type { PurchaseOrder, Supplier, Product, PurchaseOrderStatus } from '../types/definitions';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { CreatePurchaseOrderModal } from '../components/features/CreatePurchaseOrderModal';
import { PurchaseOrderDetailModal } from '../components/features/PurchaseOrderDetailModal';

const StatusBadge: React.FC<{ status: PurchaseOrderStatus }> = ({ status }) => {
    // ... (El código de este componente no cambia)
    const styles = {
        ordenado: 'bg-blue-100 text-blue-800',
        recibido_parcial: 'bg-yellow-100 text-yellow-800',
        recibido_completo: 'bg-green-100 text-green-800',
        cancelado: 'bg-red-100 text-red-800',
        pendiente: 'bg-gray-100 text-gray-800'
    };
    const text = {
        ordenado: 'Ordenado',
        recibido_parcial: 'Recibido Parcial',
        recibido_completo: 'Recibido Completo',
        cancelado: 'Cancelado',
        pendiente: 'Pendiente'
    }
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{text[status]}</span>
}


export const PurchaseOrdersView: React.FC = () => {
    const { showModal } = useAppContext();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    // --- NUEVOS ESTADOS ---
    const [lowStockProductIds, setLowStockProductIds] = useState<Set<string>>(new Set());
    const [onOrderProductIds, setOnOrderProductIds] = useState<Set<string>>(new Set());
    // ----------------------
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // --- ACTUALIZAMOS PARA TRAER TODOS LOS DATOS A LA VEZ ---
            const [ordersData, suppliersData, productsData, lowStockData, onOrderData] = await Promise.all([
                apiService.get('/purchase-orders'),
                apiService.get('/suppliers'),
                apiService.get('/products?include_inactive=true'),
                apiService.get('/products/low-stock'),
                apiService.get('/products/on-order')
            ]);
            setOrders(ordersData);
            setSuppliers(suppliersData);
            setProducts(productsData);
            // Guardamos los IDs en Sets para una búsqueda rápida
            setLowStockProductIds(new Set(lowStockData.map((p: Product) => p.id)));
            setOnOrderProductIds(new Set(onOrderData));
            // -----------------------------------------------------
        } catch (error: any) {
            showModal('Error', `No se pudieron cargar los datos necesarios: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showModal]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenDetailModal = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    }

    return (
        <>
        <CreatePurchaseOrderModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)}
            onOrderCreated={fetchData}
            suppliers={suppliers}
            products={products}
            // --- Pasamos los nuevos props al modal ---
            lowStockProductIds={lowStockProductIds}
            onOrderProductIds={onOrderProductIds}
            // -----------------------------------------
        />
        <PurchaseOrderDetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            order={selectedOrder}
            onOrderUpdated={fetchData}
        />

        <div className="h-full flex flex-col bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Órdenes de Compra a Proveedores</h3>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Icon icon={FilePlus} /> Crear Nueva Orden
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {isLoading ? <p>Cargando órdenes...</p> : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="p-3">Proveedor</th>
                                <th className="p-3">Fecha de Orden</th>
                                <th className="p-3">Entrega Estimada</th>
                                <th className="p-3 text-right">Costo Total</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{order.supplier_name}</td>
                                    <td className="p-3">{new Date(order.order_date).toLocaleDateString('es-CL')}</td>
                                    <td className="p-3">{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'}</td>
                                    <td className="p-3 text-right">${parseFloat(order.total_cost as any).toFixed(2)}</td>
                                    <td className="p-3 text-center"><StatusBadge status={order.status} /></td>
                                    <td className="p-3 text-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetailModal(order)}>
                                            <Icon icon={EyeIcon} /> Ver Detalles
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        </>
    );
}