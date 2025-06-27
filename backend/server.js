// Importar los módulos necesarios
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuración de CORS ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.1.8:5173',
  'http://172.20.10.8:5173'
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Configuración de la Base de Datos PostgreSQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Funciones Auxiliares ---
const logAction = async (employeeId, employeeName, actionType, details) => {
    try {
        await pool.query('INSERT INTO action_logs (employee_id, employee_name, action_type, details) VALUES ($1, $2, $3, $4)', [employeeId, employeeName, actionType, details]);
    } catch (err) { console.error('AUDIT LOG FAILED:', err); }
};
const calculateSellingPrice = (cost) => {
    if (cost <= 0) return 0;
    const priceWithMarginAndVat = cost * 1.40 * 1.19;
    return Math.round(priceWithMarginAndVat / 50) * 50;
};
const formatProductForFrontend = (dbProduct) => {
  if (!dbProduct) return null;
  return {
    id: dbProduct.id, name: dbProduct.name, code: dbProduct.code, category: dbProduct.category,
    is_active: dbProduct.is_active, supplier_id: dbProduct.supplier_id, supplier_name: dbProduct.supplier_name,
    price: parseFloat(dbProduct.selling_price), stock: parseInt(dbProduct.stock, 10), cost_price: parseFloat(dbProduct.cost_price),
    fecha_vencimiento: dbProduct.fecha_vencimiento,
  };
};

// --- Middleware de Autenticación ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

// --- Rutas de la API ---
const apiRouter = express.Router();
app.use('/api', apiRouter);

// --- Rutas de Autenticación ---
apiRouter.post('/login', async (req, res) => {
    const { rut, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM employees WHERE rut = $1 AND is_active = true', [rut]);
        if (result.rows.length === 0) return res.status(400).json({ message: 'Credenciales inválidas' });
        const employee = result.rows[0];
        const isMatch = await bcrypt.compare(password, employee.password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas' });
        const userPayload = { id: employee.id, name: `${employee.first_name} ${employee.last_name || ''}`.trim(), role: employee.role };
        const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: userPayload });
    } catch (err) { res.status(500).json({ message: 'Error del servidor' }); }
});

// =================================================================
// --- CRUD DE EMPLEADOS (USUARIOS) ---
// =================================================================
const employeeRouter = express.Router();
employeeRouter.use(authenticateToken);
employeeRouter.use(isAdmin);
employeeRouter.get('/', async (req, res) => { try { const { rows } = await pool.query('SELECT id, first_name, last_name, rut, role, is_active, created_at FROM employees ORDER BY first_name, last_name'); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error al obtener empleados', error: err.message }); } });
employeeRouter.post('/', async (req, res) => {
    const { first_name, last_name, rut, role, password } = req.body;
    if (!first_name || !rut || !role || !password) { return res.status(400).json({ message: 'Nombre, RUT, rol y contraseña son requeridos.' }); }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO employees (id, first_name, last_name, rut, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, first_name, last_name, rut, role, is_active, created_at';
        const { rows } = await pool.query(query, [uuidv4(), first_name, last_name || '', rut, role, hashedPassword]);
        await logAction(req.user.id, req.user.name, 'EMPLOYEE_CREATE', `Creó al usuario '${first_name} ${last_name}' con RUT ${rut}.`);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: 'El RUT ingresado ya existe.' }); }
        res.status(500).json({ message: 'Error al registrar empleado', error: err.message });
    }
});
employeeRouter.put('/:id', async (req, res) => {
    const { id } = req.params; const { first_name, last_name, rut, role, is_active, password } = req.body;
    if (!first_name || !rut || !role || is_active === undefined) { return res.status(400).json({ message: 'Nombre, RUT, rol y estado son requeridos.' }); }
    try {
        let hashedPassword = undefined; if (password) { hashedPassword = await bcrypt.hash(password, 10); }
        const currentDataQuery = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
        if (currentDataQuery.rows.length === 0) { return res.status(404).json({ message: 'Empleado no encontrado' }); }
        const updateFields = [first_name, last_name || '', rut, role, is_active];
        let query;
        if (hashedPassword) { query = `UPDATE employees SET first_name = $1, last_name = $2, rut = $3, role = $4, is_active = $5, password_hash = $6 WHERE id = $7 RETURNING id, first_name, last_name, rut, role, is_active, created_at`; updateFields.push(hashedPassword, id); }
        else { query = `UPDATE employees SET first_name = $1, last_name = $2, rut = $3, role = $4, is_active = $5 WHERE id = $6 RETURNING id, first_name, last_name, rut, role, is_active, created_at`; updateFields.push(id); }
        const { rows } = await pool.query(query, updateFields);
        await logAction(req.user.id, req.user.name, 'EMPLOYEE_UPDATE', `Actualizó datos del usuario con RUT ${rut}.`);
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: 'El RUT ingresado ya pertenece a otro usuario.' }); }
        res.status(500).json({ message: 'Error al actualizar empleado', error: err.message });
    }
});
apiRouter.use('/employees', employeeRouter);

