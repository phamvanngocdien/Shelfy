import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  name: string;
  type: 'frame' | 'sticker';
  shelbyBlobName: string;
  ownerAddress: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number;
  defaultY: number;
  uploadedBy?: string;
  isApproved: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true, index: true },
    type: { type: String, enum: ['frame', 'sticker'], required: true, index: true },
    shelbyBlobName: { type: String, required: true },
    ownerAddress: { type: String, required: true },
    defaultWidth: { type: Number, default: 100, min: 0 },
    defaultHeight: { type: Number, default: 100, min: 0 },
    defaultX: { type: Number, default: 0, min: 0 },
    defaultY: { type: Number, default: 0, min: 0 },
    uploadedBy: { type: String },
    isApproved: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);