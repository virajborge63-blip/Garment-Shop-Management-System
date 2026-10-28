import mongoose, { Schema, Model } from 'mongoose';

export interface IEmployee {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  department: string;
  designation: string;
  joining_date: string;
  per_day_salary: number;
  monthly_salary: number;
  overtime_rate: number;
  status: 'active' | 'inactive';
  avatar_url?: string;
  created_at: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employee_id: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: { type: String, default: '' },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    joining_date: { type: String, required: true },
    per_day_salary: { type: Number, required: true, default: 800 },
    monthly_salary: { type: Number, required: true, default: 20800 },
    overtime_rate: { type: Number, required: true, default: 150 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    avatar_url: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Employee: Model<IEmployee> = mongoose.models.Employee
  ? (mongoose.models.Employee as Model<IEmployee>)
  : mongoose.model<IEmployee>('Employee', EmployeeSchema);
