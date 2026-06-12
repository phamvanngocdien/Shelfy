import {
  ShelbyClient,
  generateCommitments,
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  ShelbyBlobClient,
} from '@shelby-protocol/sdk/browser';
import { Aptos, AptosConfig, Network, AccountAddress } from '@aptos-labs/ts-sdk';

interface UploadParams {
  /** The file blob to upload */
  file: Blob;
  /** Owner wallet address (0x...) */
  owner: string;
  /** Prefix for the blob name (e.g. 'pfp', 'asset_sticker') */
  blobPrefix: string;
  /** Number of days before the blob expires */
  expirationDays: number;
  /** Wallet adapter's signAndSubmitTransaction function */
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  /** Aptos network to use (defaults to TESTNET) */
  network?: Network;
}

/**
 * Upload a file to Shelby Network.
 * Handles: erasure coding → on-chain registration → blob data upload.
 * @returns The blob name assigned to the uploaded file.
 */
export async function uploadToShelby({
  file,
  owner,
  blobPrefix,
  expirationDays,
  signAndSubmitTransaction,
  network = Network.TESTNET,
}: UploadParams): Promise<string> {
  // ShelbyClient only supports TESTNET, SHELBYNET, LOCAL — default to TESTNET
  const shelbyNetwork = (network === Network.TESTNET || (network as any) === 'shelbynet')
    ? network
    : Network.TESTNET;

  const shelbyClient = new ShelbyClient({
    network: shelbyNetwork as any,
    apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY,
  });

  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  const provider = await createDefaultErasureCodingProvider();
  const commitments = await generateCommitments(provider, fileData);

  const blobName = `${blobPrefix}_${Date.now()}.png`;
  const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;
  const ownerAddr = AccountAddress.fromString(owner);

  const payload = ShelbyBlobClient.createRegisterBlobPayload({
    account: ownerAddr,
    blobName,
    blobMerkleRoot: commitments.blob_merkle_root,
    numChunksets: expectedTotalChunksets(commitments.raw_data_size),
    expirationMicros,
    blobSize: commitments.raw_data_size,
    encoding: 0,
  });

  // Step 1: Sign and submit the on-chain transaction
  let txnHash: string;
  try {
    const pendingTxn = await signAndSubmitTransaction({ data: payload as any });
    txnHash = pendingTxn.hash;
  } catch (err: any) {
    // User rejected the transaction or wallet error
    const msg = err?.message || '';
    if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('denied')) {
      throw new Error('Transaction cancelled by user');
    }
    throw new Error(`Wallet signing failed: ${msg}`);
  }

  // Step 2: Wait for on-chain confirmation
  try {
    const aptos = new Aptos(new AptosConfig({ network }));
    await aptos.waitForTransaction({ transactionHash: txnHash });
  } catch (err: any) {
    throw new Error(`Transaction confirmation failed: ${err?.message || 'unknown error'}`);
  }

  // Step 3: Upload blob data to Shelby gateway
  try {
    await shelbyClient.rpc.putBlob({
      account: owner,
      blobName,
      blobData: fileData,
    });
  } catch (err: any) {
    throw new Error(`Shelby upload failed: ${err?.message || 'Gateway error'}`);
  }

  return blobName;
}

// ============ BATCH UPLOAD ============

export interface BatchFileItem {
  file: Blob;
  /** Original filename for display purposes */
  fileName: string;
}

export interface BatchUploadResult {
  fileName: string;
  blobName: string;
  txHash: string;
  success: boolean;
  error?: string;
}

type BatchPhase = 'preparing' | 'signing' | 'uploading' | 'done';

interface BatchUploadParams {
  files: BatchFileItem[];
  owner: string;
  blobPrefix: string;
  expirationDays: number;
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  network?: Network;
  /** Called as each phase / file progresses */
  onProgress?: (phase: BatchPhase, current: number, total: number, detail?: string) => void;
  /** Called when a single file completes (success or fail) */
  onFileComplete?: (result: BatchUploadResult) => void;
}

/**
 * Upload multiple files to Shelby Network with optimized pipelining:
 *   Phase 1 – Prepare: generate commitments for all files in parallel
 *   Phase 2 – Sign: rapidly sign all transactions sequentially (no wait between)
 *   Phase 3 – Upload: confirm transactions + upload blob data in parallel
 */
