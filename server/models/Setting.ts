import mongoose, { Schema, Model } from 'mongoose';

export interface ISetting {
  key: string;
  value: string;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Setting: Model<ISetting> = mongoose.models.Setting
  ? (mongoose.models.Setting as Model<ISetting>)
  : mongoose.model<ISetting>('Setting', SettingSchema);
