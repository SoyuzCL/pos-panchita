import React, { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import { BarChart, Package, Users, Clipboard as ClipboardIcon, Calendar as CalendarIcon, LogOut, Search, AlertCircle, PlusCircle, Edit, X, ChevronUp, ChevronDown } from 'lucide-react';

// --- CONFIGURACIÓN DE LA API ---
const API_BASE_URL = 'http://192.168.1.10:3001/api';

// --- DEFINICIONES DE TIPOS DE DATOS ---
interface Product {
    id: string; name: string; code: string; category: string; price: number; stock: number;
    is_active: boolean; cost_price: number; supplier_name?: string; fecha_vencimiento?: string;
}

interface User {
    id: string; name: string; role: 'admin' | 'cajero';
}

interface Employee {
    id: string; first_name: string; last_name: string; rut: string;
    role: 'admin' | 'cajero'; is_active: boolean; created_at: string;
}

interface SaleItem {
    product_id: string; product_name: string; quantity: number; price_at_sale: number;
}

interface Sale {
    id: string; type: 'SALE'; total_amount: number; payment_method: string;
    created_at: string; employee_name: string; items: SaleItem[];
}

interface ActionLog {
    id: string; type: 'LOG'; employee_name: string; action_type: string;
    details: string; created_at: string;
}

interface CustomerOrderItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
}

interface CustomerOrder {
    id: string;
    customer_name: string;
    customer_phone: string;
    delivery_date: string;
    total_amount: number;
    status: 'pendiente' | 'en_preparacion' | 'listo_para_entrega' | 'completado' | 'cancelado';
    notes: string;
    items: CustomerOrderItem[];
}

type ReportFeedItem = Sale | ActionLog;

// --- CONTEXTO PARA MODALES ---
const AppContext = createContext<{
    showModal: (title: string, message: React.ReactNode, type?: 'success' | 'error' | 'info') => void;
    showComponentInModal: (title: string, component: ReactNode) => void;
    hideModal: () => void;
} | null>(null);
const useAppContext = () => { const context = useContext(AppContext); if (!context) throw new Error("useAppContext must be used within AppProvider"); return context; };

// --- CONTEXTO DE AUTENTICACIÓN ---
const AuthContext = createContext<{ user: User | null; token: string | null; login: (token: string, user: User) => void; logout: () => void; } | null>(null);
const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; };

