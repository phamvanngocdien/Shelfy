import mongoose, { Schema, Document } from 'mongoose';
import { PFP } from './PFP.js';

export interface ILike extends Document {
  pfpId: mongoose.Types.ObjectId;
  ipHash: string;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>({
  pfpId: { type: Schema.Types.ObjectId, ref: 'PFP', required: true },
  ipHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

likeSchema.index({ pfpId: 1, ipHash: 1 }, { unique: true });




// Update PFP likes array after save
likeSchema.post('save', async function (doc: ILike) {
  await PFP.findByIdAndUpdate(doc.pfpId, { $addToSet: { likes: doc.ipHash } });
});

// Update PFP likes array after delete
likeSchema.post('findOneAndDelete', async function (doc: ILike) {
  if (doc) {
    await PFP.findByIdAndUpdate(doc.pfpId, { $pull: { likes: doc.ipHash } });
  }
});

export const Like = mongoose.model<ILike>('Like', likeSchema);