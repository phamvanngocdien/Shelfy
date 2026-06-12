import { Request, Response, NextFunction } from 'express';

/**
 * Simple admin check — only verifies wallet address matches ADMIN_ADDRESS.
 * Use this for non-critical actions like hiding/unhiding PFPs.
 * For critical actions (approve/delete assets), use the full `isAdmin` middleware.
 */
export const isAdminSimple = (req: Request, res: Response, next: NextFunction) => {
  const address = req.headers['x-wallet-address'] as string;

  if (!address) {
    return res.status(401).json({ error: 'Wallet address required' });
  }

  const adminConfig = process.env.ADMIN_ADDRESS?.toLowerCase();
  if (!adminConfig || address.toLowerCase() !== adminConfig) {
    return res.status(403).json({ error: 'Access denied: Not admin' });
  }

  req.admin = { address };
  next();
};
