import mongoose, { Schema, Model } from 'mongoose';

export interface IPayroll {
  employee_id: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  half_days: number;
  overtime_hours: number;
  extra_working_days: number;
  per_day_salary: number;
  basic_salary: number;
  extra_day_salary: number;
  overtime_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  status: 'Draft' | 'Finalized' | 'Paid';
  generated_by?: string;
  created_at: Date;
}

const PayrollSchema = new Schema<IPayroll>(
  {
    employee_id: { type: String, required: true, uppercase: true, trim: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    working_days: { type: Number, default: 26 },
    present_days: { type: Number, default: 0 },
    absent_days: { type: Number, default: 0 },
    leave_days: { type: Number, default: 0 },
    half_days: { type: Number, default: 0 },
    overtime_hours: { type: Number, default: 0 },
    extra_working_days: { type: Number, default: 0 },
    per_day_salary: { type: Number, required: true },
    basic_salary: { type: Number, required: true },
    extra_day_salary: { type: Number, default: 0 },
    overtime_salary: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    net_salary: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Finalized', 'Paid'], default: 'Finalized' },
    generated_by: { type: String, default: 'System' },
    created_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

PayrollSchema.index({ employee_id: 1, month: 1, year: 1 }, { unique: true });

export const Payroll: Model<IPayroll> = mongoose.models.Payroll
  ? (mongoose.models.Payroll as Model<IPayroll>)
  : mongoose.model<IPayroll>('Payroll', PayrollSchema);