// --- Rutas de Gestión de Caja ---
apiRouter.get('/cash-sessions/active', authenticateToken, async (req, res) => { try { const { rows } = await pool.query('SELECT * FROM cash_sessions WHERE is_active = true LIMIT 1'); res.json(rows[0] || null); } catch (err) { res.status(500).json({ message: "Error checking for active session", error: err.message }); } });
apiRouter.post('/cash-sessions/start', authenticateToken, async (req, res) => {
    const { start_amount } = req.body; const { id: employee_id, name: employee_name } = req.user;
    if (start_amount === undefined || start_amount < 0) { return res.status(400).json({ message: "A valid start amount is required." }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: activeSessions } = await client.query('SELECT id FROM cash_sessions WHERE is_active = true');
        if (activeSessions.length > 0) { throw new Error('An active session already exists.'); }
        const query = 'INSERT INTO cash_sessions (employee_id, start_amount, current_balance) VALUES ($1, $2, $3) RETURNING *';
        const { rows } = await client.query(query, [employee_id, start_amount, start_amount]);
        await logAction(employee_id, employee_name, 'CASHBOX_OPEN', `Inició caja con $${start_amount}.`);
        await client.query('COMMIT'); res.status(201).json(rows[0]);
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: "Error starting new session", error: err.message }); } finally { client.release(); }
});
apiRouter.post('/cash-sessions/close', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sessionResult = await client.query('SELECT * FROM cash_sessions WHERE is_active = true LIMIT 1');
        if (sessionResult.rows.length === 0) { return res.status(200).json({ message: 'No active session to close.' }); }
        const session = sessionResult.rows[0];
        const { rows } = await client.query('UPDATE cash_sessions SET is_active = false, end_time = NOW() WHERE id = $1 RETURNING *', [session.id]);
        const finalBalance = rows[0].current_balance;
        await logAction(req.user.id, req.user.name, 'CASHBOX_CLOSE', `Cerró caja con un saldo final de $${finalBalance}.`);
        await client.query('COMMIT'); res.status(200).json(rows[0]);
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: "Error closing the session", error: err.message }); } finally { client.release(); }
});
apiRouter.post('/cash-movements', authenticateToken, async (req, res) => {
    const { type, amount, reason, adminRut, adminPassword } = req.body; const requestingUser = req.user;
    if (!type || !amount || !reason || !adminRut || !adminPassword) { return res.status(400).json({ message: 'Todos los campos son requeridos.' }); }
    if (amount <= 0) { return res.status(400).json({ message: 'El monto debe ser positivo.' }); }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const adminResult = await client.query('SELECT * FROM employees WHERE rut = $1 AND role = $2 AND is_active = true', [adminRut, 'admin']);
        if (adminResult.rows.length === 0) { throw new Error('Administrador no válido o no encontrado.'); }
        const admin = adminResult.rows[0]; const isPasswordMatch = await bcrypt.compare(adminPassword, admin.password_hash);
        if (!isPasswordMatch) { throw new Error('Contraseña de administrador incorrecta.'); }
        const sessionResult = await client.query('SELECT * FROM cash_sessions WHERE is_active = true LIMIT 1');
        if (sessionResult.rows.length === 0) { throw new Error('No hay una sesión de caja activa.'); }
        const session = sessionResult.rows[0]; let newBalance;
        if (type === 'ADD') { newBalance = parseFloat(session.current_balance) + parseFloat(amount); }
        else if (type === 'REMOVE') { newBalance = parseFloat(session.current_balance) - parseFloat(amount); if (newBalance < 0) { throw new Error('El retiro no puede dejar la caja con saldo negativo.'); } }
        else { throw new Error('Tipo de movimiento no válido.'); }
        const { rows } = await client.query('UPDATE cash_sessions SET current_balance = $1 WHERE id = $2 RETURNING *', [newBalance, session.id]);
        const actionType = type === 'ADD' ? 'CASH_ADD' : 'CASH_REMOVE'; const details = `${type === 'ADD' ? 'Agregó' : 'Retiró'} $${amount}. Motivo: ${reason}. Aprobado por: ${admin.first_name}.`;
        await logAction(requestingUser.id, requestingUser.name, actionType, details);
        await client.query('COMMIT'); res.status(200).json(rows[0]);
    } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); } finally { client.release(); }
});

