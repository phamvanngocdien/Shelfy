import { Request, Response, NextFunction } from 'express';
import { 
  AccountAddress, 
  Ed25519PublicKey, 
  Ed25519Signature 
} from '@aptos-labs/ts-sdk';

declare global {
  namespace Express {
    interface Request {
      admin?: { address: string };
    }
  }
}

// Store used nonces to prevent replay attacks
const usedNonces = new Set<string>();

// Signature validity window (5 minutes)
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000;

// Auto-cleanup nonce after 10 minutes to prevent memory leak
const NONCE_CLEANUP_MS = 10 * 60 * 1000;

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const address = req.headers['x-wallet-address'] as string;
  const signature = req.headers['x-signature'] as string;
  const publicKey = req.headers['x-public-key'] as string;
  const message = req.headers['x-message'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  const nonce = req.headers['x-nonce'] as string;

  // 1. Check all required fields are present
  if (!address || !signature || !message || !publicKey || !timestamp || !nonce) {
    return res.status(401).json({ 
      error: 'Missing authentication data (address, signature, message, publicKey, timestamp, nonce are required)' 
    });
  }

  // 2. Anti-Replay: Check signature has not expired
  const msgTimestamp = parseInt(timestamp, 10);
  if (isNaN(msgTimestamp) || Date.now() - msgTimestamp > MESSAGE_EXPIRY_MS) {
    return res.status(401).json({ error: 'Signature expired. Please sign again.' });
  }

  // 3. Anti-Replay: Check nonce has not been used before
  if (usedNonces.has(nonce)) {
    return res.status(401).json({ error: 'Nonce already used (replay attack detected)' });
  }

  // 4. Verify message format contains correct timestamp and nonce
  const expectedPrefix = `Admin access for ${address} at ${timestamp} nonce:${nonce}`;
  if (!message.startsWith(expectedPrefix)) {
    return res.status(401).json({ error: 'Invalid message format' });
  }

  // 5. Check admin address
  const adminConfig = process.env.ADMIN_ADDRESS?.toLowerCase();
  if (!adminConfig || address.toLowerCase() !== adminConfig) {
    return res.status(403).json({ error: 'Access denied: You are not authorized as an admin' });
  }

  try {
    const toUint8Array = (hex: string) => Uint8Array.from(Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex'));

    const sig = new Ed25519Signature(toUint8Array(signature));
    const pubKey = new Ed25519PublicKey(toUint8Array(publicKey));

    // Verify public key matches claimed address
    const derivedAddress = pubKey.authKey().derivedAddress();
    
    if (derivedAddress.toString().toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Public key does not match the wallet address' });
    }

    // Verify the signature is valid
    const isValid = pubKey.verifySignature({
      message: message, 
      signature: sig,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Mark nonce as used (prevent replay)
    usedNonces.add(nonce);
    setTimeout(() => usedNonces.delete(nonce), NONCE_CLEANUP_MS);

    req.admin = { address: derivedAddress.toString() };
    next();
  } catch (err: any) {
    console.error('Admin Auth Error:', err);
    return res.status(500).json({ error: 'Authentication failed: ' + err.message });
  }
};
