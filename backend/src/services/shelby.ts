import axios from 'axios';

/**
 * Check if a blob exists on the Shelby Network by making a HEAD request.
 * Uses fail-open strategy: if gateway is unreachable, assume blob exists
 * to avoid blocking users during temporary outages.
 */
export async function checkBlobExists(owner: string, blobName: string): Promise<boolean> {
  try {
    const url = `${process.env.SHELBY_GATEWAY}/${owner}/${blobName}`;
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (err: any) {
    if (err.response?.status === 404) return false;
    // Gateway unreachable or 5xx — fail-open to not block users
    console.error(`Shelby gateway check failed (fail-open): ${err.message}`);
    return true;
  }
}