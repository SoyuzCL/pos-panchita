import React, { useState, useEffect } from 'react';
import type { Product, Supplier } from '../../types/definitions';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { PRODUCT_CATEGORIES } from '../../constants';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    suppliers: Supplier[];
    onSave: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, product, suppliers, onSave }) => {
    const { showModal } = useAppContext();
    const { canManageInventory } = useAuth();
    const [form, setForm] = useState({ name: '', code: '', category: '', cost_price: '', stock: '', supplier_id: '', fecha_vencimiento: '' });
    const [recalculatePrice, setRecalculatePrice] = useState(true);

    useEffect(() => {
        if (product) {
            setForm({ 
                name: product.name, 
                code: product.code || '', 
                category: product.category, 
                cost_price: (product.cost_price || 0).toString(), 
                stock: product.stock.toString(), 
                supplier_id: product.supplier_id || '',
                fecha_vencimiento: product.fecha_vencimiento ? product.fecha_vencimiento.split('T')[0] : '' 
            });
            setRecalculatePrice(true);
        } else {
            setForm({ name: '', code: '', category: '', cost_price: '', stock: '', supplier_id: '', fecha_vencimiento: '' });
        }
    }, [product, isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const productData = { ...form, cost_price: parseFloat(form.cost_price), stock: parseInt(form.stock), supplier_id: form.supplier_id || null, recalculate_price: recalculatePrice, fecha_vencimiento: form.fecha_vencimiento || null };
        if (!productData.name || !productData.category || isNaN(productData.cost_price) || isNaN(productData.stock)) {
            showModal("Datos Inválidos", "Nombre, categoría, costo y stock son obligatorios.", 'info'); return;
        }
        try {
            if (product) {
                await apiService.put(`/products/${product.id}`, productData); showModal("Éxito", "Producto actualizado.", 'success');
            } else {
                await apiService.post('/products', productData); showModal("Éxito", "Producto agregado.", 'success');
            }
            onSave();
            onClose();
        } catch (error: any) {
            showModal("Error", `No se pudo guardar el producto: ${error.message}`, 'error');
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Editar Producto' : 'Nuevo Producto'}
            footer={ <div className="flex gap-3"> <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button> <Button type="submit" form="product-form" disabled={!canManageInventory} className="bg-blue-600 hover:bg-blue-700 text-white">{product ? 'Guardar Cambios' : 'Crear Producto'}</Button> </div> }
        >
            <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nombre del Artículo" name="name" value={form.name} onChange={handleInputChange} required disabled={!canManageInventory} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Código" name="code" value={form.code} onChange={handleInputChange} placeholder="Opcional" disabled={!canManageInventory} />
                    <Select label="Categoría" name="category" value={form.category} onChange={handleInputChange} required disabled={!canManageInventory}>
                        <option value="">Seleccione una categoría</option>
                        {PRODUCT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </Select>
                </div>
                <Select label="Proveedor" name="supplier_id" value={form.supplier_id} onChange={handleInputChange} disabled={!canManageInventory}>
                    <option value="">Sin Proveedor</option>
                    {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </Select>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Precio de Costo" name="cost_price" type="number" step="0.01" value={form.cost_price} onChange={handleInputChange} required disabled={!canManageInventory} />
                    <Input label="Stock Actual" name="stock" type="number" value={form.stock} onChange={handleInputChange} required disabled={!canManageInventory} />
                </div>
                <Input label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value={form.fecha_vencimiento} onChange={handleInputChange} disabled={!canManageInventory} />
                {product && ( <div className="flex items-center gap-2 text-sm"> <input type="checkbox" id="recalculate" checked={recalculatePrice} onChange={e => setRecalculatePrice(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" disabled={!canManageInventory} /> <label htmlFor="recalculate" className="text-gray-700">Recalcular precio de venta basado en el nuevo costo</label> </div> )}
            </form>
        </Modal>
    );
};
