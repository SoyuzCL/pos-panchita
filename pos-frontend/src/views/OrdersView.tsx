import React, { useState } from 'react';
import { CustomerOrdersView } from './CustomerOrdersView';
import { PurchaseOrdersView } from './PurchaseOrdersView';

export const OrdersView: React.FC = () => {
    const [view, setView] = useState<'customer' | 'purchase'>('customer');

    return (
        <div className="p-4 bg-gray-100 h-full flex flex-col">
            <div className="flex items-center border-b border-gray-300 mb-4">
                <button 
                    onClick={() => setView('customer')}
                    className={`px-4 py-2 text-lg font-semibold ${view === 'customer' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                    Pedidos de Clientes
                </button>
                <button 
                    onClick={() => setView('purchase')}
                    className={`px-4 py-2 text-lg font-semibold ${view === 'purchase' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                    Pedidos a Proveedores
                </button>
            </div>
            <div className="flex-grow overflow-hidden">
                {view === 'customer' ? <CustomerOrdersView /> : <PurchaseOrdersView />}
            </div>
        </div>
    );
}
