import { Network } from '@aptos-labs/ts-sdk';

/**
 * Map wallet network string to Aptos SDK Network enum.
 * Supports: mainnet, testnet, devnet, shelbynet.
 */
export function resolveNetwork(walletNetwork: string | unknown): Network {
  const net = (typeof walletNetwork === 'string' ? walletNetwork : 'testnet').toLowerCase();
  switch (net) {
    case 'mainnet': return Network.MAINNET;
    case 'devnet': return Network.DEVNET;
    case 'shelbynet': return Network.SHELBYNET;
    default: return Network.TESTNET;
  }
}

/**
 * Generate a Shelby Explorer URL for a specific blob.
 * Format: https://explorer.shelby.xyz/{network}/account/{address}/blobs?name={blobName}
 */
export function getShelbyExplorerUrl(account: string, blobName: string, network: string = 'testnet'): string {
  const net = (typeof network === 'string' ? network : 'testnet').toLowerCase();
  const validNets = ['mainnet', 'testnet', 'devnet', 'shelbynet'];
  const networkPath = validNets.includes(net) ? net : 'testnet';
  return `https://explorer.shelby.xyz/${networkPath}/account/${account}/blobs?name=${encodeURIComponent(blobName)}`;
}
