import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
  username: string;
  email: string;
  password_hash: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
  employee_id: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'], required: true },
    employee_id: { type: String, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const User: Model<IUser> = mongoose.models.User
  ? (mongoose.models.User as Model<IUser>)
  : mongoose.model<IUser>('User', UserSchema);
