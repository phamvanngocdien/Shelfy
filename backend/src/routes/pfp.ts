import express, { Request, Response } from 'express';
import { PFP } from '../models/PFP.js';
import { body, validationResult } from 'express-validator';
import { checkBlobExists } from '../services/shelby.js';
import { createRequestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// POST /api/pfp
router.post(
  '/',
  createRequestLimiter,
  [
    body('username').trim().isLength({ min: 1, max: 50 }).withMessage('Username is required (max 50 chars)'),
    body('discord').matches(/^[a-z0-9._]{2,32}$/).withMessage('Invalid Discord handle'),
    body('blobName').isString().notEmpty().isLength({ max: 200 }).withMessage('Blob name is required'),
    body('owner').isString().notEmpty().matches(/^0x[a-fA-F0-9]{1,64}$/).withMessage('Valid Aptos address is required'),
    body('assets').isArray({ max: 20 }).withMessage('Maximum 20 assets allowed'),
    body('assets.*.assetId').isString().notEmpty().isLength({ max: 100 }).withMessage('Asset ID is required'),
    body('assets.*.x').isFloat({ min: -500, max: 1000 }).withMessage('Asset x must be between -500 and 1000'),
    body('assets.*.y').isFloat({ min: -500, max: 1000 }).withMessage('Asset y must be between -500 and 1000'),
    body('assets.*.width').isFloat({ min: 1, max: 2000 }).withMessage('Asset width must be between 1 and 2000'),
    body('assets.*.height').isFloat({ min: 1, max: 2000 }).withMessage('Asset height must be between 1 and 2000'),
  ],
  async (req: Request, res: Response) => { 
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, discord, blobName, owner, assets } = req.body;

      const exists = await checkBlobExists(owner, blobName);
      if (!exists) {
        return res.status(400).json({ error: 'Blob does not exist on Shelby network' });
      }

      const existing = await PFP.findOne({ blobName });
      if (existing) {
        return res.status(400).json({ error: 'Blob already registered' });
      }

      const pfp = new PFP({
        username,
        discord: discord.toLowerCase(),
        blobName,
        owner,
        assets, 
      });
      await pfp.save();

      const io = req.app.get('io');
      io.emit('new-pfp', {
        _id: pfp._id,
        blobName,
        username: pfp.username,
        discord: pfp.discord,
        owner: owner,
        imageUrl: `${process.env.SHELBY_GATEWAY}/${owner}/${blobName}`,
        assets: pfp.assets,
      });

      res.status(201).json(pfp);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create PFP' });
    }
  }
);

// GET /api/pfp — public listing (excludes hidden PFPs)
router.get('/', async (req: Request, res: Response) => { 
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
    const search = (req.query.search as string) || '';
    const owner = req.query.owner as string;

    const query: any = { isHidden: { $ne: true } };
    if (search) {
      query.discord = { $regex: search, $options: 'i' };
    }
    if (owner) {
      query.owner = owner;
    }

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
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch PFPs' });
  }
});

// GET /api/pfp/:blobName — single PFP detail (hidden ones return 404 for public)
router.get('/:blobName', async (req: Request, res: Response) => { 
  try {
    const pfp = await PFP.findOne({ blobName: req.params.blobName });
    if (!pfp) return res.status(404).json({ error: 'Not found' });

    // If hidden, only show to admin
    if (pfp.isHidden) {
      const requestingAddr = req.headers['x-wallet-address'] as string;
      if (requestingAddr !== process.env.ADMIN_ADDRESS) {
        return res.status(404).json({ error: 'This content has been removed' });
      }
    }

    res.json({
      ...pfp.toObject(),
      imageUrl: `${process.env.SHELBY_GATEWAY}/${pfp.owner}/${pfp.blobName}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch PFP' });
  }
});

export default router;
