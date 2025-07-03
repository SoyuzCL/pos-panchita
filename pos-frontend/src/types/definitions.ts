// --- Tipos de Datos Globales ---

export interface Supplier { 
  id: string; 
  name: string; 
  contact_person?: string; 
  phone?: string; 
  email?: string; 
  address?: string; 
  rut?: string; 
}

export interface Product { 
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

export interface CartItem extends Product { 
  quantity: number; 
}

export interface User { 
  id: string; 
  name: string; 
  role: 'admin' | 'cajero'; 
}

export interface CashSession { 
  id: string; 
  current_balance: number; 
}

export interface SaleLog { 
  type: 'SALE'; 
  id: string; 
  items: Array<{ 
    product_name: string; 
    quantity: number; 
    price_at_sale: number; 
    subtotal: number; 
  }>; 
  total_amount: number; 
  created_at: string; 
  employee_name: string; 
  payment_method: 'efectivo' | 'tarjeta' | 'venta especial'; 
}

export interface ActionLog { 
  type: 'LOG'; 
  id: string; 
  employee_name: string; 
  action_type: string; 
  details: string; 
  created_at: string; 
}

export type Activity = SaleLog | ActionLog;

export type PurchaseOrderStatus = 'pendiente' | 'ordenado' | 'recibido_parcial' | 'recibido_completo' | 'cancelado';

export interface PurchaseOrderItem { 
  id: string; 
  product_id: string; 
  quantity_ordered: number; 
  quantity_received: number; 
  cost_price_at_purchase: number; 
  product_name?: string; 
}

export interface PurchaseOrder { 
  id: string; 
  supplier_id: string; 
  supplier_name: string; 
  order_date: string; 
  expected_delivery_date?: string; 
  status: PurchaseOrderStatus; 
  total_cost: number; 
  notes?: string; 
  items: PurchaseOrderItem[]; 
}

export type CustomerOrderStatus = 'pendiente' | 'en_preparacion' | 'listo_para_entrega' | 'completado' | 'cancelado';

export interface CustomerOrderItem { 
  id: string; 
  description: string; 
  quantity: number; 
  unit_price: number; 
}

export interface CustomerOrder { 
  id: string; 
  customer_name: string; 
  customer_phone?: string; 
  order_date: string; 
  delivery_date: string; 
  total_amount: number; 
  down_payment: number; 
  status: CustomerOrderStatus; 
  notes?: string; 
  items: CustomerOrderItem[]; 
}

export type Page = 'sales' | 'inventory' | 'reports' | 'suppliers' | 'orders';
