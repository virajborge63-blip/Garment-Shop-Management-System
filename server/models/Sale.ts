import mongoose, { Schema, Model } from 'mongoose';

export interface ISaleItem {
  product_id?: string;
  name: string;
  sku: string;
  size?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ISale {
  bill_number: string;
  customer_name: string;
  customer_phone?: string;
  items: ISaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: 'Cash' | 'UPI' | 'Card' | 'Net Banking';
  cashier_name: string;
  status: 'Completed' | 'Refunded' | 'Cancelled';
  date: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    product_id: { type: String, default: '' },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, default: 'Free Size' },
    quantity: { type: Number, required: true, default: 1 },
    unit_price: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    bill_number: { type: String, required: true, unique: true, uppercase: true },
    customer_name: { type: String, default: 'Walk-in Customer', trim: true },
    customer_phone: { type: String, default: '' },
    items: [SaleItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, default: 0 },
    payment_method: { type: String, enum: ['Cash', 'UPI', 'Card', 'Net Banking'], default: 'Cash' },
    cashier_name: { type: String, default: 'Store Billing' },
    status: { type: String, enum: ['Completed', 'Refunded', 'Cancelled'], default: 'Completed' },
    date: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Sale: Model<ISale> = mongoose.models.Sale
  ? (mongoose.models.Sale as Model<ISale>)
  : mongoose.model<ISale>('Sale', SaleSchema);
