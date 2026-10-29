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

// TTL index to automatically purge expired sessions from MongoDB
SessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> = mongoose.models.Session
  ? (mongoose.models.Session as Model<ISession>)
  : mongoose.model<ISession>('Session', SessionSchema);
