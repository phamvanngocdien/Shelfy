import express from 'express';
import { Asset } from '../models/Asset.js';

const router = express.Router();

// GET /api/assets?type=frame|sticker&approved=true&deleted=true&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const { type, approved, deleted, page: p, limit: l } = req.query;
    const filter: any = {};
    if (type) filter.type = type;
    if (approved !== undefined) filter.isApproved = approved === 'true';

    // By default, exclude deleted assets unless explicitly requested
    if (deleted === 'true') {
      filter.isDeleted = true;
    } else if (deleted === 'false' || deleted === undefined) {
      filter.isDeleted = { $ne: true };
    }

    const page = parseInt(p as string) || 1;
    const limit = Math.min(parseInt(l as string) || 50, 100);
    const total = await Asset.countDocuments(filter);
    const assets = await Asset.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      assets,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

export default router;