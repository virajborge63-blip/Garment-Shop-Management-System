import { Router, Response } from 'express';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import {
  Category,
  Product,
  Customer,
  Supplier,
  Sale,
  InvoiceCounter,
  logAuditBestEffort,
} from '../db.ts';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth.ts';
import { getBusinessDate } from '../../shared/businessDate.ts';

const router = Router();

class SaleRequestError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function getIdempotencyHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

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

    await logAuditBestEffort(
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

    await logAuditBestEffort(
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

    await logAuditBestEffort(
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

    await logAuditBestEffort(
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

    await logAuditBestEffort(
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
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object.' });
    }

    const {
      customer_name, customer_phone, items,
      discount, tax, payment_method, cashier_name
    } = req.body;
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required to generate a bill.' });
    }

    const idempotencyHash = getIdempotencyHash({
      customer_name,
      customer_phone,
      items,
      discount,
      tax,
      payment_method,
    });

    await Promise.all([Sale.init(), InvoiceCounter.init()]);
    const existingSale = await Sale.findOne({ idempotency_key: idempotencyKey });
    if (existingSale) {
      if (existingSale.idempotency_hash !== idempotencyHash) {
        return res.status(409).json({ error: 'Idempotency key was already used for a different sale.' });
      }
      return res.status(201).json({
        success: true,
        message: `Invoice #${existingSale.bill_number} generated successfully.`,
        sale: existingSale,
      });
    }

    if (customer_name !== undefined && typeof customer_name !== 'string') {
      return res.status(400).json({ error: 'Customer name must be a string.' });
    }
    if (customer_phone !== undefined && typeof customer_phone !== 'string') {
      return res.status(400).json({ error: 'Customer phone must be a string.' });
    }
    const customerName = customer_name?.trim() || 'Walk-in Customer';
    const customerPhone = customer_phone?.trim() || '';
    const paymentMethods = ['Cash', 'UPI', 'Card', 'Net Banking'];
    const paymentMethod = payment_method === undefined ? 'Cash' : payment_method;
    if (typeof paymentMethod !== 'string' || !paymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Payment method is invalid.' });
    }

    const mergedItems = new Map<string, {
      product_id: string;
      name: string;
      size: string;
      quantity: number;
      unit_price: number;
    }>();
    for (const value of items as unknown[]) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return res.status(400).json({ error: 'Each sale item must be an object.' });
      }
      const item = value as Record<string, unknown>;
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Sale item quantities must be positive integers.' });
      }
      if (item.product_id !== undefined && item.product_id !== null && typeof item.product_id !== 'string') {
        return res.status(400).json({ error: 'Product IDs must be strings.' });
      }

      const productId = typeof item.product_id === 'string' ? item.product_id.trim() : '';
      if (productId && !/^[a-f0-9]{24}$/i.test(productId)) {
        return res.status(400).json({ error: 'Product ID is invalid.' });
      }
      const name = typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : 'Garment Item';
      const size = typeof item.size === 'string' && item.size.trim()
        ? item.size.trim()
        : 'Free Size';
      const unitPrice = item.unit_price === undefined ? 0 : Number(item.unit_price);
      if (!productId && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
        return res.status(400).json({ error: 'Custom item prices must be finite and non-negative.' });
      }

      const key = productId
        ? `product:${productId.toLowerCase()}`
        : `custom:${name.toLowerCase()}:${size.toLowerCase()}:${unitPrice}`;
      const existing = mergedItems.get(key);
      const combinedQuantity = (existing?.quantity || 0) + quantity;
      if (!Number.isSafeInteger(combinedQuantity)) {
        return res.status(400).json({ error: 'Combined sale quantity is too large.' });
      }
      mergedItems.set(key, {
        product_id: productId,
        name,
        size,
        quantity: combinedQuantity,
        unit_price: unitPrice,
      });
    }

    const rawDiscount = discount === undefined ? 0 : Number(discount);
    const taxAmount = tax === undefined ? 0 : Number(tax);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0 || !Number.isFinite(taxAmount) || taxAmount < 0) {
      return res.status(400).json({ error: 'Discount and tax must be finite non-negative amounts.' });
    }

    const today = new Date();
    const dateKey = getBusinessDate(today);
    const invoicePrefix = `INV-${dateKey.replace(/-/g, '')}-`;
    const oldInvoices = await Sale.find({ bill_number: new RegExp(`^${invoicePrefix}`) })
      .select({ bill_number: 1 })
      .lean();
    const initialSequence = oldInvoices.reduce((max, sale) => {
      const sequence = Number(sale.bill_number.slice(invoicePrefix.length));
      return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    try {
      await InvoiceCounter.updateOne(
        { key: dateKey },
        { $max: { value: initialSequence }, $setOnInsert: { key: dateKey } },
        { upsert: true }
      );
    } catch (error) {
      if (!isDuplicateKeyError(error) || !(await InvoiceCounter.exists({ key: dateKey }))) {
        throw error;
      }
    }

    const session = await Sale.startSession();
    let sale: InstanceType<typeof Sale> | null = null;
    const cashier = cashier_name || req.user!.name || req.user!.username || 'Billing Desk';
    try {
      await session.withTransaction(async () => {
        let subtotal = 0;
        const validatedItems = [];

        for (const item of mergedItems.values()) {
          if (item.product_id) {
            const product = await Product.findById(item.product_id).session(session);
            if (!product) {
              throw new SaleRequestError(`Product with ID ${item.product_id} was not found in store catalog.`);
            }
            if (product.status === 'discontinued') {
              throw new SaleRequestError(`Product "${product.name}" (${product.sku}) has been discontinued and cannot be sold.`);
            }
            const updatedProduct = await Product.findOneAndUpdate(
              { _id: product._id, status: { $ne: 'discontinued' }, stock_quantity: { $gte: item.quantity } },
              { $inc: { stock_quantity: -item.quantity } },
              { session, returnDocument: 'after' }
            );
            if (!updatedProduct) {
              throw new SaleRequestError(
                `Insufficient stock for "${product.name}" (${product.sku}). Requested: ${item.quantity}.`
              );
            }

            const verifiedPrice = product.selling_price;
            const itemTotal = item.quantity * verifiedPrice;
            subtotal += itemTotal;
            validatedItems.push({
              product_id: product._id.toString(),
              name: product.name,
              sku: product.sku,
              size: product.size || item.size,
              quantity: item.quantity,
              unit_price: verifiedPrice,
              total: itemTotal,
            });
          } else {
            const itemTotal = item.quantity * item.unit_price;
            subtotal += itemTotal;
            validatedItems.push({
              product_id: '',
              name: item.name,
              sku: 'MISC-ITEM',
              size: item.size,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: itemTotal,
            });
          }
        }

        const appliedDiscount = Math.min(rawDiscount, subtotal);
        const totalAmount = Math.max(0, Math.round((subtotal - appliedDiscount + taxAmount) * 100) / 100);
        const counter = await InvoiceCounter.findOneAndUpdate(
          { key: dateKey },
          { $inc: { value: 1 } },
          { session, returnDocument: 'after', runValidators: true }
        );
        if (!counter) {
          throw new Error('Invoice sequence counter was not available.');
        }
        const billNumber = `${invoicePrefix}${String(counter.value).padStart(4, '0')}`;

        sale = new Sale({
          bill_number: billNumber,
          idempotency_key: idempotencyKey,
          idempotency_hash: idempotencyHash,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: validatedItems,
          subtotal,
          discount: appliedDiscount,
          tax: taxAmount,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          cashier_name: cashier,
          status: 'Completed',
          date: today,
        });
        await sale.save({ session });

        if (customerPhone) {
          await Customer.findOneAndUpdate(
            { phone: customerPhone },
            {
              $inc: { total_purchases: totalAmount },
              $setOnInsert: { name: customerName, created_at: new Date() },
            },
            { upsert: true, session, returnDocument: 'after', runValidators: true }
          );
        }
      });
    } catch (error) {
      if (error instanceof SaleRequestError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (isDuplicateKeyError(error)) {
        const duplicateSale = await Sale.findOne({ idempotency_key: idempotencyKey });
        if (duplicateSale) {
          if (duplicateSale.idempotency_hash !== idempotencyHash) {
            return res.status(409).json({ error: 'Idempotency key was already used for a different sale.' });
          }
          return res.status(201).json({
            success: true,
            message: `Invoice #${duplicateSale.bill_number} generated successfully.`,
            sale: duplicateSale,
          });
        }
        return res.status(409).json({ error: 'Invoice sequence conflict. Retry the sale with the same idempotency key.' });
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!sale) {
      throw new Error('Sale transaction completed without creating an invoice.');
    }

    await logAuditBestEffort(
      req.user!.username,
      cashier,
      'BILL_GENERATED',
      `Bill #${sale.bill_number}`,
      '',
      `Total: ₹${sale.total_amount} (${paymentMethod}) to ${customerName}`
    );

    return res.status(201).json({
      success: true,
      message: `Invoice #${sale.bill_number} generated successfully.`,
      sale,
    });
  } catch (err: any) {
    if (err instanceof SaleRequestError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('POS billing error:', err);
    return res.status(500).json({ error: 'Failed to process sale invoice.' });
  }
});

// ==========================================
// 5. STORE & INVENTORY REPORTS
// ==========================================
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const [productReport, salesReport, totalCategories] = await Promise.all([
      Product.aggregate<{
        summary: Array<{
          totalProducts: number;
          totalStockUnits: number;
          totalCostValuation: number;
          totalRetailValuation: number;
          lowStockAlerts: number;
        }>;
        lowStockProducts: Array<{
          _id: Types.ObjectId;
          name: string;
          sku: string;
          category: string;
          stock_quantity: number;
          min_stock_alert: number;
          selling_price: number;
        }>;
      }>([
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $sum: 1 },
                  totalStockUnits: { $sum: '$stock_quantity' },
                  totalCostValuation: {
                    $sum: { $multiply: ['$stock_quantity', '$cost_price'] },
                  },
                  totalRetailValuation: {
                    $sum: { $multiply: ['$stock_quantity', '$selling_price'] },
                  },
                  lowStockAlerts: {
                    $sum: {
                      $cond: [{ $lte: ['$stock_quantity', '$min_stock_alert'] }, 1, 0],
                    },
                  },
                },
              },
              { $project: { _id: 0 } },
            ],
            lowStockProducts: [
              { $match: { $expr: { $lte: ['$stock_quantity', '$min_stock_alert'] } } },
              {
                $project: {
                  name: 1,
                  sku: 1,
                  category: 1,
                  stock_quantity: 1,
                  min_stock_alert: 1,
                  selling_price: 1,
                },
              },
            ],
          },
        },
      ]),
      Sale.aggregate<{
        _id: null;
        totalInvoicesIssued: number;
        totalSalesRevenue: number;
      }>([
        {
          $group: {
            _id: null,
            totalInvoicesIssued: { $sum: 1 },
            totalSalesRevenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Completed'] }, '$total_amount', 0],
              },
            },
          },
        },
      ]),
      Category.countDocuments(),
    ]);

    const productTotals = productReport[0]?.summary[0];
    const salesTotals = salesReport[0];
    const totalStockItems = productTotals?.totalStockUnits || 0;
    const totalCostValuation = productTotals?.totalCostValuation || 0;
    const totalRetailValuation = productTotals?.totalRetailValuation || 0;

    return res.json({
      summary: {
        totalProducts: productTotals?.totalProducts || 0,
        totalCategories,
        totalStockUnits: totalStockItems,
        totalCostValuation: Math.round(totalCostValuation),
        totalRetailValuation: Math.round(totalRetailValuation),
        projectedGrossMargin: Math.round(totalRetailValuation - totalCostValuation),
        lowStockAlerts: productTotals?.lowStockAlerts || 0,
        totalInvoicesIssued: salesTotals?.totalInvoicesIssued || 0,
        totalSalesRevenue: Math.round(salesTotals?.totalSalesRevenue || 0),
      },
      lowStockProducts: (productReport[0]?.lowStockProducts || []).map((product) => ({
        id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        category: product.category,
        stock_quantity: product.stock_quantity,
        min_stock_alert: product.min_stock_alert,
        selling_price: product.selling_price,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate store reports.' });
  }
});

export default router;