// --- SERVICIO DE API ---
const apiService = {
  request: async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', data?: any) => {
    const token = sessionStorage.getItem('token');
    if (!token) {
        sessionStorage.clear(); window.location.reload();
        throw new Error("No token found");
    }
    const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const config: RequestInit = { method, headers, body: data ? JSON.stringify(data) : undefined, };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (response.status === 401 || response.status === 403) {
        sessionStorage.clear(); window.location.reload();
        throw new Error("Unauthorized or Forbidden");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  },
  get: (endpoint: string) => apiService.request(endpoint, 'GET'),
  post: (endpoint: string, data: any) => apiService.request(endpoint, 'POST', data),
  put: (endpoint: string, data: any) => apiService.request(endpoint, 'PUT', data),
  publicPost: async (endpoint: string, data: any) => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const config: RequestInit = { method: 'POST', headers, body: JSON.stringify(data) };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}`);
    }
    return response.json();
  }
};


// --- COMPONENTES DE UI ---
const Button = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={`px-4 py-2 rounded-md font-semibold transition-colors ${className}`} {...props}>{children}</button>
);
const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>
);
const ErrorDisplay = ({ message }: { message: string }) => (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
        <p className="font-bold">Error</p><p>{message}</p>
    </div>
);


// --- FORMULARIO DE USUARIO (PARA CREAR/EDITAR) ---
const UserForm = ({ userToEdit, onFormSubmit }: { userToEdit?: Employee | null, onFormSubmit: () => void }) => {
    const { showModal, hideModal } = useAppContext();
    const [formData, setFormData] = useState({
        first_name: userToEdit?.first_name || '',
        last_name: userToEdit?.last_name || '',
        rut: userToEdit?.rut || '',
        role: userToEdit?.role || 'cajero',
        is_active: userToEdit?.is_active ?? true,
        password: '',
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        setFormData(prev => ({ ...prev, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (userToEdit) {
                const payload = { ...formData };
                if (!payload.password) {
                   delete (payload as any).password;
                }
                await apiService.put(`/employees/${userToEdit.id}`, payload);
                showModal('Éxito', 'Usuario actualizado correctamente.', 'success');
            } else {
                await apiService.post('/employees', formData);
                showModal('Éxito', 'Usuario creado correctamente.', 'success');
            }
            onFormSubmit();
        } catch (error: any) {
            showModal('Error', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input name="first_name" value={formData.first_name} onChange={handleChange} placeholder="Nombre" required className="w-full p-2 border rounded-md"/>
            <input name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Apellido" className="w-full p-2 border rounded-md"/>
            <input name="rut" value={formData.rut} onChange={handleChange} placeholder="RUT" required className="w-full p-2 border rounded-md"/>
            <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder={userToEdit ? "Nueva contraseña (opcional)" : "Contraseña"} required={!userToEdit} className="w-full p-2 border rounded-md"/>
            <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded-md">
                <option value="cajero">Cajero</option>
                <option value="admin">Admin</option>
            </select>
            <label className="flex items-center gap-2">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                Usuario Activo
            </label>
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" onClick={hideModal} className="bg-gray-200 hover:bg-gray-300">Cancelar</Button>
                <Button type="submit" disabled={isLoading} className="bg-blue-600 text-white hover:bg-blue-700">
                    {isLoading ? 'Guardando...' : 'Guardar'}
                </Button>
            </div>
        </form>
    );
};


// --- COMPONENTES DE VISTAS ---

const PedidosView = () => {
    const { showModal } = useAppContext();
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                const ordersData = await apiService.get('/customer-orders');
                setOrders(ordersData);
                setError(null);
            } catch (err: any) {
                setError(err.message);
                showModal("Error al Cargar Pedidos", err.message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [showModal]);

    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay message={error} />;
    
    const statusColors: Record<string, string> = {
        pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-400',
        en_preparacion: 'bg-blue-100 text-blue-800 border-blue-400',
        listo_para_entrega: 'bg-green-100 text-green-800 border-green-400',
        completado: 'bg-gray-100 text-gray-800 border-gray-400',
        cancelado: 'bg-red-100 text-red-800 border-red-400',
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Pedidos de Clientes</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {orders.length > 0 ? orders.map(order => (
                    <div key={order.id} className={`p-4 rounded-md border-l-4 ${statusColors[order.status] || 'bg-gray-100'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-gray-800">{order.customer_name}</p>
                                <p className="text-sm text-gray-600">Entregar: <span className="font-semibold">{new Date(order.delivery_date).toLocaleDateString('es-CL')}</span></p>
                                <p className="text-sm text-gray-500">Tel: {order.customer_phone}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[order.status]}`}>
                                {order.status.replace('_', ' ')}
                            </span>
                        </div>
                         <div className="mt-2 text-right">
                             <p className="text-lg font-bold text-gray-800">${(order.total_amount as number).toLocaleString('es-CL')}</p>
                         </div>
                        <details className="mt-2 text-sm text-gray-700">
                            <summary className="cursor-pointer text-blue-600">Ver detalles del pedido</summary>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                {order.items.map(item => (
                                    <li key={item.id}>{item.quantity} x {item.description}</li>
                                ))}
                            </ul>
                            {order.notes && <p className="mt-2 p-2 bg-gray-50 rounded-md"><strong>Notas:</strong> {order.notes}</p>}
                        </details>
                    </div>
                )) : <p>No hay pedidos para mostrar.</p>}
            </div>
        </div>
    );
};

const ProductosView = () => {
    const { showModal } = useAppContext();
    const [products, setProducts] = useState<Product[]>([]);
    const [lowStock, setLowStock] = useState<Product[]>([]);
    const [expiring, setExpiring] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProductData = async () => {
            try {
                setIsLoading(true);
                const [productsData, lowStockData, expiringData] = await Promise.all([
                    apiService.get('/products?include_inactive=true'),
                    apiService.get('/products/low-stock'),
                    apiService.get('/products/expiring-soon')
                ]);
                setProducts(productsData);
                setLowStock(lowStockData);
                setExpiring(expiringData);
                setError(null);
            } catch (err: any) {
                setError(err.message);
                showModal("Error al Cargar Datos de Productos", err.message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchProductData();
    }, [showModal]);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())));

    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay message={error} />;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Consulta de Productos</h3>
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="max-h-[45vh] overflow-y-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0"><tr><th scope="col" className="px-6 py-3">Nombre</th><th scope="col" className="px-6 py-3">Categoría</th><th scope="col" className="px-6 py-3 text-right">Precio</th><th scope="col" className="px-6 py-3 text-center">Stock</th><th scope="col" className="px-6 py-3 text-center">Estado</th></tr></thead>
                    <tbody>
                        {filteredProducts.map((product) => (
                            <tr key={product.id} className={`border-b ${!product.is_active ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{product.name}<span className="block text-xs text-gray-500 font-normal">{product.code}</span></th>
                                <td className="px-6 py-4">{product.category}</td><td className="px-6 py-4 text-right font-semibold">${product.price.toLocaleString('es-CL')}</td><td className="px-6 py-4 text-center">{product.stock}</td>
                                <td className="px-6 py-4 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{product.is_active ? 'Activo' : 'Inactivo'}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredProducts.length === 0 && <p className="text-center text-gray-500 py-8">No se encontraron productos.</p>}
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border border-orange-300">
                    <h3 className="text-lg font-semibold mb-3 text-orange-600 flex items-center gap-2"><AlertCircle /> Productos con Bajo Stock</h3>
                    {lowStock.length > 0 ? (
                        <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                            {lowStock.map(p => <li key={p.id} className="flex justify-between"><span>{p.name}</span> <span className="font-bold">{p.stock}</span></li>)}
                        </ul>
                    ) : <p className="text-sm text-gray-500">No hay productos con bajo stock.</p>}
                </div>
                 <div className="bg-white p-4 rounded-lg border border-red-300">
                    <h3 className="text-lg font-semibold mb-3 text-red-600 flex items-center gap-2"><AlertCircle /> Productos Próximos a Vencer</h3>
                     {expiring.length > 0 ? (
                        <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                            {expiring.map(p => <li key={p.id} className="flex justify-between"><span>{p.name}</span> <span className="font-bold">{new Date(p.fecha_vencimiento!).toLocaleDateString('es-CL')}</span></li>)}
                        </ul>
                    ) : <p className="text-sm text-gray-500">No hay productos próximos a vencer.</p>}
                </div>
            </div>
        </div>
    );
};

