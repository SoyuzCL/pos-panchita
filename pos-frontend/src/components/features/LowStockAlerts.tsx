// src/components/features/LowStockAlerts.tsx

import React, { useState, useEffect } from 'react';
import { Archive, ShoppingCart } from 'lucide-react'; // Importamos el nuevo ícono
import { apiService } from '../../services/apiService';
import type { Product } from '../../types/definitions';
import { Icon } from '../ui/Icon';

export const LowStockAlerts: React.FC = () => {
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    // Nuevo estado para guardar los IDs de productos ya pedidos
    const [orderedProductIds, setOrderedProductIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAlertData = async () => {
            setIsLoading(true);
            try {
                // Hacemos las dos llamadas a la API en paralelo para mayor eficiencia
                const [lowStockData, orderedIdsData] = await Promise.all([
                    apiService.get('/products/low-stock'),
                    apiService.get('/products/on-order')
                ]);
                
                setLowStockProducts(lowStockData);
                // Creamos un Set con los IDs para una búsqueda más rápida (O(1))
                setOrderedProductIds(new Set(orderedIdsData));

            } catch (error) {
                console.error("Error fetching alert data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAlertData();
    }, []);

    return (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-md shadow-md h-full flex flex-col">
            <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2 mb-2">
                <Icon icon={Archive} />
                Productos con Bajo Stock
            </h3>
            {isLoading ? <p className="text-center text-sm text-gray-500 flex-grow">Cargando...</p> :
             lowStockProducts.length === 0 ? (
                <div className="text-center text-sm text-green-700 flex-grow flex items-center justify-center">No hay productos con bajo stock.</div>
            ) : (
                <div className="max-h-48 overflow-y-auto flex-grow">
                    <ul className="divide-y divide-orange-200">
                        {lowStockProducts.map(product => (
                            <li key={product.id} className="p-2 flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                     {/* Lógica para mostrar el ícono si el producto fue pedido */}
                                     {orderedProductIds.has(product.id) && (
                                        <div title="Este producto ya fue pedido">
                                            <Icon icon={ShoppingCart} className="text-blue-500" />
                                        </div>
                                    )}
                                    <span className="font-semibold text-gray-800">{product.name}</span>
                                </div>
                                <span className={`font-bold ${product.stock <= 2 ? 'text-red-600' : 'text-orange-800'}`}>
                                    Quedan: {product.stock}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};