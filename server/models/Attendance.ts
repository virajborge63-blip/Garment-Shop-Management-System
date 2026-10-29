import mongoose, { Schema, Model } from 'mongoose';

export interface IAttendance {
  employee_id: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Leave' | 'Half Day';
  working_hours: number;
  overtime_hours: number;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employee_id: { type: String, required: true, uppercase: true, trim: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Half Day'], required: true },
    working_hours: { type: Number, default: 8 },
    overtime_hours: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    created_by: { type: String, default: '' },
    updated_by: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
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

AttendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });

export const Attendance: Model<IAttendance> = mongoose.models.Attendance
  ? (mongoose.models.Attendance as Model<IAttendance>)
  : mongoose.model<IAttendance>('Attendance', AttendanceSchema);
