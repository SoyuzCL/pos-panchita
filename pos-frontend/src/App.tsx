import React, { useState, useEffect, createContext, useContext, useCallback, ReactNode, useRef } from 'react';
import { ShoppingCart, Package, BarChart3, RotateCcw, EyeOff, Eye, PlusCircle, Search, Trash2, Edit3, DollarSign, CalendarDays, Filter, X, Menu, Settings, MinusCircle, Plus, LogOut, Users, Building, UserCircle, UserPlus, ClipboardList, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Briefcase, AlertTriangle, Archive, Star, Truck, ClipboardPlus, FilePlus, ChevronRight, Eye as EyeIcon, ArrowLeft, ScanLine } from 'lucide-react';

// --- CONFIGURACIÓN API ---
const API_BASE_URL = 'http://localhost:3001/api';

// --- CATEGORÍAS DE PRODUCTOS ---
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


// --- Tipos de Datos ---
interface Supplier { id: string; name: string; contact_person?: string; phone?: string; email?: string; address?: string; rut?: string; }
interface Product { id: string; name: string; price: number; stock: number; category: string; is_active: boolean; code?: string; cost_price?: number; supplier_id?: string; supplier_name?: string; fecha_vencimiento?: string; }
interface CartItem extends Product { quantity: number; }
interface User { id: string; name: string; role: 'admin' | 'cajero'; }
interface CashSession { id: string; current_balance: number; }
interface SaleLog { type: 'SALE'; id: string; items: Array<{ product_name: string; quantity: number; price_at_sale: number; subtotal: number; }>; total_amount: number; created_at: string; employee_name: string; payment_method: 'efectivo' | 'tarjeta' | 'venta especial'; }
interface ActionLog { type: 'LOG'; id: string; employee_name: string; action_type: string; details: string; created_at: string; }
type Activity = SaleLog | ActionLog;
type PurchaseOrderStatus = 'pendiente' | 'ordenado' | 'recibido_parcial' | 'recibido_completo' | 'cancelado';
interface PurchaseOrderItem { id: string; product_id: string; quantity_ordered: number; quantity_received: number; cost_price_at_purchase: number; product_name?: string; }
interface PurchaseOrder { id: string; supplier_id: string; supplier_name: string; order_date: string; expected_delivery_date?: string; status: PurchaseOrderStatus; total_cost: number; notes?: string; items: PurchaseOrderItem[]; }
type CustomerOrderStatus = 'pendiente' | 'en_preparacion' | 'listo_para_entrega' | 'completado' | 'cancelado';
interface CustomerOrderItem { id: string; description: string; quantity: number; unit_price: number; }
interface CustomerOrder { id: string; customer_name: string; customer_phone?: string; order_date: string; delivery_date: string; total_amount: number; down_payment: number; status: CustomerOrderStatus; notes?: string; items: CustomerOrderItem[]; }


// --- Contexto de Modales ---
const AppContext = createContext<{ showModal: (title: string, message: React.ReactNode, type?: 'success' | 'error' | 'info' | 'confirm', onConfirm?: () => void) => void; } | null>(null);
export const useAppContext = () => { const context = useContext(AppContext); if (!context) throw new Error("useAppContext must be used within an AppProvider"); return context; };

// --- Contexto de Autenticación ---
const AuthContext = createContext<{ user: User | null; token: string | null; login: (token: string, user: User) => void; logout: () => Promise<void>; isAdmin: boolean; canManageInventory: boolean; canManageSuppliers: boolean;} | null>(null);
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within an AuthProvider"); return context; };

// --- Contexto de Caja ---
const CashSessionContext = createContext<{ session: CashSession | null; setSession: (session: CashSession | null) => void; isLoading: boolean; } | null>(null);
export const useCashSession = () => { const context = useContext(CashSessionContext); if (!context) throw new Error("useCashSession must be used within a CashSessionProvider"); return context; };

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));
    
    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser && token) { 
            try { 
                setUser(JSON.parse(storedUser)); 
            } catch (e) { 
                sessionStorage.clear(); 
            } 
        } 
        else { 
            sessionStorage.clear(); 
        }
    }, [token]);
    
    const login = (newToken: string, userData: User) => {
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("user", JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };
    
    const logout = async () => {
        try {
            await apiService.post('/cash-sessions/close', {});
        } catch (error) {
            console.error("Failed to close cash session on server:", error);
        } finally {
            sessionStorage.clear();
            setToken(null);
            setUser(null);
            window.location.reload();
        }
    };

    const isAdmin = user?.role === 'admin';
    const canManageInventory = user?.role === 'admin' || user?.role === 'cajero';
    const canManageSuppliers = user?.role === 'admin' || user?.role === 'cajero';


    return <AuthContext.Provider value={{ user, token, login, logout, isAdmin, canManageInventory, canManageSuppliers }}>{children}</AuthContext.Provider>;
};

const CashSessionProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<CashSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { token } = useAuth();

    const updateSession = (activeSession: any) => {
        if (activeSession) {
            setSession({
                ...activeSession,
                current_balance: parseFloat(activeSession.current_balance)
            });
        } else {
            setSession(null);
        }
    };
    
    useEffect(() => {
        const checkActiveSession = async () => {
            if (!token) {
                setIsLoading(false);
                setSession(null);
                return;
            };
            setIsLoading(true);
            try {
                const activeSession = await apiService.get('/cash-sessions/active');
                updateSession(activeSession);
            } catch (error) {
                console.error("Failed to fetch active cash session", error);
                setSession(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkActiveSession();
    }, [token]);
    
    return (
        <CashSessionContext.Provider value={{ session, setSession: updateSession, isLoading }}>
            {children}
        </CashSessionContext.Provider>
    )
}

// --- Componentes de UI ---
const Icon = ({ icon: IconComponent, className }: { icon: React.ElementType<any>, className?: string }) => (<IconComponent className={`inline-block w-5 h-5 ${className || ''}`} />);
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'custom', size?: 'sm' | 'md' | 'lg', children: React.ReactNode }> = ({ children, variant = 'primary', size = 'md', className, ...props }) => {
    const baseStyle = "font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variantStyles = { primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500", secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500", danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500", ghost: "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300", custom: "" };
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
const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, children: React.ReactNode }> = ({ label, id, children, className, ...props }) => (
    <div className="w-full">
        {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <select id={id} className={`block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${className || ''}`} {...props}>{children}</select>
    </div>
);
const Modal: React.FC<{ isOpen: boolean; onClose?: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'lg'|'xl'|'2xl'|'3xl'|'4xl' }> = ({ isOpen, onClose, title, children, footer, size = 'lg' }) => {
    if (!isOpen) return null;
    const sizeClasses = { 'lg': 'max-w-lg', 'xl': 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl' }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className={`bg-white rounded-lg shadow-xl w-full m-4 ${sizeClasses[size]}`}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    {onClose && <Button variant="ghost" size="sm" onClick={onClose}><Icon icon={X}/></Button>}
                </div>
                <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
                {footer && <div className="px-5 py-3 bg-gray-50 flex justify-end space-x-3">{footer}</div>}
            </div>
        </div>
    );
};


// --- API Service ---
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
    if (response.status === 202) {
        return response.json();
    }
    return response.status === 204 ? null : response.json();
  },
  get: (endpoint: string) => apiService.request(endpoint, 'GET'),
  post: (endpoint: string, data: any) => apiService.request(endpoint, 'POST', data),
  put: (endpoint: string, data: any) => apiService.request(endpoint, 'PUT', data),
  delete: (endpoint: string) => apiService.request(endpoint, 'DELETE'),
  patch: (endpoint: string, data?: any) => apiService.request(endpoint, 'PATCH', data),
};

const PaymentMethodModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number; // This will now be an integer
    onProcessSale: (paymentMethod: 'efectivo' | 'tarjeta' | 'venta especial', details?: { amountPaid?: number; adminRut?: string; adminPassword?: string }) => Promise<void>;
}> = ({ isOpen, onClose, totalAmount, onProcessSale }) => {
    const [step, setStep] = useState<'selection' | 'cash_payment' | 'special_sale_auth'>('selection');
    const [amountPaid, setAmountPaid] = useState('');
    const [adminRut, setAdminRut] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setAmountPaid('');
            setAdminRut('');
            setAdminPassword('');
            setIsProcessing(false);
        }
    }, [isOpen]);

    const handleProcessCard = async () => {
        setIsProcessing(true);
        await onProcessSale('tarjeta');
        setIsProcessing(false);
    };
    
    const handleProcessCash = async () => {
        const paid = parseFloat(amountPaid);
        if (isNaN(paid) || paid < totalAmount) return;
        setIsProcessing(true);
        await onProcessSale('efectivo', { amountPaid: paid });
        setIsProcessing(false);
    };

    const handleProcessSpecialSale = async () => {
        if (!adminRut || !adminPassword) return;
        setIsProcessing(true);
        await onProcessSale('venta especial', { adminRut, adminPassword });
        setIsProcessing(false);
    };

    const change = parseFloat(amountPaid) - totalAmount;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Método de Pago">
            <div className="text-center mb-4">
                <p className="text-gray-600">Monto Total a Pagar</p>
                <p className="text-4xl font-bold text-blue-600">${totalAmount.toLocaleString('es-CL')}</p>
            </div>

            {step === 'selection' && (
                <div className="grid grid-cols-1 gap-3">
                    <Button onClick={() => setStep('cash_payment')} className="w-full bg-green-500 hover:bg-green-600 text-white" size="lg">Efectivo</Button>
                    <Button onClick={handleProcessCard} className="w-full bg-sky-500 hover:bg-sky-600 text-white" size="lg" disabled={isProcessing}>
                        {isProcessing ? 'Procesando...' : 'Tarjeta'}
                    </Button>
                    <Button onClick={() => setStep('special_sale_auth')} className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="lg">
                        <Icon icon={Star} /> Venta Especial
                    </Button>
                </div>
            )}

            {step === 'cash_payment' && (
                <div className="space-y-4">
                    <Input 
                        label="¿Con cuánto paga el cliente?"
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="Ingrese el monto recibido"
                        autoFocus
                    />
                    {change >= 0 && (
                        <div className="text-center bg-gray-100 p-3 rounded-lg">
                           <p className="text-gray-600">Cambio a entregar</p>
                           <p className="text-3xl font-bold text-green-700">${Math.round(change).toLocaleString('es-CL')}</p>
                        </div>
                    )}
                    <div className="flex gap-4">
                        <Button variant="secondary" onClick={() => setStep('selection')} className="w-full">Volver</Button>
                        <Button 
                            onClick={handleProcessCash} 
                            className="w-full" 
                            disabled={isProcessing || parseFloat(amountPaid) < totalAmount || isNaN(parseFloat(amountPaid))}
                        >
                            {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'special_sale_auth' && (
                <div className="space-y-4">
                    <h4 className="text-center font-semibold text-gray-700">Autorización de Administrador</h4>
                    <Input label="RUT del Administrador" value={adminRut} onChange={e => setAdminRut(e.target.value)} required placeholder="12.345.678-9"/>
                    <Input label="Contraseña del Administrador" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
                    <div className="flex gap-4">
                        <Button variant="secondary" onClick={() => setStep('selection')} className="w-full">Volver</Button>
                        <Button onClick={handleProcessSpecialSale} className="w-full" disabled={isProcessing || !adminRut || !adminPassword}>
                            {isProcessing ? 'Procesando...' : 'Confirmar Venta Especial'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const SalesView: React.FC = () => {
    const { showModal } = useAppContext();
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isProcessingSale, setIsProcessingSale] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const { session, setSession } = useCashSession();
    
    // --- START: Scanner Integration Logic ---
    const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [scanInput, setScanInput] = useState('');

    const handleCartUpdate = useCallback((product: Product, change: number) => { 
        setCart(prevCart => { 
            const existingItemIndex = prevCart.findIndex(item => item.id === product.id); 
            let newCart = [...prevCart]; 
            if (existingItemIndex > -1) { 
                const existingItem = newCart[existingItemIndex]; 
                const newQuantity = existingItem.quantity + change; 
                if (newQuantity <= 0) { 
                    newCart.splice(existingItemIndex, 1); 
                } else if (newQuantity > product.stock) { 
                    showModal("Stock Insuficiente", `Solo quedan ${product.stock} unidades de ${product.name}.`, 'info'); 
                    newCart[existingItemIndex] = { ...existingItem, quantity: product.stock }; 
                } else { 
                    newCart[existingItemIndex] = { ...existingItem, quantity: newQuantity }; 
                } 
            } else if (change > 0) { 
                if (product.stock > 0) { 
                    newCart.push({ ...product, quantity: 1 }); 
                } else { 
                    showModal("Producto Agotado", `${product.name} está agotado.`, 'info'); 
                } 
            } 
            return newCart; 
        }); 
    }, [showModal]);

    const processScannedCode = useCallback((code: string) => {
        if (!code) return;
        const productScanned = products.find(p => p.code && p.code.trim().toLowerCase() === code.trim().toLowerCase());
        if (productScanned) {
            handleCartUpdate(productScanned, 1);
        } else {
            showModal("Producto no encontrado", `No se encontró ningún producto con el código: ${code}`, 'info');
        }
    }, [products, handleCartUpdate, showModal]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            if (e.key === 'Enter') {
                if (scanInput.length > 2) {
                    processScannedCode(scanInput);
                }
                setScanInput('');
                e.preventDefault();
                return;
            }

            if (e.key.length === 1) {
                setScanInput(prev => prev + e.key);
            }

            if (scanTimerRef.current) {
                clearTimeout(scanTimerRef.current);
            }
            scanTimerRef.current = setTimeout(() => {
                setScanInput('');
            }, 150); 
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimerRef.current) {
                clearTimeout(scanTimerRef.current);
            }
        };
    }, [scanInput, processScannedCode]);
    // --- END: Scanner Integration Logic ---

    const fetchProducts = useCallback(async () => { setIsLoadingProducts(true); try { const data = await apiService.get('/products'); setProducts(data); } catch (error: any) { console.error("Error fetching products: ", error); showModal("Error de Red", `No se pudieron cargar los productos: ${error.message}`, 'error'); } finally { setIsLoadingProducts(false); } }, [showModal]);
    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    
    const removeFromCart = (productId: string) => { setCart(prevCart => prevCart.filter(item => item.id !== productId)); };
    
    // --- START: Rounded Totals Logic ---
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const roundedTotalAmount = Math.round(totalAmount);
    const netAmount = roundedTotalAmount / 1.19;
    const roundedNetAmount = Math.round(netAmount);
    // --- END: Rounded Totals Logic ---

    const handleProcessSale = () => {
        if (cart.length === 0) {
            showModal("Carrito Vacío", "Agrega productos al carrito.", 'info');
            return;
        }
        setIsPaymentModalOpen(true);
    };

    const executeSale = async (paymentMethod: 'efectivo' | 'tarjeta' | 'venta especial', details?: { amountPaid?: number; adminRut?: string; adminPassword?: string }) => {
        setIsProcessingSale(true);
        const salePayload: any = {
            items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, price_at_sale: item.price })),
            total_amount: roundedTotalAmount, // Use rounded amount
            payment_method: paymentMethod,
        };

        if (paymentMethod === 'venta especial' && details?.adminRut) {
            salePayload.adminRut = details.adminRut;
            salePayload.adminPassword = details.adminPassword;
        }

        try {
            await apiService.post('/sales', salePayload);

            if (paymentMethod === 'efectivo' || paymentMethod === 'tarjeta') {
                 const amountPaid = details?.amountPaid || roundedTotalAmount;
                 const change = amountPaid - roundedTotalAmount;
                 const receiptData = {
                    items: cart,
                    total_amount: roundedTotalAmount,
                    payment_method: paymentMethod,
                    amountPaid: amountPaid,
                    change: change
                 };
                 apiService.post('/print-receipt', receiptData)
                    .then((printResponse: any) => {
                        if (printResponse && printResponse.message && printResponse.message.includes("no se pudo conectar")) {
                            showModal("Aviso de Impresión", printResponse.message, 'info');
                        }
                    })
                    .catch(err => {
                        console.error("Error en la solicitud de impresión:", err.message);
                        showModal("Error de Impresión", "La venta se guardó, pero hubo un error al enviar el recibo a imprimir.", 'error');
                    });
            }

            if (paymentMethod === 'efectivo' && session && setSession && details?.amountPaid) {
                const newBalance = session.current_balance + roundedTotalAmount;
                setSession({...session, current_balance: newBalance });
            }
            
            let successMessage: React.ReactNode;
            if (paymentMethod === 'efectivo' && details?.amountPaid) {
                const change = details.amountPaid - roundedTotalAmount;
                successMessage = (
                    <div>
                        <p className="text-lg">Venta registrada con éxito</p>
                        <p className="mt-2">Total: <span className="font-bold">${roundedTotalAmount.toLocaleString('es-CL')}</span></p>
                        <p>Pagado: <span className="font-bold">${details.amountPaid.toLocaleString('es-CL')}</span></p>
                        <p className="text-2xl text-green-600 font-bold mt-2">CAMBIO: ${Math.round(change).toLocaleString('es-CL')}</p>
                    </div>
                );
            } else {
                 successMessage = `Venta con ${paymentMethod} registrada por un monto de $${roundedTotalAmount.toLocaleString('es-CL')}.`;
            }

            showModal("Venta Exitosa", successMessage, 'success');
            setCart([]);
            fetchProducts();
            setIsPaymentModalOpen(false);
        } catch (error: any) {
            showModal("Error en Venta", `No se pudo procesar la venta: ${error.message}`, 'error');
        } finally {
            setIsProcessingSale(false);
        }
    };
    
    const filteredProducts = products.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || (product.code && product.code.toLowerCase().includes(searchTerm.toLowerCase())) || product.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return (
    <>
        <PaymentMethodModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            totalAmount={roundedTotalAmount} // Pass rounded amount
            onProcessSale={executeSale}
        />
        <div className="flex flex-col lg:flex-row gap-4 p-4 h-full overflow-hidden bg-gray-100">
            <div className="lg:w-3/5 flex flex-col bg-gray-200 p-4 rounded-lg shadow">
                <div className="flex gap-4 items-center mb-3">
                    <Input 
                        type="text" 
                        placeholder="Buscar por nombre o categoría..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={Search} 
                        className="flex-grow" 
                    />
                    <div className="flex items-center gap-2 text-green-600 bg-green-100 px-3 py-2 rounded-md">
                        <Icon icon={ScanLine} />
                        <span className="font-medium text-sm">Escáner Activo</span>
                    </div>
                </div>
                {isLoadingProducts ? (<p className="text-center text-gray-600 py-8">Cargando productos...</p>) : filteredProducts.length === 0 ? (<p className="text-center text-gray-500 py-8">No se encontraron productos.</p>) : (<div className="overflow-y-auto flex-grow pr-2 space-y-2">{filteredProducts.map(product => (<div key={product.id} className="bg-white p-3 rounded-md shadow-sm flex items-center justify-between gap-2"><div className="flex-grow"><h4 className="text-sm font-semibold text-gray-800">{product.name}</h4><p className="text-xs text-gray-500">{product.category} - Stock: {product.stock}</p><p className="text-sm font-bold text-blue-600">${product.price.toFixed(2)}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => handleCartUpdate(product, -1)} disabled={!cart.find(item => item.id === product.id)} className="p-1"><Icon icon={MinusCircle} className="w-6 h-6 text-red-500" /></Button><span className="w-6 text-center text-sm font-medium">{cart.find(item => item.id === product.id)?.quantity || 0}</span><Button variant="ghost" size="sm" onClick={() => handleCartUpdate(product, 1)} disabled={product.stock <= (cart.find(item => item.id === product.id)?.quantity || 0)} className="p-1"><Icon icon={PlusCircle} className="w-6 h-6 text-green-500" /></Button></div></div>))}</div>)}
            </div>
            <div className="lg:w-2/5 flex flex-col bg-gray-200 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-300">Carrito de Compra</h3>
                {cart.length === 0 ? (<p className="text-gray-500 flex-grow flex items-center justify-center">El carrito está vacío.</p>) : (<div className="overflow-y-auto flex-grow pr-1 space-y-2 mb-3">{cart.map(item => (<div key={item.id} className="bg-white p-2 rounded-md shadow-sm flex justify-between items-center text-sm"><div><p className="font-medium text-gray-700">{item.name}</p><p className="text-xs text-gray-500">${item.price.toFixed(2)} x {item.quantity}</p></div><div className="flex items-center"><p className="font-semibold text-gray-800 mr-3">${(item.price * item.quantity).toFixed(2)}</p><Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)} className="p-1"><Icon icon={Trash2} className="w-4 h-4 text-red-500" /></Button></div></div>))}</div>)}
                <div className="mt-auto pt-3 border-t border-gray-300 space-y-2">
                    <div className="flex justify-between text-md font-medium text-gray-700"><span>Monto Neto:</span><span>${roundedNetAmount.toLocaleString('es-CL')}</span></div>
                    <div className="flex justify-between text-lg font-bold text-gray-800"><span>Monto Total:</span><span>${roundedTotalAmount.toLocaleString('es-CL')}</span></div>
                    <Button onClick={handleProcessSale} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white" size="lg" disabled={cart.length === 0 || isProcessingSale}>{isProcessingSale ? 'Procesando...' : 'Finalizar y Pagar'}<Icon icon={DollarSign} /></Button>
                </div>
            </div>
        </div>
    </>
    );
};

const ProductFormModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product | null; suppliers: Supplier[]; onSave: () => void; }> = ({ isOpen, onClose, product, suppliers, onSave }) => {
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

const ExpirationAlerts: React.FC = () => {
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

const LowStockAlerts: React.FC = () => {
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLowStockProducts = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.get('/products/low-stock');
                setLowStockProducts(data);
            } catch (error) {
                console.error("Error fetching low stock products:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLowStockProducts();
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
                                <span className="font-semibold text-gray-800">{product.name}</span>
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


const InventoryView: React.FC = () => {
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

const ReportsView: React.FC = () => {
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

const SuppliersView: React.FC = () => {
    const { showModal } = useAppContext();
    const { canManageSuppliers } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [form, setForm] = useState<Omit<Supplier, 'id'>>({ name: '', rut: '', contact_person: '', phone: '', email: '', address: '' });
    const fetchSuppliers = useCallback(async () => { setIsLoading(true); try { const data = await apiService.get('/suppliers'); setSuppliers(data); } catch (error: any) { showModal('Error', `No se pudo cargar proveedores: ${error.message}`, 'error'); } finally { setIsLoading(false); } }, [showModal]);
    useEffect(() => { fetchSuppliers() }, [fetchSuppliers]);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const selectSupplier = (supplier: Supplier) => { setSelectedSupplier(supplier); setForm(supplier); };
    const clearForm = () => { setSelectedSupplier(null); setForm({ name: '', rut: '', contact_person: '', phone: '', email: '', address: '' }); };
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if(!form.name) return; try { if(selectedSupplier) { await apiService.put(`/suppliers/${selectedSupplier.id}`, form); } else { await apiService.post('/suppliers', form); } showModal('Éxito', `Proveedor ${selectedSupplier ? 'actualizado' : 'creado'}.`, 'success'); clearForm(); fetchSuppliers(); } catch(error: any) { showModal('Error', error.message, 'error'); }};
    const handleDelete = () => { if(!selectedSupplier) return; showModal('Confirmar', `¿Eliminar a ${selectedSupplier.name}?`, 'confirm', async () => { try { await apiService.delete(`/suppliers/${selectedSupplier.id}`); showModal('Éxito', 'Proveedor eliminado', 'success'); clearForm(); fetchSuppliers(); } catch(error: any) { showModal('Error', 'No se pudo eliminar el proveedor.', 'error'); } });};
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

const OrdersView: React.FC = () => {
    const [view, setView] = useState<'purchase' | 'customer'>('customer');

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

const CustomerOrdersView: React.FC = () => {
    return <div className="text-center p-10 bg-white rounded-lg shadow">Gestión de Pedidos de Clientes - Próximamente...</div>
}


// =================================================================
// INICIO: NUEVOS COMPONENTES PARA ÓRDENES DE COMPRA
// =================================================================
const CreatePurchaseOrderModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onOrderCreated: () => void;
    suppliers: Supplier[];
    products: Product[];
}> = ({ isOpen, onClose, onOrderCreated, suppliers, products }) => {
    const { showModal } = useAppContext();
    const [step, setStep] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [items, setItems] = useState<Array<Omit<PurchaseOrderItem, 'id' | 'purchase_order_id' | 'quantity_received'> & { product_name: string }>>([]);
    const [notes, setNotes] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

    const resetForm = () => {
        setStep(1);
        setSelectedSupplierId('');
        setItems([]);
        setNotes('');
        setExpectedDeliveryDate('');
    }

    const handleClose = () => {
        resetForm();
        onClose();
    }
    
    const handleAddItem = (product: Product, quantity: number) => {
        if (quantity <= 0) return;
        setItems(prev => {
            const existingIndex = prev.findIndex(i => i.product_id === product.id);
            if(existingIndex > -1) {
                const newItems = [...prev];
                newItems[existingIndex].quantity_ordered += quantity;
                return newItems;
            } else {
                return [...prev, {
                    product_id: product.id,
                    product_name: product.name,
                    quantity_ordered: quantity,
                    cost_price_at_purchase: product.cost_price || 0
                }];
            }
        });
    }

    const handleUpdateItemQuantity = (productId: string, newQuantity: number) => {
        if(newQuantity <= 0) {
            setItems(prev => prev.filter(i => i.product_id !== productId));
        } else {
            setItems(prev => prev.map(i => i.product_id === productId ? {...i, quantity_ordered: newQuantity} : i));
        }
    }

    const totalCost = items.reduce((sum, item) => sum + (item.cost_price_at_purchase * item.quantity_ordered), 0);

    const handleSubmit = async () => {
        if(items.length === 0) {
            showModal('Error', 'Debe agregar al menos un producto a la orden.', 'error');
            return;
        }

        const payload = {
            supplier_id: selectedSupplierId,
            items: items.map(({ product_id, quantity_ordered, cost_price_at_purchase }) => ({ product_id, quantity: quantity_ordered, cost_price: cost_price_at_purchase })),
            total_cost: totalCost,
            notes,
            expected_delivery_date: expectedDeliveryDate || null,
        }

        try {
            await apiService.post('/purchase-orders', payload);
            showModal('Éxito', 'Orden de compra creada correctamente.', 'success');
            onOrderCreated();
            handleClose();
        } catch (error: any) {
            showModal('Error', `No se pudo crear la orden: ${error.message}`, 'error');
        }
    }

    const availableProducts = products.filter(p => !selectedSupplierId || p.supplier_id === selectedSupplierId);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Crear Orden de Compra" size="4xl"
            footer={
                <div className="w-full flex justify-between">
                    {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}><Icon icon={ArrowLeft} /> Volver</Button>}
                    <div className="flex gap-3 ml-auto">
                        <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                        {step === 1 && <Button onClick={() => setStep(2)} disabled={!selectedSupplierId || items.length === 0}>Siguiente <Icon icon={ChevronRight} /></Button>}
                        {step === 2 && <Button onClick={handleSubmit}>Enviar Orden</Button>}
                    </div>
                </div>
            }
        >
            {step === 1 && (
                <div className="grid grid-cols-2 gap-6">
                    {/* Columna Izquierda: Selección de productos */}
                    <div>
                        <h4 className="font-bold text-lg mb-2">Paso 1: Agregar Productos</h4>
                        <Select label="Seleccionar Proveedor" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                            <option value="">Seleccione un proveedor...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>

                        {selectedSupplierId && (
                            <div className="mt-4 border-t pt-4">
                                <h5 className="font-semibold mb-2">Productos Disponibles</h5>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {availableProducts.map(p => (
                                        <div key={p.id} className="bg-gray-50 p-2 rounded-md flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-sm">{p.name}</p>
                                                <p className="text-xs text-gray-500">Costo: ${p.cost_price?.toFixed(2)}</p>
                                            </div>
                                            <Button size="sm" onClick={() => handleAddItem(p, 1)}>Agregar</Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Columna Derecha: Resumen de la orden */}
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-2">Resumen de Orden</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {items.length === 0 ? <p className="text-sm text-gray-500">Aún no hay productos.</p> :
                                items.map(item => (
                                    <div key={item.product_id} className="bg-white p-2 rounded-md flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-sm">{item.product_name}</p>
                                            <p className="text-xs text-gray-500">Costo: ${item.cost_price_at_purchase.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input type="number" value={item.quantity_ordered} onChange={(e) => handleUpdateItemQuantity(item.product_id, parseInt(e.target.value))} className="w-16 text-center" />
                                            <Button variant="ghost" size="sm" onClick={() => handleUpdateItemQuantity(item.product_id, 0)}><Icon icon={Trash2} className="text-red-500"/></Button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="mt-4 border-t pt-3 font-bold text-right">
                            Total: ${totalCost.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}
            {step === 2 && (
                <div>
                    <h4 className="font-bold text-lg mb-2">Paso 2: Confirmar y Enviar</h4>
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <Input label="Fecha de Entrega Estimada (Opcional)" type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
                        <Input label="Notas (Opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
                     </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <h5 className="font-bold mb-2">Resumen Final</h5>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b"><th className="text-left p-2">Producto</th><th className="text-center p-2">Cantidad</th><th className="text-right p-2">Subtotal</th></tr></thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.product_id}>
                                        <td className="p-2">{item.product_name}</td>
                                        <td className="p-2 text-center">{item.quantity_ordered}</td>
                                        <td className="p-2 text-right">${(item.quantity_ordered * item.cost_price_at_purchase).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr className="border-t font-bold"><td colSpan={2} className="p-2 text-right">Total:</td><td className="p-2 text-right">${totalCost.toFixed(2)}</td></tr></tfoot>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    );
}

const PurchaseOrderDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder | null;
    onOrderUpdated: () => void;
}> = ({ isOpen, onClose, order, onOrderUpdated }) => {
    // Implementación del modal de detalle y recepción aquí
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Detalle Orden #${order?.id.substring(0,8)}`} size="3xl">
            <p>Detalles y recepción de la orden...</p>
        </Modal>
    )
}


const PurchaseOrdersView: React.FC = () => {
    const { showModal } = useAppContext();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [ordersData, suppliersData, productsData] = await Promise.all([
                apiService.get('/purchase-orders'),
                apiService.get('/suppliers'),
                apiService.get('/products?include_inactive=true')
            ]);
            setOrders(ordersData);
            setSuppliers(suppliersData);
            setProducts(productsData);
        } catch (error: any) {
            showModal('Error', `No se pudieron cargar los datos necesarios: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showModal]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenDetailModal = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    }
    
    const StatusBadge: React.FC<{ status: PurchaseOrderStatus }> = ({ status }) => {
        const styles = {
            ordenado: 'bg-blue-100 text-blue-800',
            recibido_parcial: 'bg-yellow-100 text-yellow-800',
            recibido_completo: 'bg-green-100 text-green-800',
            cancelado: 'bg-red-100 text-red-800',
            pendiente: 'bg-gray-100 text-gray-800'
        };
        const text = {
            ordenado: 'Ordenado',
            recibido_parcial: 'Recibido Parcial',
            recibido_completo: 'Recibido Completo',
            cancelado: 'Cancelado',
            pendiente: 'Pendiente'
        }
        return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{text[status]}</span>
    }

    return (
        <>
        <CreatePurchaseOrderModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)}
            onOrderCreated={fetchData}
            suppliers={suppliers}
            products={products}
        />
        <PurchaseOrderDetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            order={selectedOrder}
            onOrderUpdated={fetchData}
        />

        <div className="h-full flex flex-col bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Órdenes de Compra a Proveedores</h3>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Icon icon={FilePlus} /> Crear Nueva Orden
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {isLoading ? <p>Cargando órdenes...</p> : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="p-3">Proveedor</th>
                                <th className="p-3">Fecha de Orden</th>
                                <th className="p-3">Entrega Estimada</th>
                                <th className="p-3 text-right">Costo Total</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium">{order.supplier_name}</td>
                                    <td className="p-3">{new Date(order.order_date).toLocaleDateString('es-CL')}</td>
                                    <td className="p-3">{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'}</td>
                                    <td className="p-3 text-right">${parseFloat(order.total_cost as any).toFixed(2)}</td>
                                    <td className="p-3 text-center"><StatusBadge status={order.status} /></td>
                                    <td className="p-3 text-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetailModal(order)}>
                                            <Icon icon={EyeIcon} /> Ver Detalles
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        </>
    );
}
// =================================================================
// FIN: NUEVOS COMPONENTES
// =================================================================


const RegisterView: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
    const { showModal } = useAppContext();
    const [formData, setFormData] = useState({ first_name: '', last_name: '', rut: '', password: '', role: 'cajero' });
    const [isLoading, setIsLoading] = useState(false);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.first_name || !formData.rut || !formData.password) { showModal("Campos Incompletos", "Nombre, RUT y contraseña son obligatorios.", "info"); return; }
        setIsLoading(true);
        try {
            await apiService.post('/employees', formData);
            showModal("Registro Exitoso", "La cuenta ha sido creada. Ahora puedes iniciar sesión.", "success", onSwitchToLogin);
        } catch (error: any) {
            showModal("Error de Registro", error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="flex items-center justify-center h-screen bg-gray-200">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Crear Cuenta</h2>
                <form className="space-y-4" onSubmit={handleRegister}>
                    <Input label="Nombre" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                    <Input label="Apellido" name="last_name" value={formData.last_name} onChange={handleInputChange} />
                    <Input label="RUT" name="rut" value={formData.rut} onChange={handleInputChange} placeholder="12.345.678-9" required />
                    <Input label="Contraseña" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
                    <Select label="Rol" name="role" value={formData.role} onChange={handleInputChange}>
                        <option value="cajero">Cajero</option>
                        <option value="admin">Administrador</option>
                    </Select>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? 'Registrando...' : 'Crear Cuenta'}</Button>
                </form>
                <p className="text-sm text-center text-gray-600">¿Ya tienes una cuenta?{' '}<button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:underline">Inicia Sesión</button></p>
            </div>
        </div>
    );
};

const LoginView: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
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
        <div className="flex items-center justify-center h-screen bg-gray-200">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">Iniciar Sesión</h2>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <Input label="RUT" id="rut" type="text" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="1-1" required />
                    <Input label="Contraseña" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>{isLoading ? 'Ingresando...' : 'Ingresar'}</Button>
                </form>
                 <p className="text-sm text-center text-gray-600">¿No tienes una cuenta?{' '}<button onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:underline">Regístrate aquí</button></p>
            </div>
        </div>
    );
};

const InitialCashModal: React.FC = () => {
    const { setSession } = useCashSession();
    const { showModal } = useAppContext();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const start_amount = parseFloat(amount);
        if(isNaN(start_amount) || start_amount < 0) {
            showModal('Monto Inválido', 'Por favor, ingrese un número válido para el fondo de caja inicial.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const newSession = await apiService.post('/cash-sessions/start', { start_amount });
            if (setSession) setSession(newSession);
        } catch(error: any) {
            showModal('Error al Iniciar Caja', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Iniciar Sesión de Caja</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-gray-600 text-center">No hay una sesión de caja activa. Ingrese el monto inicial para continuar.</p>
                    <Input label="Monto Inicial en Caja" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ej: 50000" required autoFocus/>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? 'Iniciando...' : 'Iniciar Caja'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

const CashMovementModal: React.FC<{isOpen: boolean, onClose: () => void}> = ({ isOpen, onClose }) => {
    const { showModal } = useAppContext();
    const { setSession } = useCashSession();
    const [type, setType] = useState<'ADD' | 'REMOVE'>('ADD');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [adminRut, setAdminRut] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const newSessionState = await apiService.post('/cash-movements', { type, amount: parseFloat(amount), reason, adminRut, adminPassword });
            if (setSession) setSession(newSessionState);
            showModal('Éxito', 'El movimiento de caja se ha registrado correctamente.', 'success');
            onClose();
        } catch (error: any) {
            showModal('Error en Movimiento', error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
      if(isOpen) {
        setAmount('');
        setReason('');
        setAdminRut('');
        setAdminPassword('');
      }
    }, [isOpen])

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Gestionar Efectivo de Caja"
            footer={
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" form="cash-form" disabled={isLoading}>
                        {isLoading ? 'Procesando...' : 'Confirmar Movimiento'}
                    </Button>
                </div>
            }
        >
            <form id="cash-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                    <button type="button" onClick={() => setType('ADD')} className={`flex-1 p-2 rounded-md font-semibold text-sm ${type === 'ADD' ? 'bg-green-500 text-white shadow' : 'text-gray-600'}`}>Agregar Dinero</button>
                    <button type="button" onClick={() => setType('REMOVE')} className={`flex-1 p-2 rounded-md font-semibold text-sm ${type === 'REMOVE' ? 'bg-red-500 text-white shadow' : 'text-gray-600'}`}>Retirar Dinero</button>
                </div>
                <Input label="Monto" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
                <Input label="Motivo" value={reason} onChange={e => setReason(e.target.value)} required />
                <div className="p-3 border-t border-dashed space-y-3">
                    <h4 className="font-semibold text-gray-700">Aprobación de Administrador</h4>
                    <Input label="RUT del Administrador" value={adminRut} onChange={e => setAdminRut(e.target.value)} required />
                    <Input label="Contraseña del Administrador" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
                </div>
            </form>
        </Modal>
    );
};

type Page = 'sales' | 'inventory' | 'reports' | 'suppliers' | 'orders';

const MainApp: React.FC = () => {
  const { user, logout, canManageSuppliers } = useAuth();
  const { session } = useCashSession();
  const [currentPage, setCurrentPage] = useState<Page>('sales'); 
  const [currentTime, setCurrentTime] = useState(new Date()); 
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60); return () => clearInterval(timer); }, []);
  
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

  const NavButton: React.FC<{ page: Page, label: string, icon: React.ElementType, current: Page, onClick: (page: Page) => void }> = ({ page, label, icon, current, onClick}) => (<button onClick={() => onClick(page)} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${current === page ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}><Icon icon={icon}/>{label}</button>);
  
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

interface GlobalModalState { isOpen: boolean; title: string; message: React.ReactNode; type: 'success' | 'error' | 'info' | 'confirm'; onConfirm?: () => void; }
const App: React.FC = () => {
    const [globalModalState, setGlobalModalState] = useState<GlobalModalState>({ isOpen: false, title: '', message: '', type: 'info' });
    const showModal = (title: string, message: React.ReactNode, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => setGlobalModalState({ isOpen: true, title, message, type, onConfirm });
    const closeModal = () => setGlobalModalState(prev => ({ ...prev, isOpen: false }));
    const handleConfirmModal = () => { if (globalModalState.onConfirm) { globalModalState.onConfirm(); } closeModal(); };
    return (
        <AppContext.Provider value={{showModal}}>
            <AuthProvider>
                <CashSessionProvider>
                    <AppWrapper />
                </CashSessionProvider>
            </AuthProvider>
            {globalModalState.isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"><div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4"><div className="flex justify-between items-center p-4 border-b"><h3 className={`text-lg font-semibold ${globalModalState.type === 'success' ? 'text-green-600' : globalModalState.type === 'error' ? 'text-red-600' : 'text-gray-800'}`}>{globalModalState.title}</h3><Button variant="ghost" size="sm" onClick={closeModal}><Icon icon={X}/></Button></div><div className="p-5">{globalModalState.message}</div><div className="px-5 py-3 bg-gray-50 flex justify-end space-x-3">{globalModalState.type === 'confirm' && (<Button variant="secondary" onClick={closeModal}>Cancelar</Button>)}<Button onClick={globalModalState.type === 'confirm' ? handleConfirmModal : closeModal}>{globalModalState.type === 'confirm' ? 'Confirmar' : 'Aceptar'}</Button></div></div></div>}
        </AppContext.Provider>
    );
};

const AppWrapper: React.FC = () => {
    const { token } = useAuth();
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const { session, isLoading: isSessionLoading } = useCashSession();

    if (!token) {
        if (authView === 'login') {
            return <LoginView onSwitchToRegister={() => setAuthView('register')} />;
        }
        return <RegisterView onSwitchToLogin={() => setAuthView('login')} />;
    }
    
    if (isSessionLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <p className="text-xl font-semibold animate-pulse text-gray-700">Verificando sesión de caja...</p>
            </div>
        );
    }

    if (session) {
        return <MainApp />;
    }

    return (
        <div className="h-screen w-screen bg-gray-200">
             <InitialCashModal />
        </div>
    );
};

export default App;
