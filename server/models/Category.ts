import mongoose, { Schema, Model } from 'mongoose';

export interface ICategory {
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
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

export const Category: Model<ICategory> = mongoose.models.Category
  ? (mongoose.models.Category as Model<ICategory>)
  : mongoose.model<ICategory>('Category', CategorySchema);
