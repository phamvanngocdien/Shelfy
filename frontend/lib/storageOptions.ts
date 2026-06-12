/**
 * Standard storage duration options for Shelby Network uploads.
 * Used across all upload pages for consistency.
 */
export interface StorageOption {
  value: number;
  label: string;
  recommended?: boolean;
}

export const STORAGE_OPTIONS: StorageOption[] = [
  { value: 1, label: '1 epoch (~1 day)' },
  { value: 7, label: '7 epochs (~1 week)' },
  { value: 30, label: '30 epochs (~1 month)' },
  { value: 90, label: '90 epochs (~3 months)' },
  { value: 180, label: '180 epochs (~6 months)' },
  { value: 365, label: '365 epochs (~1 year)', recommended: true },
];

export const DEFAULT_EXPIRATION_DAYS = 365;
