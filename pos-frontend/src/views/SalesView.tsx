import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MinusCircle, PlusCircle, Trash2, DollarSign, ScanLine } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useCashSession } from '../contexts/CashSessionContext';
import { apiService } from '../services/apiService';
import type { Product, CartItem } from '../types/definitions';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { PaymentMethodModal } from '../components/features/PaymentMethodModal';

export const SalesView: React.FC = () => {
    const { showModal } = useAppContext();
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isProcessingSale, setIsProcessingSale] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const { session, setSession } = useCashSession();
    
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
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (e.key === 'Enter') {
                if (scanInput.length > 2) processScannedCode(scanInput);
                setScanInput('');
                e.preventDefault();
                return;
            }
            if (e.key.length === 1) setScanInput(prev => prev + e.key);
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            scanTimerRef.current = setTimeout(() => setScanInput(''), 150); 
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        };
    }, [scanInput, processScannedCode]);

    const fetchProducts = useCallback(async () => { 
        setIsLoadingProducts(true); 
        try { 
            const data = await apiService.get('/products'); 
            setProducts(data); 
        } catch (error: any) { 
            showModal("Error de Red", `No se pudieron cargar los productos: ${error.message}`, 'error'); 
        } finally { 
            setIsLoadingProducts(false); 
        } 
    }, [showModal]);
    
    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    
    const removeFromCart = (productId: string) => { setCart(prevCart => prevCart.filter(item => item.id !== productId)); };
    
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const roundedTotalAmount = Math.round(totalAmount);
    const netAmount = roundedTotalAmount / 1.19;
    const roundedNetAmount = Math.round(netAmount);

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
            total_amount: roundedTotalAmount,
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
                 const receiptData = { items: cart, total_amount: roundedTotalAmount, payment_method: paymentMethod, amountPaid: amountPaid, change: change };
                 apiService.post('/print-receipt', receiptData)
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
            totalAmount={roundedTotalAmount}
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