export async function batchUploadToShelby({
  files,
  owner,
  blobPrefix,
  expirationDays,
  signAndSubmitTransaction,
  network = Network.TESTNET,
  onProgress,
  onFileComplete,
}: BatchUploadParams): Promise<BatchUploadResult[]> {
  const total = files.length;
  const results: BatchUploadResult[] = [];

  const shelbyNetwork = (network === Network.TESTNET || (network as any) === 'shelbynet')
    ? network : Network.TESTNET;
  const shelbyClient = new ShelbyClient({ network: shelbyNetwork as any, apiKey: process.env.NEXT_PUBLIC_SHELBY_API_KEY });
  const ownerAddr = AccountAddress.fromString(owner);
  const provider = await createDefaultErasureCodingProvider();
  const aptos = new Aptos(new AptosConfig({ network }));

  // ── Phase 1: Prepare all files (parallel) ──
  onProgress?.('preparing', 0, total);
  type PreparedFile = {
    index: number; fileName: string; blobName: string;
    fileData: Uint8Array; payload: any;
  };
  const prepared: PreparedFile[] = [];

  const prepPromises = files.map(async (item, i) => {
    try {
      const arrayBuffer = await item.file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      const commitments = await generateCommitments(provider, fileData);
      const blobName = `${blobPrefix}_${Date.now()}_${i}.png`;
      const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;
      const payload = ShelbyBlobClient.createRegisterBlobPayload({
        account: ownerAddr, blobName,
        blobMerkleRoot: commitments.blob_merkle_root,
        numChunksets: expectedTotalChunksets(commitments.raw_data_size),
        expirationMicros, blobSize: commitments.raw_data_size, encoding: 0,
      });
      return { index: i, fileName: item.fileName, blobName, fileData, payload } as PreparedFile;
    } catch (err: any) {
      const result: BatchUploadResult = {
        fileName: item.fileName, blobName: '', txHash: '', success: false,
        error: `Prepare failed: ${err?.message}`,
      };
      results.push(result);
      onFileComplete?.(result);
      return null;
    }
  });

  const prepResults = await Promise.all(prepPromises);
  for (const p of prepResults) { if (p) prepared.push(p); }
  onProgress?.('preparing', total, total);

  if (prepared.length === 0) {
    onProgress?.('done', 0, total);
    return results;
  }

  // ── Phase 2: Sign all transactions sequentially (fast, no waiting for confirm) ──
  onProgress?.('signing', 0, prepared.length);
  type SignedFile = PreparedFile & { txHash: string };
  const signed: SignedFile[] = [];

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    onProgress?.('signing', i, prepared.length, p.fileName);
    try {
      const pendingTxn = await signAndSubmitTransaction({ data: p.payload as any });
      signed.push({ ...p, txHash: pendingTxn.hash });
    } catch (err: any) {
      const msg = err?.message || '';
      const isCancel = msg.includes('rejected') || msg.includes('cancel') || msg.includes('denied');
      const result: BatchUploadResult = {
        fileName: p.fileName, blobName: p.blobName, txHash: '', success: false,
        error: isCancel ? 'Transaction cancelled by user' : `Signing failed: ${msg}`,
      };
      results.push(result);
      onFileComplete?.(result);
      // If user cancelled, stop signing remaining
      if (isCancel) break;
    }
  }
  onProgress?.('signing', prepared.length, prepared.length);

  // ── Phase 3: Confirm + Upload blob data (parallel, with retry) ──
  onProgress?.('uploading', 0, signed.length);
  let uploadDone = 0;

  const UPLOAD_TIMEOUT_MS = 30_000; // 30 seconds per attempt
  const MAX_RETRIES = 3;

  async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
      ),
    ]);
  }

  const uploadPromises = signed.map(async (s) => {
    try {
      // Wait for on-chain confirmation (with timeout)
      await withTimeout(
        aptos.waitForTransaction({ transactionHash: s.txHash }),
        60_000, // 60s for chain confirmation
        'Transaction confirmation'
      );

      // Upload blob with retry
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await withTimeout(
            shelbyClient.rpc.putBlob({ account: owner, blobName: s.blobName, blobData: s.fileData }),
            UPLOAD_TIMEOUT_MS,
            `putBlob attempt ${attempt}`
          );
          // Success
          const result: BatchUploadResult = {
            fileName: s.fileName, blobName: s.blobName, txHash: s.txHash, success: true,
          };
          results.push(result);
          onFileComplete?.(result);
          return;
        } catch (err: any) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            // Wait briefly before retry
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
      // All retries failed
      const result: BatchUploadResult = {
        fileName: s.fileName, blobName: s.blobName, txHash: s.txHash, success: false,
        error: `Upload failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
      };
      results.push(result);
      onFileComplete?.(result);
    } catch (err: any) {
      const result: BatchUploadResult = {
        fileName: s.fileName, blobName: s.blobName, txHash: s.txHash, success: false,
        error: `Failed: ${err?.message}`,
      };
      results.push(result);
      onFileComplete?.(result);
    } finally {
      uploadDone++;
      onProgress?.('uploading', uploadDone, signed.length);
    }
  });

  await Promise.all(uploadPromises);
  onProgress?.('done', total, total);
  return results;
}
