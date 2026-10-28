import mongoose, { Schema, Model } from 'mongoose';

export interface ISession {
  token: string;
  user_id: string;
  role: string;
  employee_id: string | null;
  created_at: Date;
  expires_at: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    token: { type: String, required: true, unique: true },
    user_id: { type: String, required: true, index: true },
    role: { type: String, required: true },
    employee_id: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Session: Model<ISession> = mongoose.models.Session
  ? (mongoose.models.Session as Model<ISession>)
  : mongoose.model<ISession>('Session', SessionSchema);
