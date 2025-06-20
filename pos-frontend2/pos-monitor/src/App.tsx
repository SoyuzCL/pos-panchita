import React, { useState, useEffect, useCallback, ReactNode, createContext, useContext } from 'react';
import { Search, Package, LogOut, AlertTriangle, Archive, X } from 'lucide-react';

// --- NOTA IMPORTANTE PARA DESPLIEGUE ---
// Para que el diseño responsivo funcione en móviles, asegúrate de que tu archivo HTML principal (ej: index.html)
// incluya la siguiente etiqueta en el <head>:
// <meta name="viewport" content="width=device-width, initial-scale=1.0">

// --- CONFIGURACIÓN API ---
// Asegúrate que esta URL sea accesible desde donde corras este frontend.
const API_BASE_URL = 'http://192.168.1.8:3001/api';

// --- CATEGORÍAS DE PRODUCTOS (Reutilizadas para consistencia) ---
const PRODUCT_CATEGORIES = [
  "Panadería",
  "Pastelería",
  "Abarrotes",
  "Bebidas",
  "Lácteos",
  "Confitería",
  "Comida Preparada",
  "Insumos",
  "Otros",
];

// --- Tipos de Datos (Reutilizados de App.tsx) ---
interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    is_active: boolean;
    code?: string;
    cost_price?: number;
    supplier_id?: string;
    supplier_name?: string;
    fecha_vencimiento?: string;
}
interface User {
    id: string;
    name: string;
    role: 'admin' | 'cajero' | 'consulta'; // Añadimos un posible rol 'consulta'
}

// --- Contexto de Modales (Reutilizado) ---
const AppContext = createContext<{ showModal: (title: string, message: React.ReactNode, type?: 'success' | 'error' | 'info') => void; } | null>(null);
export const useAppContext = () => { const context = useContext(AppContext); if (!context) throw new Error("useAppContext must be used within an AppProvider"); return context; };

// --- Contexto de Autenticación (Simplificado para consulta) ---
const AuthContext = createContext<{ user: User | null; token: string | null; login: (token: string, user: User) => void; logout: () => void; } | null>(null);
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within an AuthProvider"); return context; };

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser && token) {
            try { setUser(JSON.parse(storedUser)); }
            catch (e) { sessionStorage.clear(); }
        } else {
            sessionStorage.clear();
        }
    }, [token]);

    const login = (newToken: string, userData: User) => {
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("user", JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        sessionStorage.clear();
        setToken(null);
        setUser(null);
        window.location.href = '/'; // Redirige al login
    };

    return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};


