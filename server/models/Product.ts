import mongoose, { Schema, Model } from 'mongoose';

export interface IProduct {
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
  barcode?: string;
  status: 'active' | 'discontinued';
  created_at: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, required: true, trim: true },
    size: { type: String, default: 'Free Size', trim: true },
    color: { type: String, default: 'Assorted', trim: true },
    fabric: { type: String, default: 'Cotton', trim: true },
    cost_price: { type: Number, required: true, default: 0 },
    selling_price: { type: Number, required: true, default: 0 },
    stock_quantity: { type: Number, required: true, default: 0 },
    min_stock_alert: { type: Number, default: 5 },
    barcode: { type: String, default: '' },
    status: { type: String, enum: ['active', 'discontinued'], default: 'active' },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Product: Model<IProduct> = mongoose.models.Product
  ? (mongoose.models.Product as Model<IProduct>)
  : mongoose.model<IProduct>('Product', ProductSchema);
