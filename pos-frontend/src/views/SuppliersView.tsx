import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Supplier } from '../types/definitions';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const SuppliersView: React.FC = () => {
    const { showModal } = useAppContext();
    const { canManageSuppliers } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [form, setForm] = useState<Omit<Supplier, 'id'>>({ name: '', rut: '', contact_person: '', phone: '', email: '', address: '' });

    const fetchSuppliers = useCallback(async () => { 
        setIsLoading(true); 
        try { 
            const data = await apiService.get('/suppliers'); 
            setSuppliers(data); 
        } catch (error: any) { 
            showModal('Error', `No se pudo cargar proveedores: ${error.message}`, 'error'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [showModal]);

    useEffect(() => { fetchSuppliers() }, [fetchSuppliers]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const selectSupplier = (supplier: Supplier) => { setSelectedSupplier(supplier); setForm(supplier); };
    const clearForm = () => { setSelectedSupplier(null); setForm({ name: '', rut: '', contact_person: '', phone: '', email: '', address: '' }); };

    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if(!form.name) return; 
        try { 
            if(selectedSupplier) { 
                await apiService.put(`/suppliers/${selectedSupplier.id}`, form); 
            } else { 
                await apiService.post('/suppliers', form); 
            } 
            showModal('Éxito', `Proveedor ${selectedSupplier ? 'actualizado' : 'creado'}.`, 'success'); 
            clearForm(); 
            fetchSuppliers(); 
        } catch(error: any) { 
            showModal('Error', error.message, 'error'); 
        }
    };

    const handleDelete = () => { 
        if(!selectedSupplier) return; 
        showModal('Confirmar', `¿Eliminar a ${selectedSupplier.name}?`, 'confirm', async () => { 
            try { 
                await apiService.delete(`/suppliers/${selectedSupplier.id}`); 
                showModal('Éxito', 'Proveedor eliminado', 'success'); 
                clearForm(); 
                fetchSuppliers(); 
            } catch(error: any) { 
                showModal('Error', 'No se pudo eliminar el proveedor.', 'error'); 
            } 
        });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 p-4 h-full overflow-hidden bg-gray-100">
           <div className="lg:w-3/5 flex flex-col bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-bold mb-3">Lista de Proveedores</h3>
                <div className="overflow-y-auto flex-grow">{isLoading ? <p>Cargando...</p> : 
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left font-semibold border-b">
                            <th className="p-2">Nombre</th>
                            <th className="p-2">Contacto</th>
                            <th className="p-2">Teléfono</th>
                            <th className="p-2">Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map(s=>(
                            <tr key={s.id} onClick={()=>selectSupplier(s)} className="cursor-pointer hover:bg-gray-50 border-b">
                                <td className="p-2 font-medium">{s.name}</td>
                                <td className="p-2">{s.contact_person}</td>
                                <td className="p-2">{s.phone}</td>
                                <td className="p-2">{s.email}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                }</div>
           </div>
           <div className="lg:w-2/5 bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-bold mb-3">{selectedSupplier ? 'Editar' : 'Nuevo'} Proveedor</h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input label="Nombre" name="name" value={form.name || ''} onChange={handleInputChange} required disabled={!canManageSuppliers}/>
                    <Input label="RUT" name="rut" value={form.rut || ''} onChange={handleInputChange} disabled={!canManageSuppliers}/>
                    <Input label="Contacto" name="contact_person" value={form.contact_person || ''} onChange={handleInputChange} disabled={!canManageSuppliers}/>
                    <Input label="Teléfono" name="phone" value={form.phone || ''} onChange={handleInputChange} disabled={!canManageSuppliers}/>
                    <Input label="Email" name="email" value={form.email || ''} type="email" onChange={handleInputChange} disabled={!canManageSuppliers}/>
                    <Input label="Dirección" name="address" value={form.address || ''} onChange={handleInputChange} disabled={!canManageSuppliers}/>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={!canManageSuppliers} className="flex-1 bg-green-600 hover:bg-green-700 text-white">{selectedSupplier ? 'Guardar' : 'Crear'}</Button>
                        {selectedSupplier && <Button type="button" onClick={handleDelete} variant="danger" disabled={!canManageSuppliers}>Eliminar</Button>}
                    </div>
                    {selectedSupplier && <Button type="button" variant="secondary" onClick={clearForm} className="w-full mt-2">Cancelar</Button>}
                </form>
           </div>
        </div>
    );
};
