import mongoose, { Schema, Model } from 'mongoose';

export interface ICustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  total_purchases: number;
  created_at: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    address: { type: String, default: '' },
    total_purchases: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret._id) ret.id = ret._id.toString();
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret._id) ret.id = ret._id.toString();
        return ret;
      },
    },
  }
);

export const Customer: Model<ICustomer> = mongoose.models.Customer
  ? (mongoose.models.Customer as Model<ICustomer>)
  : mongoose.model<ICustomer>('Customer', CustomerSchema);
