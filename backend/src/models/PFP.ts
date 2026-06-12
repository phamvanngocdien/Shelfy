import mongoose, { Schema, Document } from 'mongoose';

export interface IPFP extends Document {
  username: string;
  discord: string;
  blobName: string;
  owner: string;
  isHidden: boolean;
  hiddenReason?: string;
  hiddenBy?: string;
  assets: Array<{
    assetId: mongoose.Types.ObjectId;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const pfpSchema = new Schema<IPFP>(
  {
    username: { type: String, required: true, maxlength: 50, index: 'text' },
    discord: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^[a-z0-9._]{2,32}$/.test(v),
        message: 'Invalid Discord handle',
      },
    },
    blobName: { type: String, required: true, unique: true },
    owner: { type: String, required: true, index: true },
    isHidden: { type: Boolean, default: false, index: true },
    hiddenReason: { type: String, default: '' },
    hiddenBy: { type: String, default: '' },
    assets: [
      {
        assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      }
    ],
  },
  { timestamps: true }
);

export const PFP = mongoose.model<IPFP>('PFP', pfpSchema);
