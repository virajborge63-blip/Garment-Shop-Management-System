import { Router, Response } from 'express';
import {
  Category,
  Product,
  Customer,
  Supplier,
  Sale,
  logAudit,
} from '../db.ts';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict admin check to all shop management routes
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// 1. CATEGORIES MANAGEMENT
// ==========================================
router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.json({ categories });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

router.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Category name and code are required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await Category.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ error: 'A category with this code already exists.' });
    }

    const newCat = await Category.create({
      name: name.trim(),
      code: cleanCode,
      description: description || '',
      status: 'active',
      created_at: new Date(),
    });

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'CATEGORY_CREATED',
      `Category ${cleanCode} (${name})`,
      '',
      'Created garment product category'
    );

    return res.status(201).json({ success: true, category: newCat });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create category.' });
  }
});

router.put('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (name) cat.name = name.trim();
    if (description !== undefined) cat.description = description;
    if (status) cat.status = status;
    await cat.save();

    return res.json({ success: true, message: 'Category updated.', category: cat });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update category.' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cat = await Category.findByIdAndDelete(id);
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    return res.json({ success: true, message: 'Category removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// ==========================================
// 2. PRODUCTS & INVENTORY MANAGEMENT
// ==========================================
router.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    const { category, search, low_stock } = req.query;
    const filter: any = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search) {
      const s = String(search).trim();
      const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { sku: regex },
        { barcode: regex },
        { color: regex },
        { fabric: regex },
      ];
    }

    const products = await Product.find(filter).sort({ name: 1 });

    const filtered = low_stock === 'true'
      ? products.filter((p) => p.stock_quantity <= p.min_stock_alert)
      : products;

    return res.json({ products: filtered });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve products.' });
  }
});

router.post('/products', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, sku, category, size, color, fabric,
      cost_price, selling_price, stock_quantity, min_stock_alert, barcode
    } = req.body;

    if (!name || !category || selling_price === undefined) {
      return res.status(400).json({ error: 'Product name, category, and selling price are required.' });
    }

    // Auto-generate SKU if not provided
    let finalSku = (sku || '').trim().toUpperCase();
    if (!finalSku) {
      const count = await Product.countDocuments();
      finalSku = `GAR-${category.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, '0')}`;
    }

    const existing = await Product.findOne({ sku: finalSku });
    if (existing) {
      return res.status(400).json({ error: `A product with SKU ${finalSku} already exists.` });
    }

    const newProd = await Product.create({
      name: name.trim(),
      sku: finalSku,
      category: category.trim(),
      size: size || 'Free Size',
      color: color || 'Assorted',
      fabric: fabric || 'Cotton',
      cost_price: parseFloat(cost_price) || 0,
      selling_price: parseFloat(selling_price) || 0,
      stock_quantity: parseInt(stock_quantity, 10) || 0,
      min_stock_alert: parseInt(min_stock_alert, 10) || 5,
      barcode: barcode || '',
      status: 'active',
      created_at: new Date(),
    });

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PRODUCT_CREATED',
      `Product ${finalSku} (${name})`,
      '',
      `Category: ${category}, Stock: ${stock_quantity}, Price: ₹${selling_price}`
    );

    return res.status(201).json({ success: true, product: newProd });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return res.status(500).json({ error: 'Failed to create product.' });
  }
});

router.get('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const prod = await Product.findById(id);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    return res.json({ product: prod });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve product.' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const prod = await Product.findById(id);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (updateData.name) prod.name = updateData.name.trim();
    if (updateData.category) prod.category = updateData.category.trim();
    if (updateData.size) prod.size = updateData.size;
    if (updateData.color) prod.color = updateData.color;
    if (updateData.fabric) prod.fabric = updateData.fabric;
    if (updateData.cost_price !== undefined) prod.cost_price = parseFloat(updateData.cost_price);
    if (updateData.selling_price !== undefined) prod.selling_price = parseFloat(updateData.selling_price);
    if (updateData.stock_quantity !== undefined) prod.stock_quantity = parseInt(updateData.stock_quantity, 10);
    if (updateData.min_stock_alert !== undefined) prod.min_stock_alert = parseInt(updateData.min_stock_alert, 10);
    if (updateData.barcode !== undefined) prod.barcode = updateData.barcode;
    if (updateData.status) prod.status = updateData.status;

    await prod.save();

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PRODUCT_UPDATED',
      `Product ${prod.sku} (${prod.name})`,
      '',
      `Stock: ${prod.stock_quantity}, Price: ₹${prod.selling_price}`
    );

    return res.json({ success: true, message: 'Product updated successfully.', product: prod });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update product.' });
  }
});

