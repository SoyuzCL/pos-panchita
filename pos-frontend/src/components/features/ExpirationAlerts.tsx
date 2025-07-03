import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import type { Product } from '../../types/definitions';
import { Icon } from '../ui/Icon';

export const ExpirationAlerts: React.FC = () => {
    const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExpiringProducts = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.get('/products/expiring-soon');
                setExpiringProducts(data);
            } catch (error) {
                console.error("Error fetching expiring products:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExpiringProducts();
    }, []);

    const daysUntilExpiration = (dateString: string) => {
        const today = new Date();
        const expirationDate = new Date(dateString);
        today.setHours(0, 0, 0, 0);
        expirationDate.setMinutes(expirationDate.getMinutes() + expirationDate.getTimezoneOffset());
        expirationDate.setHours(0, 0, 0, 0);
        const diffTime = expirationDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-md h-full flex flex-col">
            <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2 mb-2">
                <Icon icon={AlertTriangle} />
                Próximos a Vencer
            </h3>
            {isLoading ? <p className="text-center text-sm text-gray-500 flex-grow">Cargando...</p> : 
             expiringProducts.length === 0 ? (
                <div className="text-center text-sm text-green-700 flex-grow flex items-center justify-center">No hay productos por vencer.</div>
            ) : (
                <div className="max-h-48 overflow-y-auto flex-grow">
                    <ul className="divide-y divide-yellow-200">
                        {expiringProducts.map(product => {
                            const daysLeft = daysUntilExpiration(product.fecha_vencimiento!);
                            const isUrgent = daysLeft <= 7;
                            const hasExpired = daysLeft < 0;

                            let statusText = `Vence en ${daysLeft} día(s)`;
                            if (daysLeft === 0) statusText = 'Vence Hoy';
                            if (hasExpired) statusText = `Venció hace ${Math.abs(daysLeft)} día(s)`;

                            return (
                                <li key={product.id} className="p-2 flex justify-between items-center text-sm">
                                    <div>
                                        <span className="font-semibold text-gray-800">{product.name}</span>
                                        <span className="text-xs text-gray-600 ml-2">(Stock: {product.stock})</span>
                                    </div>
                                    <span className={`font-bold ${hasExpired || isUrgent ? 'text-red-600' : 'text-yellow-800'}`}>
                                        {statusText}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};
