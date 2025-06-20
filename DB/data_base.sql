-- =================================================================================
-- SECCIÓN DE LIMPIEZA
-- =================================================================================

DROP TABLE IF EXISTS cash_sessions;
DROP TABLE IF EXISTS action_logs;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS customer_order_items; -- <-- NUEVA TABLA
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS customer_orders; -- <-- NUEVA TABLA
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;
DROP FUNCTION IF EXISTS trigger_set_timestamp();

-- =================================================================================
-- Habilitar extensiones
-- =================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================================
-- 1. TABLAS PRINCIPALES DEL NEGOCIO
-- =================================================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255) UNIQUE,
    address TEXT,
    rut VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    rut VARCHAR(20) UNIQUE,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150),
    rut VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'cajero')),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================================
-- 2. TABLAS DE TRANSACCIONES
-- =================================================================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE,
    category VARCHAR(100) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    fecha_vencimiento DATE DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    net_amount DECIMAL(10, 2) NOT NULL CHECK (net_amount >= 0),
    vat_amount DECIMAL(10, 2) GENERATED ALWAYS AS (total_amount - net_amount) STORED,
    sale_date TIMESTAMPTZ DEFAULT NOW(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('efectivo', 'tarjeta', 'venta especial')) -- <-- CAMBIO: AÑADIDO 'venta especial'
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_sale DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * price_at_sale) STORED
);

-- =================================================================================
-- 3. TABLAS DE PEDIDOS
-- =================================================================================

-- Pedidos a nuestros proveedores para reponer stock
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    order_date TIMESTAMPTZ DEFAULT NOW(),
    expected_delivery_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'ordenado', 'recibido_parcial', 'recibido_completo', 'cancelado')),
    total_cost DECIMAL(12, 2),
    notes TEXT,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    invoice_file_path TEXT
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
    quantity_received INTEGER DEFAULT 0,
    cost_price_at_purchase DECIMAL(10, 2) NOT NULL
);

-- Pedidos que nos hacen los clientes (pan, tortas, etc.)
CREATE TABLE customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    order_date TIMESTAMPTZ DEFAULT NOW(),
    delivery_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    down_payment DECIMAL(10, 2) DEFAULT 0, -- Adelanto
    status VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_preparacion', 'listo_para_entrega', 'completado', 'cancelado')),
    notes TEXT,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE customer_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL, -- "Torta de chocolate para 20 personas"
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);


-- =================================================================================
-- 4. TABLA DE REGISTRO DE ACCIONES (AUDITORÍA)
-- =================================================================================

CREATE TABLE action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255),
    action_type VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================================
-- 5. GESTIÓN DE CAJA
-- =================================================================================

CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_amount DECIMAL(10, 2) NOT NULL,
    current_balance DECIMAL(10, 2) NOT NULL,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    employee_id UUID NOT NULL REFERENCES employees(id),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- =================================================================================
-- 6. ÍNDICES Y TRIGGERS
-- =================================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para la tabla de productos
CREATE TRIGGER set_products_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Índices para mejorar el rendimiento
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_fecha_vencimiento ON products(fecha_vencimiento);

CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_employee_id ON sales(employee_id);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product_id ON purchase_order_items(product_id);

CREATE INDEX idx_customer_orders_delivery_date ON customer_orders(delivery_date);
CREATE INDEX idx_customer_orders_status ON customer_orders(status);
CREATE INDEX idx_customer_order_items_order_id ON customer_order_items(order_id);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_customers_rut ON customers(rut);
CREATE INDEX idx_employees_rut ON employees(rut);
CREATE INDEX idx_action_logs_employee_id ON action_logs(employee_id);
CREATE INDEX idx_action_logs_action_type ON action_logs(action_type);

CREATE INDEX idx_active_cash_session ON cash_sessions(is_active) WHERE is_active = true;
