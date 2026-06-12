import express, {Request, Response} from 'express';
import { Asset } from '../models/Asset.js';
import { body, validationResult } from 'express-validator';
import { contributeLimiter } from '../middleware/rateLimiter.js';
import { checkBlobExists } from '../services/shelby.js';

const router = express.Router();

// POST /api/contribute/asset
// Now receives Shelby blob metadata instead of file upload
router.post(
  '/asset',
  contributeLimiter,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required (max 100 chars)'),
    body('type').isIn(['frame', 'sticker']).withMessage('Type must be frame or sticker'),
    body('shelbyBlobName').isString().notEmpty().isLength({ max: 200 }).withMessage('Shelby blob name is required'),
    body('ownerAddress').isString().notEmpty().matches(/^0x[a-fA-F0-9]{1,64}$/).withMessage('Valid Aptos address is required'),
    body('defaultWidth').optional().isInt({ min: 1, max: 2000 }).withMessage('Width must be 1-2000'),
    body('defaultHeight').optional().isInt({ min: 1, max: 2000 }).withMessage('Height must be 1-2000'),
    body('userAddress').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, type, shelbyBlobName, ownerAddress, defaultWidth, defaultHeight, userAddress } = req.body;

      // Verify the blob actually exists on Shelby Network
      const exists = await checkBlobExists(ownerAddress, shelbyBlobName);
      if (!exists) {
        return res.status(400).json({ error: 'Blob does not exist on Shelby Network. Please upload the file first.' });
      }

      // Check for duplicate blob name
      const existing = await Asset.findOne({ shelbyBlobName, ownerAddress });
      if (existing) {
        return res.status(400).json({ error: 'This asset blob is already registered' });
      }

      const asset = new Asset({
        name,
        type,
        shelbyBlobName,
        ownerAddress,
        defaultWidth: defaultWidth || 100,
        defaultHeight: defaultHeight || 100,
        defaultX: 0,
        defaultY: 0,
        uploadedBy: userAddress || ownerAddress,
        isApproved: false,
      });
      await asset.save();
      res.status(201).json(asset);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to register asset' });
    }
  }
);

export default router;