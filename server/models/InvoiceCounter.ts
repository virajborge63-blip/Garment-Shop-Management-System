import mongoose, { Schema, Model } from 'mongoose';

export interface IInvoiceCounter {
  key: string;
  value: number;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: false, versionKey: false }
);

export const InvoiceCounter: Model<IInvoiceCounter> = mongoose.models.InvoiceCounter
  ? (mongoose.models.InvoiceCounter as Model<IInvoiceCounter>)
  : mongoose.model<IInvoiceCounter>('InvoiceCounter', InvoiceCounterSchema);
