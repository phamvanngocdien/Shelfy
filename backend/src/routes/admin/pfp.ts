import express from 'express';
import { isAdmin } from '../../middleware/isAdmin.js';
import { PFP } from '../../models/PFP.js';

const router = express.Router();

// GET /api/admin/pfp — list PFPs (filter: hidden/visible/all)
router.get('/', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
    const filter = req.query.filter as string;

    const query: any = {};
    if (filter === 'hidden') query.isHidden = true;
    else if (filter === 'visible') query.isHidden = { $ne: true };

    const total = await PFP.countDocuments(query);
    const pfps = await PFP.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const result = pfps.map(p => ({
      ...p.toObject(),
      imageUrl: `${process.env.SHELBY_GATEWAY}/${p.owner}/${p.blobName}`,
    }));

    res.json({
      pfps: result,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch PFPs' });
  }
});

// PATCH /api/admin/pfp/:id/hide — soft delete
router.patch('/:id/hide', isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const adminAddress = req.headers['x-wallet-address'] as string;

    const pfp = await PFP.findByIdAndUpdate(
      req.params.id,
      {
        isHidden: true,
        hiddenReason: reason || 'Violated content policy',
        hiddenBy: adminAddress,
      },
      { new: true }
    );
    if (!pfp) return res.status(404).json({ error: 'PFP not found' });
    res.json({ success: true, pfp });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to hide PFP' });
  }
});

// PATCH /api/admin/pfp/:id/unhide — restore
router.patch('/:id/unhide', isAdmin, async (req, res) => {
  try {
    const pfp = await PFP.findByIdAndUpdate(
      req.params.id,
      { isHidden: false, hiddenReason: '', hiddenBy: '' },
      { new: true }
    );
    if (!pfp) return res.status(404).json({ error: 'PFP not found' });
    res.json({ success: true, pfp });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unhide PFP' });
  }
});

// Batch hide PFPs
router.post('/batch-hide', isAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    const adminAddress = req.headers['x-wallet-address'] as string;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
    await PFP.updateMany({ _id: { $in: ids } }, { isHidden: true, hiddenReason: 'Batch hidden by admin', hiddenBy: adminAddress });
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to batch hide PFPs' });
  }
});

// Batch delete PFPs permanently
router.post('/batch-delete', isAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
    await PFP.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to batch delete PFPs' });
  }
});

export default router;