// --- Componentes de UI (Reutilizados de App.tsx) ---
const Icon = ({ icon: IconComponent, className }: { icon: React.ElementType<any>, className?: string }) => (<IconComponent className={`inline-block w-5 h-5 ${className || ''}`} />);
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg', children: React.ReactNode }> = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
    const baseStyle = "font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variantStyles = { primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500", secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500", danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500", ghost: "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300" };
    const sizeStyles = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-base", lg: "px-6 py-3 text-lg" };
    return (<button className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`} {...props}>{children}</button>);
};
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, id?: string, icon?: React.ElementType<any> }> = ({ label, id, icon: IconComponent, className, ...props }) => (
    <div className="w-full">
        {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <div className="relative rounded-md shadow-sm">
            {IconComponent && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconComponent className="text-gray-400" /></div>}
            <input id={id} className={`block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white ${IconComponent ? 'pl-10' : ''} ${className || ''}`} {...props} />
        </div>
    </div>
);

// --- API Service (Reutilizado) ---
const apiService = {
  request: async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', data?: any) => {
    const token = sessionStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const config: RequestInit = { method, headers, body: data ? JSON.stringify(data) : undefined, };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (response.status === 401) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.reload();
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    return response.status === 204 ? null : response.json();
  },
  get: (endpoint: string) => apiService.request(endpoint, 'GET'),
  post: (endpoint: string, data: any) => apiService.request(endpoint, 'POST', data),
};


// --- Vistas ---

const QueryView: React.FC = () => {
    const { showModal } = useAppContext();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiService.get('/products?include_inactive=true');
            setProducts(data);
        } catch (error: any) {
            console.error("Error fetching products: ", error);
            showModal("Error de Red", `No se pudieron cargar los productos: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showModal]);
    
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const filteredProducts = searchTerm.length > 1 
        ? products.filter(product =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.code && product.code.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : [];

    return (
        <div className="flex flex-col gap-4 p-2 sm:p-4 h-full overflow-hidden bg-gray-100">
            <div className="flex-grow flex flex-col bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Consulta de Productos</h2>
                <Input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    icon={Search}
                    className="mb-5 text-base sm:text-lg p-3"
                    autoFocus
                />
                
                <div className="overflow-y-auto flex-grow pr-2">
                    {isLoading ? (
                        <p className="text-center text-gray-500 py-8">Cargando...</p>
                    ) : searchTerm.length > 1 && filteredProducts.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No se encontraron productos para "{searchTerm}".</p>
                    ) : (
                        <div className="w-full">
                           {/* Vista de tarjetas para móvil */}
                           <div className="sm:hidden space-y-3">
                                {filteredProducts.map(product => (
                                    <div key={product.id} className={`p-4 rounded-lg shadow border-l-4 ${!product.is_active ? 'bg-red-50 border-red-400' : 'bg-white border-blue-400'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-800">{product.name}</p>
                                                <p className="text-sm text-gray-600">{product.category}</p>
                                                <p className="text-xs text-gray-500 font-mono">{product.code}</p>
                                            </div>
                                             <span className={`px-2 py-1 text-xs font-semibold rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {product.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex justify-between items-end">
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500">Stock</p>
                                                <p className="font-bold text-lg">{product.stock}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">Precio</p>
                                                <p className="font-bold text-lg text-blue-600">${product.price.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                           </div>
                           {/* Vista de tabla para escritorio */}
                           <table className="hidden sm:table w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="p-3">Producto</th>
                                        <th scope="col" className="p-3">Categoría</th>
                                        <th scope="col" className="p-3 text-right">Precio Venta</th>
                                        <th scope="col" className="p-3 text-center">Stock</th>
                                        <th scope="col" className="p-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map(product => (
                                        <tr key={product.id} className={`border-b hover:bg-gray-50 ${!product.is_active ? 'bg-red-50 text-gray-500' : 'bg-white'}`}>
                                            <td className="p-3 font-medium text-gray-900">{product.name}<br /><span className="text-xs text-gray-500 font-mono">{product.code}</span></td>
                                            <td className="p-3">{product.category}</td>
                                            <td className="p-3 text-right font-semibold text-blue-600">${product.price.toFixed(2)}</td>
                                            <td className="p-3 text-center font-bold">{product.stock}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {product.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const LoginView: React.FC = () => {
    const { login } = useAuth();
    const { showModal } = useAppContext();
    const [rut, setRut] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { token, user } = await apiService.post('/login', { rut, password });
            login(token, user);
        } catch (error: any) {
            showModal('Error de Autenticación', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-200 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Acceso Consulta</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <Input label="RUT" id="rut" type="text" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="RUT del empleado" required />
                    <Input label="Contraseña" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? 'Ingresando...' : 'Ingresar'}</Button>
                </form>
            </div>
        </div>
    );
};

const MainApp: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col h-screen bg-gray-100 font-sans antialiased">
            <header className="bg-white shadow-sm px-4 py-2 flex flex-col sm:flex-row items-center justify-between z-10 gap-2">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-800">PANCHITA - MODO CONSULTA</h1>
                    <div className="text-xs text-gray-500">
                        <p>Usuario: <strong>{user?.name}</strong></p>
                        <p>{currentTime.toLocaleDateString('es-CL')} {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={logout} variant="danger" size="sm"><Icon icon={LogOut} /> Salir</Button>
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                <QueryView />
            </main>
        </div>
    );
};

// --- Componente Principal y Proveedores ---
interface GlobalModalState { isOpen: boolean; title: string; message: React.ReactNode; type: 'success' | 'error' | 'info'; }

const App: React.FC = () => {
    const [globalModalState, setGlobalModalState] = useState<GlobalModalState>({ isOpen: false, title: '', message: '', type: 'info' });
    
    const showModal = (title: string, message: React.ReactNode, type: 'success' | 'error' | 'info' = 'info') => {
        setGlobalModalState({ isOpen: true, title, message, type });
    };
    
    const closeModal = () => setGlobalModalState(prev => ({ ...prev, isOpen: false }));
    
    return (
        <AppContext.Provider value={{ showModal }}>
            <AuthProvider>
                <AppWrapper />
            </AuthProvider>
            
            {globalModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className={`text-lg font-semibold ${globalModalState.type === 'success' ? 'text-green-600' : globalModalState.type === 'error' ? 'text-red-600' : 'text-gray-800'}`}>{globalModalState.title}</h3>
                            <Button variant="ghost" size="sm" onClick={closeModal}><Icon icon={X}/></Button>
                        </div>
                        <div className="p-5">{globalModalState.message}</div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end">
                            <Button onClick={closeModal}>Aceptar</Button>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};

const AppWrapper: React.FC = () => {
    const { token } = useAuth();
    
    if (!token) {
        return <LoginView />;
    }
    
    return <MainApp />;
};

export default App;
