import React, { useState, useEffect, useCallback } from 'react';
import { Search, PlusCircle, Edit3, EyeOff, Eye } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Product, Supplier } from '../types/definitions';
import { PRODUCT_CATEGORIES } from '../constants';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ProductFormModal } from '../components/features/ProductFormModal';
import { ExpirationAlerts } from '../components/features/ExpirationAlerts';
import { LowStockAlerts } from '../components/features/LowStockAlerts';

export const InventoryView: React.FC = () => {
    const { showModal } = useAppContext();
    const { canManageInventory } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [productsData, suppliersData] = await Promise.all([ 
                apiService.get(`/products?include_inactive=true`), 
                apiService.get('/suppliers') 
            ]);
            setProducts(productsData); 
            setSuppliers(suppliersData);
        } catch (error: any) {
            showModal("Error de Red", `No se pudieron cargar los datos: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showModal]);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    const handleOpenModalForNew = () => { setEditingProduct(null); setIsModalOpen(true); };
    const handleOpenModalForEdit = (product: Product) => { setEditingProduct(product); setIsModalOpen(true); };

    const handleStockChange = async (product: Product, amount: number) => {
        const newStock = product.stock + amount;
        if (newStock < 0) return;

        const originalProducts = [...products];
        setProducts(prev => prev.map(p => {
            if (p.id === product.id) {
                const newIsActive = (p.stock <= 0 && newStock > 0) ? true : (newStock > 0 ? p.is_active : false);
                return { ...p, stock: newStock, is_active: newIsActive };
            }
            return p;
        }));

        try {
            const updatedProductFromServer = await apiService.put(`/products/${product.id}`, { 
                ...product, 
                stock: newStock 
            });
            setProducts(prev => prev.map(p => 
                p.id === product.id ? updatedProductFromServer : p
            ));
        } catch (error: any) {
            showModal("Error", `No se pudo actualizar el stock: ${error.message}`, 'error');
            setProducts(originalProducts);
        }
    };
    
    const handleToggleActive = (product: Product) => {
        const action = product.is_active ? 'desactivar' : 'activar';
        const confirmMessage = `¿Estás seguro de que quieres ${action} el producto "${product.name}"?`;

        if (!product.is_active && product.stock <= 0) {
            showModal('Acción no permitida', 'No se puede activar un producto sin stock. Por favor, actualiza el stock primero.', 'info');
            return;
        }
        
        showModal('Confirmar Acción', confirmMessage, 'confirm', async () => {
            try {
                const updatedProduct = await apiService.patch(`/products/${product.id}/toggle-status`);
                setProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p));
                showModal('Éxito', `Producto ${action}do correctamente.`, 'success');
            } catch (error: any) {
                showModal('Error', `No se pudo cambiar el estado del producto: ${error.message}`, 'error');
            }
        });
    };

    const filteredProducts = products.filter(p => (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase())) && (selectedCategory ? p.category === selectedCategory : true));

    return (
        <div className="p-4 bg-gray-100 h-full flex flex-col">
            <ProductFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={editingProduct} suppliers={suppliers} onSave={fetchInitialData}/>
            <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <Input icon={Search} type="text" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow"/>
                    <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="">Todas las Categorías</option>
                        {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </Select>
                    <Button onClick={handleOpenModalForNew} disabled={!canManageInventory} className="bg-blue-600 text-white hover:bg-blue-700">
                        <Icon icon={PlusCircle} /> Nuevo Producto
                    </Button>
                </div>
            </div>
            <div className="flex-grow overflow-auto bg-white p-4 rounded-lg shadow-md">
                {isLoading ? ( <p className="text-center text-gray-500">Cargando inventario...</p> ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="p-3">Artículo</th>
                                <th scope="col" className="p-3">Vencimiento</th>
                                <th scope="col" className="p-3 text-right">Precio Venta</th>
                                <th scope="col" className="p-3 text-center">Stock</th>
                                <th scope="col" className="p-3 text-center">Estado</th>
                                <th scope="col" className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className={`border-b hover:bg-gray-50 ${!product.is_active ? 'bg-gray-200 text-gray-500' : ''}`}>
                                    <td className="p-3 font-medium">{product.name}<br/><span className="text-xs">{product.category}</span></td>
                                    <td className="p-3">{product.fecha_vencimiento ? new Date(product.fecha_vencimiento).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'}</td>
                                    <td className="p-3 text-right font-semibold">${product.price.toFixed(2)}</td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button size="sm" variant="ghost" className="p-1" onClick={() => handleStockChange(product, -1)} disabled={!canManageInventory || product.stock <= 0}>-</Button>
                                            <span className="w-8 text-center font-bold">{product.stock}</span>
                                            <Button size="sm" variant="ghost" className="p-1" onClick={() => handleStockChange(product, 1)} disabled={!canManageInventory}>+</Button>
                                        </div>
                                    </td>
                                     <td className="px-4 py-2 text-center">{product.is_active ? <span className="text-green-600 font-semibold">Activo</span> : <span className="text-red-600 font-semibold">Inactivo</span>}</td>
                                     <td className="p-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => handleOpenModalForEdit(product)} disabled={!canManageInventory} title="Editar Producto">
                                                <Icon icon={Edit3} className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant={product.is_active ? 'danger' : 'custom'} 
                                                className={product.is_active ? '' : 'bg-green-500 hover:bg-green-600 text-white'}
                                                onClick={() => handleToggleActive(product)} 
                                                disabled={!canManageInventory}
                                                title={product.is_active ? 'Desactivar Producto' : 'Activar Producto'}
                                            >
                                                <Icon icon={product.is_active ? EyeOff : Eye} className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="shrink-0 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <ExpirationAlerts />
                <LowStockAlerts />
            </div>
        </div>
    );
};