router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const prod = await Product.findByIdAndDelete(id);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PRODUCT_DELETED',
      `Product ${prod.sku} (${prod.name})`,
      '',
      'Deleted product from inventory'
    );

    return res.json({ success: true, message: 'Product removed from inventory.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// Stock Adjustment
router.post('/products/:id/adjust-stock', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;
    const delta = parseInt(adjustment, 10);

    if (isNaN(delta)) {
      return res.status(400).json({ error: 'Valid adjustment number is required.' });
    }

    const prod = await Product.findById(id);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const oldStock = prod.stock_quantity;
    prod.stock_quantity = Math.max(0, oldStock + delta);
    await prod.save();

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'STOCK_ADJUSTMENT',
      `Product ${prod.sku} (${prod.name})`,
      `Stock: ${oldStock}`,
      `Stock: ${prod.stock_quantity} (Reason: ${reason || 'Manual adjustment'})`
    );

    return res.json({
      success: true,
      message: `Stock updated from ${oldStock} to ${prod.stock_quantity}.`,
      product: prod,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to adjust stock.' });
  }
});

// ==========================================
// 3. CUSTOMERS & SUPPLIERS
// ==========================================
router.get('/customers', async (req: AuthRequest, res: Response) => {
  try {
    const customers = await Customer.find().sort({ created_at: -1 });
    return res.json({ customers });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve customers.' });
  }
});

router.post('/customers', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const cleanPhone = phone.trim();
    let customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
      customer.name = name.trim();
      if (email) customer.email = email.trim();
      if (address) customer.address = address.trim();
      await customer.save();
    } else {
      customer = await Customer.create({
        name: name.trim(),
        phone: cleanPhone,
        email: (email || '').trim(),
        address: (address || '').trim(),
        total_purchases: 0,
        created_at: new Date(),
      });
    }

    return res.status(201).json({ success: true, customer });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save customer.' });
  }
});

router.get('/suppliers', async (req: AuthRequest, res: Response) => {
  try {
    const suppliers = await Supplier.find().sort({ company_name: 1 });
    return res.json({ suppliers });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve suppliers.' });
  }
});

router.post('/suppliers', async (req: AuthRequest, res: Response) => {
  try {
    const { name, company_name, phone, email, address, gst_number } = req.body;
    if (!name || !company_name || !phone) {
      return res.status(400).json({ error: 'Contact name, company name, and phone are required.' });
    }

    const sup = await Supplier.create({
      name: name.trim(),
      company_name: company_name.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      address: (address || '').trim(),
      gst_number: (gst_number || '').trim().toUpperCase(),
      created_at: new Date(),
    });

    return res.status(201).json({ success: true, supplier: sup });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create supplier.' });
  }
});

// ==========================================
// 4. POINT OF SALE (POS) & BILLING INVOICES
// ==========================================
router.get('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const sales = await Sale.find().sort({ date: -1 }).limit(100);
    return res.json({ sales });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve sales records.' });
  }
});

