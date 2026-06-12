import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build Shelby Gateway URL for a blob.
 * @param ownerAddress - The Aptos wallet address that owns the blob
 * @param blobName - The blob name on Shelby Network
 */
export function getShelbyBlobUrl(ownerAddress: string, blobName: string): string {
  if (!ownerAddress || !blobName) return '';
  const gateway = process.env.NEXT_PUBLIC_SHELBY_GATEWAY;
  return `${gateway}/${ownerAddress}/${blobName}`;
}