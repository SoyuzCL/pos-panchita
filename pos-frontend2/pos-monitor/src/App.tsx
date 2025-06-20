import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios'; // Asegúrate de haberlo instalado con: npm install axios

// ========= ICONS (using inline SVGs for portability) =========
const AlertCircle = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const TrendingUp = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const Box = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const DollarSign = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);

const LogOut = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);


// ========= API SERVICE & MOCK DATA =========
// IMPORTANT: Replace with your actual backend API URL
const API_URL = 'http://192.168.1.8:3000/api'; // <--- CAMBIA ESTA URL POR LA DE TU BACKEND


// API Client - Replace mock logic with real fetch calls
const apiClient = {
  post: async (path, data) => {
    // This uses a real fetch call now. Ensure your backend is running and CORS is configured.
    if (path === '/login') {
       try {
        const response = await axios.post(`${API_URL}${path}`, data);
        return response;
       } catch (error) {
           console.error("Login API error:", error);
           if (error.response) {
               return Promise.reject(error);
           }
           return Promise.reject({response: {data: {message: "No se pudo conectar al servidor."}}});
       }
    }
    return Promise.reject(new Error(`POST to ${path} not implemented.`));
  },
  get: async (path, token) => {
    try {
        const response = await axios.get(`${API_URL}${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response;
    } catch(error) {
        console.error(`API error on GET ${path}:`, error);
        return Promise.reject(error);
    }
  }
};


// ========= UI Components =========
const StatCard = ({ title, value, icon, description, color = 'indigo' }) => {
    const colors = {
        indigo: 'text-indigo-600 bg-indigo-100',
        green: 'text-green-600 bg-green-100',
        yellow: 'text-yellow-600 bg-yellow-100',
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
                <div className={`p-2 rounded-full ${colors[color]}`}>{icon}</div>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{description}</p>
        </div>
    );
};

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
);


// ========= Dashboard Widgets =========

const SalesSummary = ({ token }) => {
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/ventas', token);
        const today = new Date().toISOString().slice(0, 10);
        const currentMonth = new Date().toISOString().slice(0, 7);

        const salesData = response.data;

        const todaySales = salesData
          .filter(s => s.fecha.startsWith(today))
          .reduce((sum, s) => sum + parseFloat(s.total), 0);

        const monthSales = salesData
          .filter(s => s.fecha.startsWith(currentMonth))
          .reduce((sum, s) => sum + parseFloat(s.total), 0);

        const totalSales = salesData.reduce((sum, s) => sum + parseFloat(s.total), 0);

        setSales({ todaySales, monthSales, totalSales });
      } catch (err) {
        setError('No se pudieron cargar las ventas.');
      }
    };
    fetchData();
  }, [token]);

  const formatCurrency = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);

  if (error) return <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg">{error}</div>;
  if (!sales) return <div className="bg-white p-6 rounded-lg border col-span-1 lg:col-span-3"><LoadingSpinner /></div>;

  return (
    <>
      <StatCard title="Ventas de Hoy" value={formatCurrency(sales.todaySales)} icon={<TrendingUp className="w-6 h-6"/>} description="Total vendido en el día actual" color="green" />
      <StatCard title="Ventas del Mes" value={formatCurrency(sales.monthSales)} icon={<TrendingUp className="w-6 h-6"/>} description={`Total vendido en ${new Date().toLocaleString('es-CL', { month: 'long' })}`} color="green" />
      <StatCard title="Total Histórico" value={formatCurrency(sales.totalSales)} icon={<DollarSign className="w-6 h-6"/>} description="Suma de todas las ventas registradas" color="yellow" />
    </>
  );
};


const StockAlerts = ({ token }) => {
  const [lowStockItems, setLowStockItems] = useState(null);
  const [error, setError] = useState('');
  const STOCK_THRESHOLD = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/products', token);
        const filtered = response.data.filter(p => p.stock < STOCK_THRESHOLD);
        setLowStockItems(filtered);
      } catch (err) {
        setError('No se pudieron cargar los productos.');
      }
    };
    fetchData();
  }, [token]);

  if (error) return <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg col-span-1 md:col-span-2">{error}</div>;
  if (!lowStockItems) return <div className="bg-white p-6 rounded-lg border col-span-1 md:col-span-2"><LoadingSpinner /></div>;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-1 md:col-span-2">
      <div className="flex items-center mb-4">
        <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
        <h3 className="text-base font-semibold text-gray-800">Alertas de Stock Bajo (Menos de {STOCK_THRESHOLD} uds.)</h3>
      </div>
      <div className="overflow-y-auto max-h-60 pr-2">
        {lowStockItems.length > 0 ? (
          <ul className="space-y-2">
            {lowStockItems.map(item => (
              <li key={item.id_producto} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                <span className="text-gray-600">{item.nombre}</span>
                <span className="font-bold text-red-600">{item.stock}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-4">No hay productos con stock bajo.</p>
        )}
      </div>
    </div>
  );
};

const CashBoxStatus = ({ token }) => {
    const [cashboxes, setCashboxes] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.get('/cajas', token);
                setCashboxes(response.data);
            } catch (err) {
                setError('No se pudo cargar el estado de las cajas.');
            }
        };
        fetchData();
    }, [token]);
    
    if (error) return <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg col-span-1 md:col-span-1">{error}</div>;
    if (!cashboxes) return <div className="bg-white p-6 rounded-lg border"><LoadingSpinner /></div>;

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-1 md:col-span-1">
             <div className="flex items-center mb-4">
                <Box className="w-5 h-5 text-indigo-500 mr-3" />
                <h3 className="text-base font-semibold text-gray-800">Estado de Cajas</h3>
            </div>
            <div className="space-y-4">
                {cashboxes.map(caja => (
                    <div key={caja.id_caja} className={`p-3 rounded-lg border-l-4 ${caja.abierta ? 'border-green-500 bg-green-50' : 'border-gray-400 bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-700">Caja #{caja.id_caja}</span>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${caja.abierta ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                {caja.abierta ? 'ABIERTA' : 'CERRADA'}
                            </span>
                        </div>
                        {caja.abierta && (
                            <div className="mt-2 text-xs text-gray-500">
                                <p>Por: <span className="font-medium text-gray-700">{caja.usuario.nombre_usuario}</span></p>
                                <p>Inicio: <span className="font-medium text-gray-700">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(caja.monto_inicial)}</span></p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};


// ========= Page Components =========

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
        const response = await apiClient.post('/login', { nombre_usuario: username, contrasena: password });
        onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg border">
        <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Panel de Monitoreo</h1>
            <p className="mt-2 text-sm text-gray-500">Ingresa tus credenciales</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="text-sm font-medium text-gray-600 block mb-1">Usuario</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-gray-100 rounded-md border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>
          <div>
            <label htmlFor="password"  className="text-sm font-medium text-gray-600 block mb-1">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 bg-gray-100 rounded-md border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center bg-red-100 p-2 rounded-md">{error}</p>}
          <div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition disabled:bg-indigo-400"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const DashboardPage = ({ user, token, onLogout }) => {
    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Panel de Monitoreo</h1>
                        <p className="text-sm text-gray-500">Usuario: <span className="font-medium text-indigo-600">{user.nombre_usuario}</span></p>
                    </div>
                    <button onClick={onLogout} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-red-600 font-medium py-2 px-3 rounded-lg hover:bg-red-50 transition">
                        <LogOut className="w-4 h-4"/>
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </header>
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   <SalesSummary token={token} />
                   <StockAlerts token={token} />
                   <CashBoxStatus token={token} />
                </div>
            </main>
        </div>
    );
};


// ========= Main App Component =========
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('posMonitorToken'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('posMonitorUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('posMonitorToken', newToken);
    localStorage.setItem('posMonitorUser', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('posMonitorToken');
    localStorage.removeItem('posMonitorUser');
    setToken(null);
    setUser(null);
  };
  
  return (
    <div className="font-sans">
        {token && user ? (
            <DashboardPage user={user} token={token} onLogout={handleLogout} />
        ) : (
            <LoginPage onLogin={handleLogin} />
        )}
    </div>
  );
}
