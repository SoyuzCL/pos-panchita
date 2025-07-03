import React, { useState, useEffect, useCallback } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { apiService } from '../services/apiService';
import type { Activity, SaleLog, ActionLog } from '../types/definitions';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export const ReportsView: React.FC = () => {
    const { showModal } = useAppContext(); 
    const [activities, setActivities] = useState<Activity[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [filterStartDate, setFilterStartDate] = useState<string>(''); 
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

    const fetchActivities = useCallback(async () => { 
        setIsLoading(true); 
        try { 
            const params = new URLSearchParams(); 
            if (filterStartDate) params.append('startDate', filterStartDate); 
            if (filterEndDate) {
                const end = new Date(`${filterEndDate}T23:59:59.999`);
                params.append('endDate', end.toISOString());
            }
            const data: any[] = await apiService.get(`/sales?${params.toString()}`); 
            
            const parsedActivities: Activity[] = data.map(activity => {
                if (activity.type === 'SALE') {
                    return { ...activity, total_amount: parseFloat(activity.total_amount || '0'),
                        items: (activity.items || []).map((item: any) => ({ ...item, price_at_sale: parseFloat(item.price_at_sale || '0'), subtotal: parseFloat(item.subtotal || '0') }))
                    };
                }
                return activity as ActionLog;
            });
            setActivities(parsedActivities); 
        } catch (error: any) { 
            showModal("Error de Red", `No se pudieron cargar los reportes: ${error.message}`, 'error'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [showModal, filterStartDate, filterEndDate]);

    useEffect(() => { 
        const today = new Date(); 
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilterStartDate(firstDayOfMonth.toISOString().split('T')[0]); 
        setFilterEndDate(today.toISOString().split('T')[0]); 
    }, []);

    useEffect(() => { 
        if(filterStartDate && filterEndDate) { fetchActivities(); } 
    }, [fetchActivities, filterStartDate, filterEndDate]);

    const salesOnly = activities.filter(a => a.type === 'SALE') as SaleLog[];
    const totalRevenue = salesOnly.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalSalesCount = salesOnly.length;
    const toggleExpand = (saleId: string) => setExpandedSaleId(prevId => (prevId === saleId ? null : saleId));

    return (
        <div className="p-4 bg-gray-100 h-full flex flex-col">
            <div className="bg-white p-4 rounded-lg shadow-md mb-4 shrink-0">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Reporte de Actividad y Ventas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-md">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                        <Input type="date" id="startDate" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                        <Input type="date" id="endDate" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={fetchActivities} variant="primary" className="w-full">
                            <Icon icon={Filter} /> Aplicar Filtros
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-500 text-white p-4 rounded-lg shadow"><h4 className="text-lg">Ingresos Totales (del período)</h4><p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p></div>
                    <div className="bg-green-500 text-white p-4 rounded-lg shadow"><h4 className="text-lg">Número de Ventas (del período)</h4><p className="text-3xl font-bold">{totalSalesCount}</p></div>
                </div>
            </div>
            <div className="flex-grow overflow-auto bg-white p-4 rounded-lg shadow-md">
                {isLoading ? <p className="text-center text-gray-500 py-8">Cargando reportes...</p> : activities.length === 0 ? <p className="text-center text-gray-500 py-8">No hay actividad para el período seleccionado.</p> : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="p-3 w-1/6">Fecha y Hora</th><th scope="col" className="p-3 w-1/6">Usuario</th><th scope="col" className="p-3">Acción / Detalles</th>
                                <th scope="col" className="p-3 text-right w-1/6">Monto</th><th scope="col" className="p-3 text-center w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.map(activity => (
                                activity.type === 'SALE' ? (
                                    <React.Fragment key={activity.id}>
                                        <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(activity.id)}>
                                            <td className="p-3 whitespace-nowrap">{new Date(activity.created_at).toLocaleString('es-CL')}</td>
                                            <td className="p-3 font-medium">{activity.employee_name}</td>
                                            <td className="p-3"><span className="font-semibold text-green-700">Venta ({activity.payment_method})</span><span className="text-gray-500 ml-2 font-mono text-xs">ID: {activity.id.substring(0,8)}</span></td>
                                            <td className="p-3 text-right font-semibold">${(activity.total_amount).toFixed(2)}</td>
                                            <td className="p-3 text-center"><button className="text-blue-600 hover:text-blue-800"><Icon icon={expandedSaleId === activity.id ? ChevronUp : ChevronDown} /></button></td>
                                        </tr>
                                        {expandedSaleId === activity.id && (
                                            <tr className="bg-gray-50"><td colSpan={5} className="p-4">
                                                <h4 className="font-bold mb-2 text-gray-700">Detalle de la Venta:</h4>
                                                <table className="w-full text-xs bg-white rounded-md"><thead className="bg-gray-200">
                                                    <tr><th className="p-2 text-left">Producto</th><th className="p-2 text-center">Cantidad</th><th className="p-2 text-right">Precio Unit.</th><th className="p-2 text-right">Subtotal</th></tr>
                                                </thead><tbody>
                                                    {(activity as SaleLog).items.map((item, index) => (<tr key={index} className="border-b"><td className="p-2">{item.product_name}</td><td className="p-2 text-center">{item.quantity}</td><td className="p-2 text-right">${item.price_at_sale.toFixed(2)}</td><td className="p-2 text-right font-medium">${item.subtotal.toFixed(2)}</td></tr>))}
                                                </tbody></table>
                                            </td></tr>
                                        )}
                                    </React.Fragment>
                                ) : (
                                    <tr key={activity.id} className="border-b">
                                        <td className="p-3 whitespace-nowrap">{new Date(activity.created_at).toLocaleString('es-CL')}</td><td className="p-3 font-medium">{activity.employee_name}</td>
                                        <td className="p-3"><span className="font-semibold text-gray-600">{(activity as ActionLog).action_type.replace(/_/g, ' ')}</span><p className="text-gray-500">{(activity as ActionLog).details}</p></td>
                                        <td className="p-3 text-right text-gray-400">--</td><td className="p-3 text-center"></td>
                                    </tr>
                                )
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
