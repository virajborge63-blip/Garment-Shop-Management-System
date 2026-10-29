import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Package,
  Layers,
  Receipt,
  Users,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit,
  Printer,
  TrendingUp,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Truck,
} from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  size: string;
  color: string;
  fabric: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  status: string;
}

interface CategoryItem {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
}

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  size: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface SaleRecord {
  id: string;
  bill_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  payment_method: string;
  cashier_name: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

export const InventoryBillingManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'products' | 'categories' | 'sales' | 'suppliers'>('pos');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // POS / Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Net Banking'>('Cash');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<SaleRecord | null>(null);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<ProductItem | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [stockReason, setStockReason] = useState('New Shipment Received');

  // New Product Form State
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    size: 'M',
    color: 'Navy Blue',
    fabric: 'Pure Cotton',
    cost_price: 500,
    selling_price: 1200,
    stock_quantity: 20,
    min_stock_alert: 5,
  });

  // New Category Form State
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  // New Supplier Form State
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
  });

  const token = localStorage.getItem('erp_token');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchProducts(), fetchCategories(), fetchSales(), fetchSuppliers()]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/shop/products', { headers: authHeaders });
      const data = await res.json();
      if (data.products) {
        setProducts(data.products.map((p: any) => ({ ...p, id: p.id || p._id })));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/shop/categories', { headers: authHeaders });
      const data = await res.json();
      if (data.categories) {
        const mapped = data.categories.map((c: any) => ({ ...c, id: c.id || c._id }));
        setCategories(mapped);
        if (mapped.length > 0 && !productForm.category) {
          setProductForm((prev) => ({ ...prev, category: mapped[0].name }));
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/shop/sales', { headers: authHeaders });
      const data = await res.json();
      if (data.sales) {
        setSales(data.sales.map((s: any) => ({ ...s, id: s.id || s._id })));
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/shop/suppliers', { headers: authHeaders });
      const data = await res.json();
      if (data.suppliers) {
        setSuppliers(data.suppliers.map((s: any) => ({ ...s, id: s.id || s._id })));
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  // Cart operations
  const addToCart = (product: ProductItem) => {
    const prodId = product.id || (product as any)._id;
    if (product.stock_quantity <= 0) {
      alert('This garment item is out of stock!');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === prodId);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert(`Cannot add more than available stock (${product.stock_quantity})!`);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === prodId
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: prodId,
          name: product.name,
          sku: product.sku,
          size: product.size,
          quantity: 1,
          unit_price: product.selling_price,
          total: product.selling_price,
        },
      ];
    });
  };

  const updateCartQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && qty > product.stock_quantity) {
      alert(`Only ${product.stock_quantity} units available in stock.`);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: qty, total: qty * item.unit_price }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please select garments to bill.');
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch('/api/shop/sales', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          customer_name: customerName || 'Walk-in Customer',
          customer_phone: customerPhone,
          items: cart,
          discount: discountAmount,
          tax: 0,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete sale');

      setLastInvoice(data.sale);
      setSuccessMessage(`Invoice #${data.sale.bill_number} generated successfully! Total: ₹${data.sale.total_amount}`);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountAmount(0);

      // Refresh inventory & sales
      fetchProducts();
      fetchSales();
    } catch (err: any) {
      alert(err.message || 'Error completing checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await fetch('/api/shop/products', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create product');

      setShowProductModal(false);
      fetchProducts();
      setProductForm({
        name: '',
        sku: '',
        category: categories[0]?.name || "Men's Wear",
        size: 'M',
        color: 'Navy Blue',
        fabric: 'Pure Cotton',
        cost_price: 500,
        selling_price: 1200,
        stock_quantity: 20,
        min_stock_alert: 5,
      });
      alert('Product created and saved to MongoDB!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await fetch('/api/shop/categories', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      setShowCategoryModal(false);
      fetchCategories();
      setCategoryForm({ name: '', code: '', description: '' });
      alert('Category added to MongoDB!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await fetch('/api/shop/suppliers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(supplierForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add supplier');

      setShowSupplierModal(false);
      fetchSuppliers();
      setSupplierForm({ name: '', company_name: '', phone: '', email: '', address: '', gst_number: '' });
      alert('Supplier saved to MongoDB!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockAdjustment = async () => {
    if (!selectedProductForStock) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/shop/products/${selectedProductForStock.id}/adjust-stock`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          adjustment: stockDelta,
          reason: stockReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');

      setShowAdjustStockModal(false);
      fetchProducts();
      alert(`Stock adjusted! New stock: ${data.product.stock_quantity}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name} from inventory?`)) return;
    try {
      const res = await fetch(`/api/shop/products/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.fabric.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.color.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesLowStock = !onlyLowStock || p.stock_quantity <= p.min_stock_alert;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            Garment Store Inventory &amp; POS Billing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Point of sale billing, garment stock management, fabric categories, suppliers, and retail invoices powered by MongoDB.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProductModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Garment
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition-all"
          >
            <Layers className="w-4 h-4" />
            New Category
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'pos' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Point of Sale (POS)
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'products' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          Garment Inventory ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Invoices &amp; Sales ({sales.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          Mills &amp; Suppliers ({suppliers.length})
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. POINT OF SALE (POS) TAB */}
      {/* ==================================================== */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Garments Catalog Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fabric, saree, shirt, SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Garments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock_quantity <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase">
                          {p.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : p.stock_quantity <= p.min_stock_alert
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : `${p.stock_quantity} in stock`}
                        </span>
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-900 mt-2 line-clamp-1">{p.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        SKU: <span className="font-mono text-slate-700">{p.sku}</span> • Size: {p.size}
                      </p>
                      <p className="text-[11px] text-slate-500">Fabric: {p.fabric} • Color: {p.color}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">₹{p.selling_price.toLocaleString()}</span>
                      <button
                        disabled={isOutOfStock}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        + Add to Bill
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POS Cart & Invoice Generation Column */}
          <div className="lg:col-span-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  Active Customer Invoice
                </h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-[11px] font-bold text-rose-600 hover:underline">
                    Clear Cart
                  </button>
                )}
              </div>

              {/* Customer Info Form */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Walk-in Customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98XXX XXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cart Items List */}
              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No garment items selected. Click on items on the left to add to bill.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-bold text-slate-800 block truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400">
                          ₹{item.unit_price} each • Size: {item.size}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                            className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                            className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-extrabold text-slate-900 w-16 text-right">₹{item.total}</span>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals & Payment Method */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Store Discount (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-right text-xs rounded-lg border border-slate-200 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Final Payable</span>
                  <span className="text-lg text-indigo-600">₹{finalTotal.toLocaleString()}</span>
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Payment Method</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['Cash', 'UPI', 'Card', 'Net Banking'] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          paymentMethod === method
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isLoading}
                  className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Receipt className="w-4 h-4" />
                  {isLoading ? 'Processing Sale...' : `Complete Sale & Print Bill (₹${finalTotal.toLocaleString()})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. PRODUCTS INVENTORY TAB */}
      {/* ==================================================== */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter garments by name/SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={onlyLowStock}
                  onChange={(e) => setOnlyLowStock(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Low Stock Alerts Only
              </label>
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">SKU / Code</th>
                  <th className="p-3.5">Garment Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Size / Fabric</th>
                  <th className="p-3.5">Cost Price</th>
                  <th className="p-3.5">Selling Price</th>
                  <th className="p-3.5">Current Stock</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-700">{p.sku}</td>
                    <td className="p-3.5 font-bold text-slate-900">{p.name}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {p.size} • {p.fabric}
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono">₹{p.cost_price}</td>
                    <td className="p-3.5 font-bold font-mono text-slate-900">₹{p.selling_price}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          p.stock_quantity <= p.min_stock_alert
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.stock_quantity <= p.min_stock_alert && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        {p.stock_quantity} units
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedProductForStock(p);
                          setStockDelta(0);
                          setShowAdjustStockModal(true);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                      >
                        Adjust Stock
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. CATEGORIES TAB */}
      {/* ==================================================== */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Garment Product Categories</h3>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      {c.code}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-2">{c.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{c.description || 'No description provided.'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. INVOICES & SALES HISTORY TAB */}
      {/* ==================================================== */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Retail Sales Transactions &amp; Receipts</h3>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">
              {sales.length} Invoices Recorded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Bill Number</th>
                  <th className="p-3.5">Date &amp; Time</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Garments Purchased</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-extrabold text-indigo-600">{s.bill_number}</td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {s.customer_name} {s.customer_phone ? `(${s.customer_phone})` : ''}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {s.items?.map((it) => `${it.name} (x${it.quantity})`).join(', ') || 'N/A'}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10px] text-slate-700">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-extrabold text-slate-900 font-mono text-sm">
                      ₹{s.total_amount?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. SUPPLIERS & MILLS TAB */}
      {/* ==================================================== */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Wholesale Garment Suppliers &amp; Mills</h3>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div key={sup.id || sup._id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                <span className="text-[10px] font-bold text-indigo-600 block">{sup.company_name}</span>
                <h4 className="text-sm font-extrabold text-slate-900">{sup.name}</h4>
                <p className="text-slate-600">Phone: {sup.phone}</p>
                {sup.email && <p className="text-slate-500">Email: {sup.email}</p>}
                {sup.gst_number && <p className="text-[10px] font-mono font-bold text-slate-700">GST: {sup.gst_number}</p>}
                {sup.address && <p className="text-[11px] text-slate-400 mt-1">{sup.address}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Add New Garment Product</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton Formal Shirt"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">SKU (optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Size</label>
                  <input
                    type="text"
                    value={productForm.size}
                    onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Color</label>
                  <input
                    type="text"
                    value={productForm.color}
                    onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Fabric</label>
                  <input
                    type="text"
                    value={productForm.fabric}
                    onChange={(e) => setProductForm({ ...productForm, fabric: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={productForm.selling_price}
                    onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Initial Stock Units</label>
                  <input
                    type="number"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={productForm.min_stock_alert}
                    onChange={(e) => setProductForm({ ...productForm, min_stock_alert: parseInt(e.target.value, 10) || 5 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Add Garment Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wedding Sherwanis"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Category Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHERWANI"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 uppercase"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock */}
      {showAdjustStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-2">Adjust Inventory Stock</h3>
            <p className="text-xs text-slate-500 mb-4">
              Item: <span className="font-bold text-slate-800">{selectedProductForStock.name}</span> (Current:{' '}
              {selectedProductForStock.stock_quantity})
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Quantity Adjustment (+/-)</label>
                <input
                  type="number"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. +10 or -5"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-sm"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Reason for Adjustment</label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                >
                  <option value="New Shipment Received">New Shipment Received</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Damaged / Fabric Defect">Damaged / Fabric Defect</option>
                  <option value="Inventory Audit Correction">Inventory Audit Correction</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAdjustStockModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStockAdjustment}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow"
                >
                  Apply Stock Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Add Wholesale Supplier / Mill</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Company / Mill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arvind Mills Ltd"
                  value={supplierForm.company_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Patel"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98..."
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">GST Number</label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={supplierForm.gst_number}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gst_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 uppercase"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="orders@mill.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Address / Market</label>
                <input
                  type="text"
                  placeholder="Ring Road Textile Market, Surat"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