router.post('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const {
      customer_name, customer_phone, items,
      discount, tax, payment_method, cashier_name
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required to generate a bill.' });
    }

    // Step 1: Server-side validation of items, stock levels, and authorized prices
    let subtotal = 0;
    const validatedItems: Array<{
      product_id: string;
      name: string;
      sku: string;
      size: string;
      quantity: number;
      unit_price: number;
      total: number;
    }> = [];

    for (const item of items) {
      const qty = parseInt(String(item.quantity), 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          error: `Invalid quantity for item "${item.name || 'Item'}". Quantity must be a positive integer greater than zero.`
        });
      }

      if (item.product_id) {
        const prod = await Product.findById(item.product_id);
        if (!prod) {
          return res.status(400).json({ error: `Product with ID ${item.product_id} was not found in store catalog.` });
        }

        if (prod.status === 'discontinued') {
          return res.status(400).json({ error: `Product "${prod.name}" (${prod.sku}) has been discontinued and cannot be sold.` });
        }

        if (prod.stock_quantity < qty) {
          return res.status(400).json({
            error: `Insufficient stock for "${prod.name}" (${prod.sku}). Available stock: ${prod.stock_quantity}, requested: ${qty}.`
          });
        }

        // Server is the single source of truth for retail price
        const verifiedPrice = prod.selling_price;
        const itemTotal = qty * verifiedPrice;
        subtotal += itemTotal;

        validatedItems.push({
          product_id: prod._id.toString(),
          name: prod.name,
          sku: prod.sku,
          size: prod.size || item.size || 'Free Size',
          quantity: qty,
          unit_price: verifiedPrice,
          total: itemTotal,
        });
      } else {
        // Fallback for custom / miscellaneous walk-in items without barcode/SKU
        const customPrice = Math.max(0, parseFloat(item.unit_price) || 0);
        const itemTotal = qty * customPrice;
        subtotal += itemTotal;

        validatedItems.push({
          product_id: '',
          name: (item.name || 'Garment Item').trim(),
          sku: 'MISC-ITEM',
          size: item.size || 'Free Size',
          quantity: qty,
          unit_price: customPrice,
          total: itemTotal,
        });
      }
    }

    // Step 2: Atomically decrement stock for validated catalog products
    for (const item of validatedItems) {
      if (item.product_id) {
        await Product.findOneAndUpdate(
          { _id: item.product_id, stock_quantity: { $gte: item.quantity } },
          { $inc: { stock_quantity: -item.quantity } }
        );
      }
    }

    // Step 3: Validate discount and taxes
    const rawDiscount = parseFloat(discount) || 0;
    const disc = Math.min(Math.max(0, rawDiscount), subtotal); // Discount cannot exceed subtotal
    const taxAmt = Math.max(0, parseFloat(tax) || 0);
    const totalAmount = Math.max(0, Math.round((subtotal - disc + taxAmt) * 100) / 100);
    const cashier = cashier_name || req.user!.name || req.user!.username || 'Billing Desk';

    // Step 4: Generate unique Bill Number: INV-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await Sale.countDocuments({
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const billNumber = `INV-${todayStr}-${String(countToday + 1).padStart(4, '0')}`;

    const sale = await Sale.create({
      bill_number: billNumber,
      customer_name: customer_name ? customer_name.trim() : 'Walk-in Customer',
      customer_phone: customer_phone ? customer_phone.trim() : '',
      items: validatedItems,
      subtotal,
      discount: disc,
      tax: taxAmt,
      total_amount: totalAmount,
      payment_method: payment_method || 'Cash',
      cashier_name: cashier,
      status: 'Completed',
      date: new Date(),
    });

    // Update customer total purchases if phone is provided
    if (customer_phone && customer_phone.trim()) {
      await Customer.findOneAndUpdate(
        { phone: customer_phone.trim() },
        {
          $inc: { total_purchases: totalAmount },
          $setOnInsert: { name: customer_name || 'Walk-in Customer', created_at: new Date() },
        },
        { upsert: true }
      );
    }

    await logAudit(
      req.user!.username,
      cashier,
      'BILL_GENERATED',
      `Bill #${billNumber}`,
      '',
      `Total: ₹${totalAmount} (${payment_method || 'Cash'}) to ${customer_name || 'Walk-in Customer'}`
    );

    return res.status(201).json({
      success: true,
      message: `Invoice #${billNumber} generated successfully.`,
      sale,
    });
  } catch (err: any) {
    console.error('POS billing error:', err);
    return res.status(500).json({ error: 'Failed to process sale invoice.' });
  }
});

// ==========================================
// 5. STORE & INVENTORY REPORTS
// ==========================================
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find();
    let totalStockItems = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let lowStockCount = 0;

    for (const p of products) {
      totalStockItems += p.stock_quantity;
      totalCostValuation += p.stock_quantity * p.cost_price;
      totalRetailValuation += p.stock_quantity * p.selling_price;
      if (p.stock_quantity <= p.min_stock_alert) {
        lowStockCount++;
      }
    }

    // Sales totals
    const sales = await Sale.find();
    let totalRevenue = 0;
    for (const s of sales) {
      if (s.status === 'Completed') {
        totalRevenue += s.total_amount;
      }
    }

    const categories = await Category.find();

    return res.json({
      summary: {
        totalProducts: products.length,
        totalCategories: categories.length,
        totalStockUnits: totalStockItems,
        totalCostValuation: Math.round(totalCostValuation),
        totalRetailValuation: Math.round(totalRetailValuation),
        projectedGrossMargin: Math.round(totalRetailValuation - totalCostValuation),
        lowStockAlerts: lowStockCount,
        totalInvoicesIssued: sales.length,
        totalSalesRevenue: Math.round(totalRevenue),
      },
      lowStockProducts: products
        .filter((p) => p.stock_quantity <= p.min_stock_alert)
        .map((p) => ({
          id: p._id.toString(),
          name: p.name,
          sku: p.sku,
          category: p.category,
          stock_quantity: p.stock_quantity,
          min_stock_alert: p.min_stock_alert,
          selling_price: p.selling_price,
        })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate store reports.' });
  }
});

export default router;