// =================================================================
// --- INICIO: RUTAS CRUD PARA PROVEEDORES ---
// =================================================================
const supplierRouter = express.Router();
supplierRouter.use(authenticateToken);

supplierRouter.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});
supplierRouter.post('/', isAdmin, async (req, res) => {
    const { name, rut, contact_person, phone, email, address } = req.body;
    if (!name) { return res.status(400).json({ message: 'El nombre del proveedor es requerido.' }); }
    try {
        const query = `
            INSERT INTO suppliers (id, name, rut, contact_person, phone, email, address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [uuidv4(), name, rut || null, contact_person || null, phone || null, email || null, address || null]);
        await logAction(req.user.id, req.user.name, 'SUPPLIER_CREATE', `Creó al proveedor '${name}'.`);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: 'El RUT o Email ingresado ya existe.' }); }
        res.status(500).json({ message: 'Error al crear proveedor', error: err.message });
    }
});
supplierRouter.put('/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, rut, contact_person, phone, email, address } = req.body;
    if (!name) { return res.status(400).json({ message: 'El nombre del proveedor es requerido.' }); }
    try {
        const query = `
            UPDATE suppliers SET name = $1, rut = $2, contact_person = $3, phone = $4, email = $5, address = $6
            WHERE id = $7 RETURNING *;
        `;
        const { rows } = await pool.query(query, [name, rut || null, contact_person || null, phone || null, email || null, address || null, id]);
        if (rows.length === 0) { return res.status(404).json({ message: 'Proveedor no encontrado.' }); }
        await logAction(req.user.id, req.user.name, 'SUPPLIER_UPDATE', `Actualizó al proveedor '${name}'.`);
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: 'El RUT o Email ingresado ya pertenece a otro proveedor.' }); }
        res.status(500).json({ message: 'Error al actualizar proveedor', error: err.message });
    }
});
supplierRouter.delete('/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING name', [id]);
        if (rows.length === 0) { return res.status(404).json({ message: 'Proveedor no encontrado.' }); }
        await logAction(req.user.id, req.user.name, 'SUPPLIER_DELETE', `Eliminó al proveedor '${rows[0].name}'.`);
        res.status(204).send();
    } catch (err) {
        if (err.code === '23503') { return res.status(409).json({ message: 'No se puede eliminar el proveedor porque está en uso.' }); }
        res.status(500).json({ message: 'Error al eliminar proveedor', error: err.message });
    }
});
apiRouter.use('/suppliers', supplierRouter);

// --- Rutas de Productos ---
apiRouter.post('/products', authenticateToken, async (req, res) => {
    const { name, code, category, cost_price, stock, supplier_id, fecha_vencimiento } = req.body;
    try {
        const sellingPrice = calculateSellingPrice(parseFloat(cost_price));
        const query = `
            INSERT INTO products (id, name, code, category, cost_price, selling_price, stock, supplier_id, fecha_vencimiento) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [uuidv4(), name, code || null, category, cost_price, sellingPrice, stock, supplier_id || null, fecha_vencimiento || null]);
        await logAction(req.user.id, req.user.name, 'PRODUCT_CREATE', `Creó el producto '${name}' (Stock: ${stock}).`);
        res.status(201).json(formatProductForFrontend(rows[0]));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- Rutas de Ventas ---
apiRouter.post('/sales', authenticateToken, async (req, res) => {
    const { items, total_amount, payment_method, adminRut, adminPassword } = req.body; const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let saleEmployeeId = req.user.id; let authorizingAdminName = null;
        if (payment_method === 'venta especial') {
            if (!adminRut || !adminPassword) { throw new Error('Se requieren credenciales de administrador para una venta especial.'); }
            const adminResult = await client.query('SELECT * FROM employees WHERE rut = $1 AND role = \'admin\' AND is_active = true', [adminRut]);
            if (adminResult.rows.length === 0) { throw new Error('Administrador no válido o no encontrado.'); }
            const admin = adminResult.rows[0]; const isPasswordMatch = await bcrypt.compare(adminPassword, admin.password_hash);
            if (!isPasswordMatch) { throw new Error('Contraseña de administrador incorrecta.'); }
            saleEmployeeId = admin.id; authorizingAdminName = `${admin.first_name} ${admin.last_name || ''}`.trim();
        }
        if (payment_method === 'efectivo') {
            const { rowCount: sessionRowCount } = await client.query('UPDATE cash_sessions SET current_balance = current_balance + $1 WHERE is_active = true', [total_amount]);
            if (sessionRowCount === 0) throw new Error('No se encontró una sesión de caja activa.');
        }
        const saleQuery = `INSERT INTO sales (id, total_amount, net_amount, employee_id, payment_method) VALUES ($1, $2, $2 / 1.19, $3, $4) RETURNING id, sale_date;`;
        const { rows: [newSale] } = await client.query(saleQuery, [uuidv4(), total_amount, saleEmployeeId, payment_method]);
        for (const item of items) {
            await client.query('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES ($1, $2, $3, $4)', [newSale.id, item.product_id, item.quantity, item.price_at_sale]);
            const stockUpdateQuery = `UPDATE products SET stock = stock - $1, is_active = CASE WHEN (stock - $1) <= 0 THEN false ELSE is_active END WHERE id = $2 AND stock >= $1`;
            const { rowCount } = await client.query(stockUpdateQuery, [item.quantity, item.product_id]);
            if (rowCount === 0) throw new Error(`Stock insuficiente para el producto ID ${item.product_id}.`);
        }
        let logDetails = `Venta procesada por $${total_amount} con método '${payment_method}'.`;
        if (payment_method === 'venta especial') { logDetails += ` Autorizada por: ${authorizingAdminName}. Registrada por (cajero): ${req.user.name}.`; }
        await logAction(req.user.id, req.user.name, 'SALE_PROCESSED', logDetails);
        await client.query('COMMIT');
        res.status(201).json({ message: "Venta procesada", total_amount: parseFloat(total_amount) });
    } catch (err) { await client.query('ROLLBACK'); res.status(400).json({ message: err.message }); } finally { client.release(); }
});

// --- RUTA PROVISIONAL PARA IMPRESIÓN ---
apiRouter.post('/print-receipt', authenticateToken, (req, res) => {
    console.log("--- SOLICITUD DE IMPRESIÓN RECIBIDA ---");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("---------------------------------------");
    const isPrinterConnected = false; 
    if (isPrinterConnected) {
        res.status(200).json({ message: "Recibo enviado a la impresora." });
    } else {
        res.status(202).json({ message: "Venta guardada, pero no se pudo conectar con la impresora para imprimir el recibo." });
    }
});

apiRouter.get('/products/low-stock', authenticateToken, async (req, res) => {
    const LOW_STOCK_THRESHOLD = 5;
    try { const query = `SELECT id, name, stock FROM products WHERE is_active = true AND stock > 0 AND stock <= $1 ORDER BY stock ASC;`; const { rows } = await pool.query(query, [LOW_STOCK_THRESHOLD]); res.json(rows); }
    catch (err) { res.status(500).json({ message: 'Error fetching low stock products', error: err.message }); }
});

apiRouter.get('/products/expiring-soon', authenticateToken, async (req, res) => {
    try { const query = `SELECT id, name, stock, fecha_vencimiento FROM products WHERE fecha_vencimiento IS NOT NULL AND is_active = true AND fecha_vencimiento BETWEEN NOW() AND NOW() + interval '30 day' ORDER BY fecha_vencimiento ASC;`; const { rows } = await pool.query(query); res.json(rows); }
    catch (err) { res.status(500).json({ message: 'Error fetching expiring products', error: err.message }); }
});

apiRouter.get('/products', authenticateToken, async (req, res) => {
    const { include_inactive } = req.query;
    let query = `SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id`;
    if (include_inactive !== 'true') query += ' WHERE p.is_active = true';
    query += ' ORDER BY p.name ASC';
    try { const { rows } = await pool.query(query); res.json(rows.map(formatProductForFrontend)); } 
    catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.put('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { name, code, category, cost_price, stock, supplier_id, recalculate_price, fecha_vencimiento } = req.body;
    try {
        const { rows: [oldProduct] } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (!oldProduct) return res.status(404).json({ message: 'Product not found' });
        const finalCostPrice = parseFloat(cost_price); const sellingPrice = recalculate_price ? calculateSellingPrice(finalCostPrice) : oldProduct.selling_price;
        const newStock = parseInt(stock, 10); let newIsActive = oldProduct.is_active;
        if (parseInt(oldProduct.stock, 10) <= 0 && newStock > 0) { newIsActive = true; } else if (newStock <= 0) { newIsActive = false; }
        const query = `UPDATE products SET name = $1, code = $2, category = $3, cost_price = $4, stock = $5, supplier_id = $6, selling_price = $7, fecha_vencimiento = $8, is_active = $9 WHERE id = $10 RETURNING *;`;
        const { rows } = await pool.query(query, [name, code, category, finalCostPrice, newStock, supplier_id, sellingPrice, fecha_vencimiento || null, newIsActive, id]);
        let details = [`'${name}' actualizado.`];
        if (oldProduct.stock != newStock) details.push(`Stock: ${oldProduct.stock} -> ${newStock}.`);
        if (oldProduct.cost_price != cost_price) details.push(`Costo: $${oldProduct.cost_price} -> $${cost_price}.`);
        if (oldProduct.is_active !== newIsActive) details.push(`Estado cambiado a ${newIsActive ? 'Activo' : 'Inactivo'}.`);
        await logAction(req.user.id, req.user.name, 'PRODUCT_UPDATE', details.join(' '));
        res.json(formatProductForFrontend(rows[0]));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.patch('/products/:id/toggle-status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: [product] } = await pool.query('SELECT name, stock, is_active FROM products WHERE id = $1', [id]);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        const newStatus = !product.is_active;
        if (newStatus === true && parseInt(product.stock, 10) <= 0) { return res.status(400).json({ message: 'No se puede activar un producto sin stock.' }); }
        const { rows: [updatedProduct] } = await pool.query('UPDATE products SET is_active = $1 WHERE id = $2 RETURNING *', [newStatus, id]);
        const action = newStatus ? 'PRODUCT_ACTIVATE' : 'PRODUCT_DEACTIVATE';
        await logAction(req.user.id, req.user.name, action, `Cambió el estado de '${updatedProduct.name}' a ${newStatus ? 'Activo' : 'Inactivo'}.`);
        res.json(formatProductForFrontend(updatedProduct));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.get('/sales', authenticateToken, async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const params = []; let filterClause = '';
        if (startDate && endDate) { filterClause = ` WHERE created_at BETWEEN $1 AND $2`; params.push(startDate, endDate); }
        const salesQuery = `SELECT s.id, s.total_amount, s.payment_method, s.sale_date as created_at, e.first_name || ' ' || e.last_name as employee_name FROM sales s JOIN employees e ON s.employee_id = e.id ${filterClause.replace('created_at', 's.sale_date')}`;
        const salesResult = await pool.query(salesQuery, params);
        const salesWithItems = await Promise.all(salesResult.rows.map(async (sale) => { const itemsResult = await pool.query(`SELECT si.*, p.name as product_name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1`, [sale.id]); return { ...sale, type: 'SALE', items: itemsResult.rows }; }));
        const logsQuery = `SELECT id, employee_name, action_type, details, created_at FROM action_logs ${filterClause}`;
        const logsResult = await pool.query(logsQuery, params); const logsFormatted = logsResult.rows.map(log => ({ ...log, type: 'LOG' }));
        const combinedFeed = [...salesWithItems, ...logsFormatted];
        combinedFeed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(combinedFeed);
    } catch (err) { res.status(500).json({ message: 'Error fetching reports', error: err.message }); }
});

// --- Rutas de Pedidos (Purchase & Customer) ---
const purchaseOrderRouter = express.Router(); purchaseOrderRouter.use(authenticateToken);
purchaseOrderRouter.get('/', async (req, res) => { try { const query = ` SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.order_date DESC `; const { rows } = await pool.query(query); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error fetching purchase orders', error: err.message }); } });
purchaseOrderRouter.post('/', async (req, res) => { const { supplier_id, expected_delivery_date, notes, items, total_cost } = req.body; const client = await pool.connect(); try { await client.query('BEGIN'); const poQuery = ` INSERT INTO purchase_orders (id, supplier_id, expected_delivery_date, notes, total_cost, status, created_by) VALUES ($1, $2, $3, $4, $5, 'ordenado', $6) RETURNING *; `; const { rows: [newPO] } = await client.query(poQuery, [uuidv4(), supplier_id, expected_delivery_date, notes, total_cost, req.user.id]); for(const item of items) { const poItemQuery = ` INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, cost_price_at_purchase) VALUES ($1, $2, $3, $4); `; await client.query(poItemQuery, [newPO.id, item.product_id, item.quantity, item.cost_price]); } await logAction(req.user.id, req.user.name, 'PURCHASE_ORDER_CREATE', `Creó orden de compra #${newPO.id.substring(0,8)} por $${total_cost}.`); await client.query('COMMIT'); res.status(201).json(newPO); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Error creating purchase order', error: err.message }); } finally { client.release(); } });
purchaseOrderRouter.put('/:id/receive', async (req, res) => { const { id: purchase_order_id } = req.params; const { items_received } = req.body; const client = await pool.connect(); try { await client.query('BEGIN'); for (const item of items_received) { await client.query( 'UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2', [item.quantity_received, item.item_id] ); const { rows: [poItem] } = await client.query('SELECT product_id FROM purchase_order_items WHERE id = $1', [item.item_id]); await client.query( 'UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity_received, poItem.product_id] ); } const { rows: allItems } = await client.query('SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1', [purchase_order_id]); const totalOrdered = allItems.reduce((sum, i) => sum + i.quantity_ordered, 0); const totalReceived = allItems.reduce((sum, i) => sum + i.quantity_received, 0); let newStatus = 'recibido_parcial'; if (totalReceived >= totalOrdered) { newStatus = 'recibido_completo'; } const { rows: [updatedPO] } = await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2 RETURNING *', [newStatus, purchase_order_id]); await logAction(req.user.id, req.user.name, 'PURCHASE_ORDER_RECEIVE', `Recibió items para la orden de compra #${purchase_order_id.substring(0,8)}.`); await client.query('COMMIT'); res.json(updatedPO); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Error receiving purchase order items', error: err.message }); } finally { client.release(); } });
apiRouter.use('/purchase-orders', purchaseOrderRouter);

const customerOrderRouter = express.Router(); customerOrderRouter.use(authenticateToken);
customerOrderRouter.get('/', async (req, res) => { try { const query = `SELECT * FROM customer_orders ORDER BY delivery_date ASC`; const { rows } = await pool.query(query); const ordersWithItems = await Promise.all(rows.map(async (order) => { const itemsResult = await pool.query('SELECT * FROM customer_order_items WHERE order_id = $1', [order.id]); return { ...order, items: itemsResult.rows }; })); res.json(ordersWithItems); } catch (err) { res.status(500).json({ message: 'Error fetching customer orders', error: err.message }); } });
customerOrderRouter.post('/', async (req, res) => { const { customer_name, customer_phone, delivery_date, total_amount, down_payment, notes, items } = req.body; const client = await pool.connect(); try { await client.query('BEGIN'); const coQuery = ` INSERT INTO customer_orders (customer_name, customer_phone, delivery_date, total_amount, down_payment, notes, employee_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente') RETURNING *; `; const { rows: [newCO] } = await client.query(coQuery, [customer_name, customer_phone, delivery_date, total_amount, down_payment || 0, notes, req.user.id]); for(const item of items) { const coItemQuery = ` INSERT INTO customer_order_items (order_id, description, quantity, unit_price) VALUES ($1, $2, $3, $4); `; await client.query(coItemQuery, [newCO.id, item.description, item.quantity, item.unit_price]); } await logAction(req.user.id, req.user.name, 'CUSTOMER_ORDER_CREATE', `Creó pedido para cliente '${customer_name}' por $${total_amount}.`); await client.query('COMMIT'); res.status(201).json(newCO); } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Error creating customer order', error: err.message }); } finally { client.release(); } });
customerOrderRouter.put('/:id/status', async (req, res) => { const { id } = req.params; const { status } = req.body; try { const { rows: [updatedOrder] } = await pool.query('UPDATE customer_orders SET status = $1 WHERE id = $2 RETURNING *', [status, id]); await logAction(req.user.id, req.user.name, 'CUSTOMER_ORDER_UPDATE', `Actualizó estado del pedido #${id.substring(0,8)} a '${status}'.`); res.json(updatedOrder); } catch (err) { res.status(500).json({ message: 'Error updating customer order status', error: err.message }); } });
apiRouter.use('/customer-orders', customerOrderRouter);

// =================================================================
// --- INICIO: RUTAS DE REPORTES ---
// =================================================================
const reportsRouter = express.Router();
reportsRouter.use(authenticateToken);
reportsRouter.use(isAdmin); // Asegurarse que solo los admins puedan ver

reportsRouter.get('/summary', async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1. Ventas de Hoy (Total y Cantidad)
        const salesTodayQuery = `
            SELECT
                COALESCE(SUM(total_amount), 0) as total_sales_today,
                COALESCE(COUNT(id), 0) as number_of_sales_today
            FROM sales
            WHERE sale_date >= $1;
        `;
        const { rows: [salesToday] } = await pool.query(salesTodayQuery, [todayStart]);

        // 2. Total por Método de Pago Hoy
        const paymentMethodQuery = `
            SELECT payment_method, COALESCE(SUM(total_amount), 0) as total
            FROM sales
            WHERE sale_date >= $1
            GROUP BY payment_method;
        `;
        const { rows: paymentMethods } = await pool.query(paymentMethodQuery, [todayStart]);
        const salesByPayment = { efectivo: 0, tarjeta: 0, 'venta especial': 0 };
        paymentMethods.forEach(pm => {
            if (salesByPayment.hasOwnProperty(pm.payment_method)) {
                salesByPayment[pm.payment_method] = parseFloat(pm.total);
            }
        });

        // 3. Producto más vendido Hoy
        const topProductQuery = `
            SELECT p.name, SUM(si.quantity) as total_quantity
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            WHERE s.sale_date >= $1
            GROUP BY p.name
            ORDER BY total_quantity DESC
            LIMIT 1;
        `;
        const { rows: [topProduct] } = await pool.query(topProductQuery, [todayStart]);
        
        // 4. Pedidos pendientes
        const pendingOrdersQuery = `
            SELECT COUNT(id) as pending_orders_count
            FROM customer_orders
            WHERE status IN ('pendiente', 'en_preparacion');
        `;
        const { rows: [pendingOrders] } = await pool.query(pendingOrdersQuery);


        res.json({
            total_sales_today: parseFloat(salesToday.total_sales_today),
            number_of_sales_today: parseInt(salesToday.number_of_sales_today, 10),
            sales_by_payment_method: salesByPayment,
            top_selling_product_today: topProduct || { name: 'N/A', total_quantity: 0 },
            pending_customer_orders: parseInt(pendingOrders.pending_orders_count, 10),
        });

    } catch (err) {
        console.error('Error fetching summary report:', err);
        res.status(500).json({ message: 'Error al obtener el resumen de reportes', error: err.message });
    }
});
apiRouter.use('/reports', reportsRouter);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
