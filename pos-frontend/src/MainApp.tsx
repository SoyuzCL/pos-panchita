import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, BarChart3, ClipboardList, Building, LogOut, Briefcase } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useCashSession } from './contexts/CashSessionContext';
import type { Page } from './types/definitions';
import { SalesView } from './views/SalesView';
import { InventoryView } from './views/InventoryView';
import { ReportsView } from './views/ReportsView';
import { OrdersView } from './views/OrdersView';
import { SuppliersView } from './views/SuppliersView';
import { CashMovementModal } from './components/features/CashMovementModal';
import { Button } from './components/ui/Button';
import { Icon } from './components/ui/Icon';

const NavButton: React.FC<{ page: Page, label: string, icon: React.ElementType, current: Page, onClick: (page: Page) => void }> = ({ page, label, icon, current, onClick}) => (
    <button onClick={() => onClick(page)} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${current === page ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
        <Icon icon={icon}/>{label}
    </button>
);

export const MainApp: React.FC = () => {
  const { user, logout, canManageSuppliers } = useAuth();
  const { session } = useCashSession();
  const [currentPage, setCurrentPage] = useState<Page>('sales'); 
  const [currentTime, setCurrentTime] = useState(new Date()); 
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  
  useEffect(() => { 
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60); 
    return () => clearInterval(timer); 
  }, []);
  
  const renderPage = () => {
    switch (currentPage) {
        case 'sales': return <SalesView />;
        case 'inventory': return <InventoryView />;
        case 'reports': return <ReportsView />;
        case 'orders': return <OrdersView />;
        case 'suppliers': return canManageSuppliers ? <SuppliersView /> : <div className="p-4">Acceso denegado.</div>;
        default: return <SalesView />;
    }
  };
  
  return (
    <>
        <CashMovementModal isOpen={isCashModalOpen} onClose={() => setIsCashModalOpen(false)} />
        <div className="flex flex-col h-screen bg-gray-100 font-sans antialiased">
            <header className="bg-white shadow-sm px-4 py-2 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800">POS Panchita</h1>
                    <div className="text-xs text-gray-500">
                        <p>Usuario: <strong>{user?.name} ({user?.role})</strong></p>
                        <p>{currentTime.toLocaleDateString('es-CL')} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {session && <div className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                        Caja: ${session.current_balance.toFixed(2)}
                    </div>}
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setIsCashModalOpen(true)} variant="secondary" size="sm" disabled={!session}>
                        <Icon icon={Briefcase} /> Gestionar Caja
                    </Button>
                    <Button onClick={logout} variant="danger" size="sm"><Icon icon={LogOut} /> Salir</Button>
                </div>
            </header>

            <nav className="bg-white px-4 border-b border-gray-200 flex justify-center items-center">
                <div className="flex items-center">
                    <NavButton page="sales" label="Venta" icon={ShoppingCart} current={currentPage} onClick={setCurrentPage} />
                    <NavButton page="inventory" label="Inventario" icon={Package} current={currentPage} onClick={setCurrentPage} />
                    <NavButton page="orders" label="Pedidos" icon={ClipboardList} current={currentPage} onClick={setCurrentPage} />
                    <NavButton page="reports" label="Reportes" icon={BarChart3} current={currentPage} onClick={setCurrentPage} />
                    {canManageSuppliers && (
                        <NavButton page="suppliers" label="Proveedores" icon={Building} current={currentPage} onClick={setCurrentPage} />
                    )}
                </div>
            </nav>

            <main className="flex-1 overflow-hidden">{renderPage()}</main>
        </div>
    </>
  );
};
