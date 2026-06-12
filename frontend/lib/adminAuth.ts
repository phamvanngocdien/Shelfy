/**
 * Admin authentication helper — generates all headers required by the
 * `isAdmin` middleware (Ed25519 signature verification).
 *
 * Headers produced:
 *   x-wallet-address, x-signature, x-public-key, x-message, x-timestamp, x-nonce
 */

interface AdminAuthParams {
  /** Wallet address (0x...) */
  address: string;
  /** Wallet adapter signMessage function */
  signMessage: (payload: { message: string; nonce: string }) => Promise<{
    signature: any;
    fullMessage: string;
  }>;
  /** Public key hex string from the wallet account */
  publicKey: string;
}

interface AdminAuthHeaders extends Record<string, string> {
  'x-wallet-address': string;
  'x-signature': string;
  'x-public-key': string;
  'x-message': string;
  'x-timestamp': string;
  'x-nonce': string;
}

/**
 * Sign an admin authentication message and return all required headers.
 * Must be called before each admin API request (nonce is single-use).
 */
export async function getAdminAuthHeaders({
  address,
  signMessage,
  publicKey,
}: AdminAuthParams): Promise<AdminAuthHeaders> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const message = `Admin access for ${address} at ${timestamp} nonce:${nonce}`;

  const result = await signMessage({ message, nonce });

  // Wallet adapters may return signature as Uint8Array, hex string, or Signature object
  let signatureHex: string;
  if (result.signature instanceof Uint8Array) {
    signatureHex = '0x' + Array.from(result.signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } else if (typeof result.signature === 'string') {
    signatureHex = result.signature.startsWith('0x')
      ? result.signature
      : '0x' + result.signature;
  } else {
    // Signature object from @aptos-labs/ts-sdk — use toString()
    signatureHex = result.signature.toString();
    if (!signatureHex.startsWith('0x')) signatureHex = '0x' + signatureHex;
  }

  return {
    'x-wallet-address': address,
    'x-signature': signatureHex,
    'x-public-key': publicKey,
    'x-message': result.fullMessage || message,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
  };
}