const AuditoriaView = () => {
    const { showModal } = useAppContext();
    const [data, setData] = useState<ReportFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAuditData = async () => {
            try { setIsLoading(true); const salesData = await apiService.get('/sales'); setData(salesData); setError(null); } catch (err: any) { setError(err.message); showModal("Error al Cargar Auditoría", err.message, 'error'); } finally { setIsLoading(false); }
        };
        fetchAuditData();
    }, [showModal]);

    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay message={error} />;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Registro de Actividad</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {data.map(item => (
                    <div key={item.id} className="p-4 rounded-md border">
                        {item.type === 'SALE' ? (
                            <div>
                                <div className="flex justify-between items-center"><span className="font-bold text-blue-600">VENTA</span><span className="text-sm text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}</span></div>
                                <p>Total: <span className="font-semibold">${(item.total_amount as number).toLocaleString('es-CL')}</span></p>
                                <p>Vendedor: {item.employee_name}</p>
                                <p>Método de Pago: <span className="capitalize">{item.payment_method}</span></p>
                                <details className="mt-2 text-sm"><summary className="cursor-pointer">Ver detalles</summary><ul className="list-disc pl-5 mt-1">{item.items.map(p => (<li key={p.product_id}>{p.quantity} x {p.product_name} (@ ${(p.price_at_sale as number).toLocaleString('es-CL')})</li>))}</ul></details>
                            </div>
                        ) : (
                             <div>
                                <div className="flex justify-between items-center"><span className="font-bold text-yellow-600">REGISTRO</span><span className="text-sm text-gray-500">{new Date(item.created_at).toLocaleString('es-CL')}</span></div>
                                <p>Usuario: {item.employee_name}</p><p>Acción: <span className="font-semibold">{item.action_type}</span></p><p>Detalles: {item.details}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const UsuariosView = () => {
    const { showComponentInModal, hideModal, showModal } = useAppContext();
    const [users, setUsers] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try { setIsLoading(true); const data = await apiService.get('/employees'); setUsers(data); setError(null); } catch (err: any) { setError(err.message); showModal("Error al Cargar Usuarios", err.message, 'error'); } finally { setIsLoading(false); }
    }, [showModal]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleFormSubmit = () => {
        hideModal();
        fetchUsers();
    };

    const openCreateModal = () => {
        showComponentInModal("Crear Nuevo Usuario", <UserForm onFormSubmit={handleFormSubmit} />);
    };

    const openEditModal = (user: Employee) => {
        showComponentInModal("Editar Usuario", <UserForm userToEdit={user} onFormSubmit={handleFormSubmit} />);
    };

    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay message={error} />;
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold">Gestión de Usuarios</h3>
                 <Button onClick={openCreateModal} className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"><PlusCircle size={18}/>Crear Usuario</Button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nombre</th><th scope="col" className="px-6 py-3">RUT</th>
                            <th scope="col" className="px-6 py-3">Rol</th><th scope="col" className="px-6 py-3 text-center">Estado</th>
                            <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{user.first_name} {user.last_name}</td>
                                <td className="px-6 py-4">{user.rut}</td><td className="px-6 py-4 capitalize">{user.role}</td>
                                <td className="px-6 py-4 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{user.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => openEditModal(user)} className="p-1 text-blue-600 hover:text-blue-800"><Edit size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CierresCajaView = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Consulta de Cierres de Caja</h3>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md">
            <p className="font-bold">Funcionalidad no disponible</p>
            <p>El backend actual no proporciona un endpoint para consultar el historial de cierres de caja.</p>
        </div>
    </div>
);

const LoginView: React.FC = () => {
    const { login } = useAuth();
    const { showModal } = useAppContext();
    const [rut, setRut] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setIsLoading(true);
        try { const { token, user } = await apiService.publicPost('/login', { rut, password }); login(token, user); } catch (error: any) { showModal('Error de Autenticación', error.message, 'error'); } finally { setIsLoading(false); }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800">Panchita Consultas</h2>
                <p className="text-center text-gray-500">Ingresa tus credenciales</p>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div><label htmlFor="rut" className="block text-sm font-medium text-gray-700">RUT</label><input id="rut" type="text" value={rut} onChange={(e) => setRut(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/></div>
                    <div><label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/></div>
                    <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">{isLoading ? 'Ingresando...' : 'Ingresar'}</button>
                </form>
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL DEL PANEL ---
const AdminPanel = () => {
  const { user } = useAuth();
  const [selectedMenu, setSelectedMenu] = useState('Pedidos');
  const [isDropdownOpen, setDropdownOpen] = useState(true);

  let menuItems = [
    { name: 'Pedidos', icon: <CalendarIcon size={20} />, view: <PedidosView />, adminOnly: false },
    { name: 'Productos', icon: <Package size={20} />, view: <ProductosView />, adminOnly: false },
    { name: 'Auditoría', icon: <ClipboardIcon size={20} />, view: <AuditoriaView />, adminOnly: true },
    { name: 'Usuarios', icon: <Users size={20} />, view: <UsuariosView />, adminOnly: true },
    { name: 'Cierres de caja', icon: <BarChart size={20} />, view: <CierresCajaView />, adminOnly: true },
  ];

  if (user?.role !== 'admin') {
      menuItems = menuItems.filter(item => !item.adminOnly);
  }

  const renderContent = () => {
    const activeItem = menuItems.find(item => item.name === selectedMenu);
    return activeItem ? activeItem.view : <PedidosView />;
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <aside className="w-64 bg-gray-800 text-white flex-col hidden sm:flex">
        <div className="p-5 text-2xl font-bold border-b border-gray-700">Panchita</div>
        <nav className="flex-1 px-4 py-4">
          <ul>
            <li>
              <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="w-full flex justify-between items-center p-3 rounded-md text-left text-gray-300 hover:bg-gray-700 transition-colors">
                <span className="font-semibold">Consultas</span>
                {isDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {isDropdownOpen && (
                <ul className="pl-4 mt-2">
                  {menuItems.map((item) => (
                    <li key={item.name}>
                      <a href="#" className={`flex items-center gap-3 p-3 my-1 rounded-md text-sm transition-colors ${selectedMenu === item.name ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                        onClick={(e) => { e.preventDefault(); setSelectedMenu(item.name); }}>
                        {item.icon}<span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-700"><LogoutButton/></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-800">{selectedMenu}</h1>
            <div className="sm:hidden"><LogoutButton isMobile={true}/></div>
        </header>
        <div className="p-4 sm:p-8 overflow-y-auto">{renderContent()}</div>
        <div className="sm:hidden grid grid-cols-4 gap-2 p-2 bg-gray-800 text-white border-t border-gray-700">
             {menuItems.map(item => (<button key={item.name} onClick={() => setSelectedMenu(item.name)} className={`flex flex-col items-center justify-center p-2 rounded-md transition-colors text-xs ${selectedMenu === item.name ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>{item.icon}<span className="mt-1">{item.name.split(' ')[0]}</span></button>))}
        </div>
      </main>
    </div>
  );
};

const LogoutButton = ({ isMobile = false }) => {
    const { logout } = useAuth();
    if(isMobile) {
        return <button onClick={logout} className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white"><LogOut size={20}/></button>
    }
    return <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors"><LogOut size={16}/> Salir</button>
}


// --- PROVEEDORES Y ESTRUCTURA PRINCIPAL ---

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser && token) {
            try { setUser(JSON.parse(storedUser)); }
            catch (e) { sessionStorage.clear(); setToken(null); setUser(null); }
        }
        setIsLoaded(true);
    }, [token]);

    const login = (newToken: string, userData: User) => {
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("user", JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => { sessionStorage.clear(); setToken(null); setUser(null); };

    if (!isLoaded) return <LoadingSpinner />;
    return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};

const AppWrapper: React.FC = () => {
    const { token } = useAuth();
    if (!token) return <LoginView />;
    return <AdminPanel />;
};

const App: React.FC = () => {
    const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; content: ReactNode; type: 'component' | 'message' }>({ isOpen: false, title: '', content: null, type: 'message' });
    
    const showModal = (title: string, message: React.ReactNode, type: 'success' | 'error' | 'info' = 'info') => {
        const colorClass = type === 'error' ? 'text-red-700' : type === 'success' ? 'text-green-700' : 'text-gray-800';
        setModalState({ isOpen: true, title, content: <p className={colorClass}>{message as string}</p>, type: 'message' });
    };

    const showComponentInModal = (title: string, component: ReactNode) => {
        setModalState({ isOpen: true, title, content: component, type: 'component' });
    };

    const hideModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

    return (
        <AppContext.Provider value={{ showModal, showComponentInModal, hideModal }}>
            <AuthProvider>
                <AppWrapper />
            </AuthProvider>
            
            {modalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={hideModal}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center"><h3 className="text-lg font-semibold">{modalState.title}</h3><button onClick={hideModal}><X size={24}/></button></div>
                        <div className="p-5">{modalState.content}</div>
                        {modalState.type === 'message' && (
                            <div className="px-5 py-3 bg-gray-50 flex justify-end rounded-b-lg">
                                <Button onClick={hideModal} className="bg-blue-600 text-white hover:bg-blue-700">Aceptar</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};

export default App;
