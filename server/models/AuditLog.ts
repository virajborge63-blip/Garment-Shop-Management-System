import mongoose, { Schema, Model } from 'mongoose';

export interface IAuditLog {
  admin_id: string;
  admin_name: string;
  action: string;
  record_affected: string;
  previous_value?: string;
  new_value?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    admin_id: { type: String, required: true },
    admin_name: { type: String, required: true },
    action: { type: String, required: true },
    record_affected: { type: String, required: true },
    previous_value: { type: String, default: '' },
    new_value: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog
  ? (mongoose.models.AuditLog as Model<IAuditLog>)
  : mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
