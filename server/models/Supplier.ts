import mongoose, { Schema, Model } from 'mongoose';

export interface ISupplier {
  name: string;
  company_name: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  created_at: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    company_name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    address: { type: String, default: '' },
    gst_number: { type: String, default: '', uppercase: true, trim: true },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Supplier: Model<ISupplier> = mongoose.models.Supplier
  ? (mongoose.models.Supplier as Model<ISupplier>)
  : mongoose.model<ISupplier>('Supplier', SupplierSchema);
