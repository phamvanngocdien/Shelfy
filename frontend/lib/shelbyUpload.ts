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
    fileData: Uint8Array; commitments: any;
  };
  const prepared: PreparedFile[] = [];

  const prepPromises = files.map(async (item, i) => {
    try {
      const arrayBuffer = await item.file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      const commitments = await generateCommitments(provider, fileData);
      const blobName = `${blobPrefix}_${Date.now()}_${i}.png`;
      return { index: i, fileName: item.fileName, blobName, fileData, commitments } as PreparedFile;
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

  // ── Phase 2: Sign a SINGLE batch transaction for all files ──
  onProgress?.('signing', 0, 1, 'Approving batch transaction...');
  let batchTxHash = '';
  try {
    const expirationMicros = (Date.now() + expirationDays * 24 * 60 * 60 * 1000) * 1000;
    const blobsPayloadData = prepared.map(p => ({
      blobName: p.blobName,
      blobSize: p.commitments.raw_data_size,
      blobMerkleRoot: p.commitments.blob_merkle_root,
      numChunksets: expectedTotalChunksets(p.commitments.raw_data_size),
    }));

    const payload = ShelbyBlobClient.createBatchRegisterBlobsPayload({
      account: ownerAddr,
      expirationMicros,
      blobs: blobsPayloadData,
      encoding: 0,
    });

    const pendingTxn = await signAndSubmitTransaction({ data: payload as any });
    batchTxHash = pendingTxn.hash;
  } catch (err: any) {
    const msg = err?.message || '';
    const isCancel = msg.includes('rejected') || msg.includes('cancel') || msg.includes('denied');
    const errStr = isCancel ? 'Transaction cancelled by user' : `Signing failed: ${msg}`;
    for (const p of prepared) {
      const result: BatchUploadResult = {
        fileName: p.fileName, blobName: p.blobName, txHash: '', success: false,
        error: errStr,
      };
      results.push(result);
      onFileComplete?.(result);
    }
    onProgress?.('done', total, total);
    return results;
  }
  onProgress?.('signing', 1, 1);

  // ── Phase 3: Confirm single transaction + Upload blob data ──
  onProgress?.('uploading', 0, prepared.length);
  let uploadDone = 0;

  const UPLOAD_TIMEOUT_MS = 30_000;
  const MAX_RETRIES = 3;

  async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
      ),
    ]);
  }

  try {
    // Wait for on-chain confirmation (with timeout)
    await withTimeout(
      aptos.waitForTransaction({ transactionHash: batchTxHash }),
      60_000,
      'Transaction confirmation'
    );
  } catch (err: any) {
    for (const p of prepared) {
      const result: BatchUploadResult = {
        fileName: p.fileName, blobName: p.blobName, txHash: batchTxHash, success: false,
        error: `Confirmation failed: ${err?.message}`,
      };
      results.push(result);
      onFileComplete?.(result);
    }
    onProgress?.('done', total, total);
    return results;
  }

  // Use a concurrency limit to avoid overwhelming the gateway with 500s
  const CONCURRENCY_LIMIT = 2;
  const inProgress = new Set<Promise<void>>();

  for (const s of prepared) {
    const uploadTask = (async () => {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await withTimeout(
            shelbyClient.rpc.putBlob({ account: owner, blobName: s.blobName, blobData: s.fileData }),
            UPLOAD_TIMEOUT_MS,
            `putBlob attempt ${attempt}`
          );
          const result: BatchUploadResult = {
            fileName: s.fileName, blobName: s.blobName, txHash: batchTxHash, success: true,
          };
          results.push(result);
          onFileComplete?.(result);
          return;
        } catch (err: any) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
      const result: BatchUploadResult = {
        fileName: s.fileName, blobName: s.blobName, txHash: batchTxHash, success: false,
        error: `Upload failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
      };
      results.push(result);
      onFileComplete?.(result);
    })();

    uploadTask.finally(() => {
      uploadDone++;
      onProgress?.('uploading', uploadDone, prepared.length);
      inProgress.delete(uploadTask);
    });

    inProgress.add(uploadTask);
    if (inProgress.size >= CONCURRENCY_LIMIT) {
      await Promise.race(inProgress);
    }
  }

  await Promise.all(inProgress);
  onProgress?.('done', total, total);
  return results;
}
