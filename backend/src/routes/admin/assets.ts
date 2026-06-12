import express from 'express';
import { isAdmin } from '../../middleware/isAdmin.js';
import { Asset } from '../../models/Asset.js';
import { PFP } from '../../models/PFP.js';

const router = express.Router();

// ========== ASSET MANAGEMENT ==========

// Approve an asset
router.patch('/:id/approve', isAdmin, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to approve asset' });
  }
});

// Soft-delete an asset (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Restore a soft-deleted asset
router.patch('/:id/restore', isAdmin, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, $unset: { deletedAt: 1 } },
      { new: true }
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore asset' });
  }
});

// Permanently delete an asset
router.delete('/:id/permanent', isAdmin, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    await asset.deleteOne();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to permanently delete asset' });
  }
});

// Batch soft-delete assets
router.post('/batch-delete', isAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
    await Asset.updateMany({ _id: { $in: ids } }, { isDeleted: true, deletedAt: new Date() });
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to batch delete assets' });
  }
});

// Batch restore assets
router.post('/batch-restore', isAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
    await Asset.updateMany({ _id: { $in: ids } }, { isDeleted: false, $unset: { deletedAt: 1 } });
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to batch restore assets' });
  }
});

// Stats
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const totalPFP = await PFP.countDocuments();
    const hiddenPFP = await PFP.countDocuments({ isHidden: true });
    const assetsByType = await Asset.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const pendingAssets = await Asset.countDocuments({ isApproved: false, isDeleted: { $ne: true } });
    const deletedAssets = await Asset.countDocuments({ isDeleted: true });

    res.json({
      totalPFP,
      hiddenPFP,
      assetsByType,
      pendingAssets,
      deletedAssets,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;